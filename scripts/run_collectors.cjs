#!/usr/bin/env node
// Phase 1 — 运行启用源 Collector，产出「仅含白名单客观字段」的 patch 到 data/.staging/collected.json
// 不修改 data/ 主数据；单源失败隔离；支持：
//   --offline               读 collectors/_fixtures/<id>.json（本地/CI 可复现，无需外网）
//   --config <path>         指定 collectors/_config.json
//   --simulate-failure <id> 强制某源抛错（演示失败隔离）
//   --dry-run               只运行不写盘
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const OFFLINE = args.includes('--offline');
const DRY = args.includes('--dry-run');
const simIdx = args.indexOf('--simulate-failure');
const SIM = simIdx >= 0 ? args[simIdx + 1] : null;
const cfgIdx = args.indexOf('--config');
const CFG = cfgIdx >= 0 ? args[cfgIdx + 1] : path.join(ROOT, 'collectors/_config.json');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

async function main() {
  const { loadCollectors } = await import(pathToFileURL(path.join(ROOT, 'collectors/_registry.js')).href);
  const all = await loadCollectors(path.join(ROOT, 'collectors'));
  const config = JSON.parse(fs.readFileSync(CFG, 'utf8'));
  const enabled = new Set(config.enabled || []);
  const active = all.filter((C) => enabled.has(C.id) && (!ONLY || C.id === ONLY));

  console.log('=== 运行 Collectors（Phase 1）===');
  console.log('模式: ' + (OFFLINE ? 'offline (fixtures)' : 'network') + (SIM ? ` | 模拟失败: ${SIM}` : ''));
  const scope = ONLY ? `（仅 ${ONLY}）` : '';
  console.log('启用源: ' + active.map((c) => c.id).join(', ') + `  (共 ${all.length} 个适配器)${scope}`);

  const results = [];
  for (const C of active) {
    const ctx = { log: (...a) => console.log(...a) };
    if (OFFLINE) {
      const fx = path.join(ROOT, 'collectors/_fixtures', C.id + '.json');
      ctx.offline = true;
      ctx.fixture = fs.existsSync(fx) ? JSON.parse(fs.readFileSync(fx, 'utf8')) : [];
    }
    const inst = new C(ctx);
    if (SIM && SIM === C.id) {
      inst.fetchRaw = () => { throw new Error('simulated network failure'); };
    }
    results.push(await inst.run());
  }

  const patches = results.flatMap((r) => r.patches || []);
  const stagingDir = path.join(ROOT, 'data/.staging');
  const out = {
    generated_at: new Date().toISOString().slice(0, 10),
    mode: OFFLINE ? 'offline' : 'network',
    sources: results.map((r) => ({ source: r.source, provider_id: r.provider_id, status: r.status, count: r.count, coverage: r.coverage || [], error: r.error || null })),
    patches,
  };
  if (!DRY) {
    fs.mkdirSync(stagingDir, { recursive: true });
    fs.writeFileSync(path.join(stagingDir, 'collected.json'), JSON.stringify(out, null, 2));
    fs.writeFileSync(
      path.join(stagingDir, 'sync-state.json'),
      JSON.stringify({ generated_at: out.generated_at, mode: out.mode, sources: out.sources }, null, 2)
    );
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  console.log(`\n采集汇总: ${ok} 成功 / ${failed} 失败 / 共 ${patches.length} 条 patch`);
  if (failed) console.log('失败源: ' + results.filter((r) => r.status === 'failed').map((r) => `${r.source}(${r.error})`).join('; '));
  console.log(DRY ? '(dry-run 未写入 staging)' : '已写入 data/.staging/collected.json + sync-state.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
