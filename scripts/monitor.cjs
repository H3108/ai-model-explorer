#!/usr/bin/env node
// Phase 4 —— 监控 / 告警 / 免费层监控 / 弃用检测（只读 data/ + data/.staging/collected.json，绝不写回业务数据）。
//
// 输入：
//   data/model_variants.json + data/model_variants_extra.json  （当前业务数据，含 free / free_note / status 等）
//   data/.staging/collected.json                                （最近一次采集的 patch，含白名单客观字段 + _status）
// 输出：
//   data/.staging/HEALTH_REPORT.md   （人读报告）
//   data/.staging/health.json        （结构化告警，供 CI / stage_pr 消费）
//   data/_monitor_state.json          （跨运行连续失败计数，已纳入 git 跟踪，供 CI 跨次持久化）
//
// 告警维度（对应 Phase 4 四项）：
//   1) 免费层监控：free:true 但官方源给出价格>0（数据诚信错误）；free:true 但 free_note 缺失；非 free 但官方源价格=0（疑似漏标免费）
//   2) 弃用检测：官方源 status 标 deprecated/retired/archived 而站内仍为活跃；站內型号官方源本次未返回（疑似下架）
//   3) 价格/数据异常：价格极端变动（≥5x / ≤0.2x → error；≥2x / ≤0.5x → warn）；曾付费变 0（新免费层？）；曾免费变付费；字段回退为 null
//   4) 采集健康：某源本次失败（warn）；连续失败 ≥2 次（error）
//
// 退出码：默认 0（仅监控，不阻断）。--fail-on=error 有 error 级告警时退出 1；--fail-on=warn 有 warn+ 时退出 1。
// 默认不阻断任何流水线；是否阻断由调用方（CI）选择是否加 --fail-on。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STAGING = path.join(ROOT, 'data/.staging');
const args = process.argv.slice(2);
const FAIL_ON = (() => {
  const i = args.indexOf('--fail-on');
  if (i >= 0) return args[i + 1];           // --fail-on error（空格形式）
  const eq = args.find((a) => a.startsWith('--fail-on='));
  if (eq) return eq.split('=')[1];          // --fail-on=error（等号形式）
  return 'none';
})();

// —— 阈值（可调）——
const PRICE_EXTREME = 5; // 价格倍数 ≥5 或 ≤0.2 → error（极端，疑似解析错误）
const PRICE_LARGE = 2;   // 价格倍数 ≥2 或 ≤0.5 → warn（较大变动，需人确认）
const CONSEC_FAIL_ERROR = 2; // 同一源连续失败次数 ≥2 → error

// 网关 / 聚合类 provider：其返回价格 0 是常态（免费路由 / 免费开发者层），不触发「疑似漏标免费」INFO
const GATEWAY_PROVIDERS = new Set([
  'openrouter', 'groq', 'nvidia-nim', 'together', 'replicate', 'fal-ai',
  'anyapi', 'bazaarlink', 'requesty', 'opencode-zen', 'ovh-ai', 'freeai', 'agnes',
]);
const DEPRECATED_STATUS = new Set(['deprecated', 'retired', 'archived', 'sunset']);

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function readDataModels() {
  const a = loadJson(path.join(ROOT, 'data/model_variants.json')) || [];
  const b = loadJson(path.join(ROOT, 'data/model_variants_extra.json')) || [];
  const map = new Map();
  for (const v of [...a, ...b]) map.set(v.id, v);
  return map;
}

function main() {
  const collectedPath = path.join(STAGING, 'collected.json');
  if (!fs.existsSync(collectedPath)) {
    console.error('✗ 没有 collected.json，请先运行: node scripts/run_collectors.cjs --offline');
    process.exit(2);
  }
  const collected = loadJson(collectedPath);
  const dataMap = readDataModels();
  const patches = (collected.patches || []).filter((p) => p._status === 'ok');
  const sources = collected.sources || [];

  const alerts = [];
  const add = (severity, type, id, provider_id, detail) =>
    alerts.push({ severity, type, id, provider_id: provider_id || (dataMap.get(id) && dataMap.get(id).provider_id) || null, detail });

  // 按 provider 收集本次返回了哪些 id（用于「疑似下架」检测）
  const returnedByProvider = {};
  for (const p of patches) {
    (returnedByProvider[p.provider_id] = returnedByProvider[p.provider_id] || new Set()).add(p.id);
  }

  for (const p of patches) {
    const cur = dataMap.get(p.id);
    const isFree = !!(cur && cur.free === true);
    const isOverride = isFree && !!(cur && cur.free_override === true);
    const inPrice = p.input_price_per_mtok;
    const outPrice = p.output_price_per_mtok;

    // —— 1) 免费层监控 ——
    if (isFree) {
      if ((typeof inPrice === 'number' && inPrice > 0) || (typeof outPrice === 'number' && outPrice > 0)) {
        if (isOverride) {
          add('info', 'free-override', p.id, p.provider_id,
            `人工确认保留 free:true（官方源标价 input=${inPrice}/output=${outPrice}），依据见 free_note；忽略聚合源标价`);
        } else {
          add('error', 'free-mismatch', p.id, p.provider_id,
            `站内标记 free:true，但官方源给出价格 input=${inPrice} / output=${outPrice}（免费标注与官方定价冲突，需人工核销）`);
        }
      }
      if (cur && !(cur.free_note && String(cur.free_note).trim())) {
        add('warn', 'free-note-missing', p.id, p.provider_id, 'free:true 但 free_note 缺失/为空，免费依据未记录');
      }
    } else if (typeof inPrice === 'number' && inPrice === 0 && typeof outPrice === 'number' && outPrice === 0) {
      if (!GATEWAY_PROVIDERS.has(p.provider_id)) {
        add('info', 'free-candidate', p.id, p.provider_id,
          `官方源价格=0 但站内未标 free（非网关源），疑似漏标免费层，建议复核后补 free:true`);
      }
    }

    // —— 2) 弃用检测（status 维度）——
    if (cur && typeof p.status === 'string' && DEPRECATED_STATUS.has(p.status.toLowerCase())) {
      const curStatus = (cur.status || '').toLowerCase();
      if (!DEPRECATED_STATUS.has(curStatus)) {
        add('warn', 'deprecated-status', p.id, p.provider_id,
          `官方源 status=${p.status}，站内 status=${cur.status || '—'}（疑似已弃用/归档，需人工核销）`);
      }
    }

    // —— 3) 价格 / 数据异常 ——
    if (cur) {
      for (const f of ['input_price_per_mtok', 'output_price_per_mtok']) {
        const oldV = cur[f];
        const newV = p[f];
        if (typeof newV !== 'number') continue; // 仅比较数值
        if (typeof oldV === 'number' && oldV > 0) {
          const ratio = newV / oldV;
          if (newV === 0) {
            add('info', 'price-to-zero', p.id, p.provider_id, `${f}: ${oldV} → 0（价格降为 0，可能新增免费层）`);
          } else if (ratio >= PRICE_EXTREME || ratio <= 1 / PRICE_EXTREME) {
            add('error', 'price-extreme', p.id, p.provider_id,
              `${f}: ${oldV} → ${newV}（变动 ${ratio.toFixed(2)}x，≥${PRICE_EXTREME}x 或 ≤${(1 / PRICE_EXTREME).toFixed(1)}x，疑似解析错误）`);
          } else if (ratio >= PRICE_LARGE || ratio <= 1 / PRICE_LARGE) {
            add('warn', 'price-large', p.id, p.provider_id,
              `${f}: ${oldV} → ${newV}（变动 ${ratio.toFixed(2)}x，需人确认）`);
          }
        } else if (oldV === 0 && newV > 0) {
          if (!isOverride) {
            add('warn', 'price-from-zero', p.id, p.provider_id,
              `${f}: 0 → ${newV}（曾标价格 0 的型号开始收费，需人工确认是否仍免费）`);
          }
        }
      }
      // 字段回退为 null（仅当源「显式」给 null 才算回退；源不提供该字段=undefined 属正常，不算回退）
      for (const f of ['context_window', 'max_output_tokens', 'input_price_per_mtok', 'output_price_per_mtok']) {
        const oldV = cur[f];
        const newV = p[f];
        if (typeof oldV === 'number' && newV === null) {
          add('warn', 'field-regression', p.id, p.provider_id, `${f} 由 ${oldV} 回退为 null（字段缺失，需排查采集）`);
        }
      }
    }
  }

  // 疑似下架：仅在该源「实际覆盖」的型号范围内判断（coverage = 该源本次主动跟踪的型号 id）。
  // 避免未接入真实源/版本漂移的源把「本站有但没采到」误判为下架（如智谱媒体模型不在 OpenRouter 覆盖内）。
  const coverageByProvider = {};
  for (const s of sources) {
    if (s.status !== 'ok' || !s.coverage) continue;
    (coverageByProvider[s.provider_id] = coverageByProvider[s.provider_id] || []).push(...s.coverage);
  }
  for (const [pid, cov] of Object.entries(coverageByProvider)) {
    const covSet = new Set(cov);
    for (const [id, cur] of dataMap) {
      if (cur.provider_id === pid && covSet.has(id) && !returnedByProvider[pid].has(id)) {
        add('warn', 'missing-from-source', id, pid, `站内存在但官方源本次未返回（疑似下架，需人工核销）`);
      }
    }
  }

  // —— 4) 采集健康 + 连续失败跟踪 ——
  const statePath = path.join(ROOT, 'data', '_monitor_state.json');
  const prevState = loadJson(statePath) || { consecutive: {} };
  const consecutive = Object.assign({}, prevState.consecutive || {});
  for (const s of sources) {
    if (s.status === 'failed') {
      consecutive[s.source] = (consecutive[s.source] || 0) + 1;
      const n = consecutive[s.source];
      if (n >= CONSEC_FAIL_ERROR) {
        add('error', 'source-consecutive-fail', null, s.source,
          `源 ${s.source} 连续 ${n} 次采集失败（${s.error || '未知错误'}），需排查上游`);
      } else {
        add('warn', 'source-fail', null, s.source, `源 ${s.source} 本次采集失败（${s.error || '未知错误'}）`);
      }
    } else if (consecutive[s.source]) {
      consecutive[s.source] = 0; // 恢复，清零
    }
  }
  fs.mkdirSync(STAGING, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({ generated_at: collected.generated_at, consecutive }, null, 2));

  // 汇总 + 写盘
  const counts = { error: 0, warn: 0, info: 0 };
  for (const a of alerts) counts[a.severity]++;
  const health = {
    generated_at: collected.generated_at,
    mode: collected.mode,
    summary: { ...counts, total: alerts.length },
    alerts,
  };
  const report = buildReport(collected, counts, alerts);
  fs.writeFileSync(path.join(STAGING, 'health.json'), JSON.stringify(health, null, 2));
  fs.writeFileSync(path.join(STAGING, 'HEALTH_REPORT.md'), report);

  console.log('=== 健康监控（Phase 4）===');
  console.log(`error: ${counts.error} | warn: ${counts.warn} | info: ${counts.info} | 总计 ${alerts.length}`);
  if (alerts.length) {
    for (const a of alerts) console.log(`  [${a.severity.toUpperCase()}] ${a.type} ${a.id || a.provider_id || ''}: ${a.detail}`);
  } else {
    console.log('✓ 未发现异常');
  }
  console.log('已写入 data/.staging/HEALTH_REPORT.md + health.json');

  // 退出码
  if (FAIL_ON === 'error' && counts.error > 0) process.exit(1);
  if (FAIL_ON === 'warn' && (counts.error > 0 || counts.warn > 0)) process.exit(1);
  process.exit(0);
}

function buildReport(collected, counts, alerts) {
  const L = [];
  L.push('# 数据健康监控报告（Phase 4）\n');
  L.push(`> 生成时间: ${collected.generated_at} ｜ 模式: ${collected.mode}`);
  L.push('> 本报告为**只读监控**，未修改任何业务数据。\n');
  L.push('## 告警汇总');
  L.push(`- error（需处理）: **${counts.error}**`);
  L.push(`- warn（需关注）: **${counts.warn}**`);
  L.push(`- info（提示）: **${counts.info}**\n`);
  if (!alerts.length) L.push('_未发现异常。_');
  const groups = {
    '免费层监控': ['free-mismatch', 'free-note-missing', 'free-candidate'],
    '弃用检测': ['deprecated-status', 'missing-from-source'],
    '价格/数据异常': ['price-extreme', 'price-large', 'price-to-zero', 'price-from-zero', 'field-regression'],
    '采集健康': ['source-consecutive-fail', 'source-fail'],
  };
  for (const [title, types] of Object.entries(groups)) {
    const items = alerts.filter((a) => types.includes(a.type));
    if (!items.length) continue;
    L.push(`\n## ${title}`);
    for (const a of items) L.push(`- [${a.severity.toUpperCase()}] \`${a.id || a.provider_id}\` (${a.type}): ${a.detail}`);
  }
  L.push('\n---\n本监控不自动修复；error 级告警建议人工核销后再决定是否合入对应数据变更。');
  return L.join('\n');
}

main();
