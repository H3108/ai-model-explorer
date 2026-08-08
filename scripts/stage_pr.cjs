#!/usr/bin/env node
// Phase 2/3 — 将 staging 差异开 PR（Phase 2）或有限自动合并（Phase 3）。
//
// 流程：
//   1. 读 diff.json，汇总 字段变动 / 新增候选 / 疑似下架 / 失败源
//   2. 安全判定 isSafeDiff：仅含白名单「价格/辅助」字段变动、无新增/弃用/失败源、且变动幅度在
//      阈值内 → 视为「纯安全变动」
//   3. 分支：
//      a) --auto-merge-safe 且 isSafeDiff：直接 apply → commit master → push（绕过 PR，自动合入）
//      b) 有「字段变动」且不自动合并：切 data-sync/<date> 分支 → apply → commit → push → gh pr create（人审）
//      c) 仅新增候选/失败源 或 --issue-only：退化建 Issue 通知
//      d) 全 0：跳过
//
// 默认 --dry-run：只打印预览。--create 真正执行。--auto-merge-safe 仅在 isSafeDiff 时生效（默认关）。
// 安全网：free/定性字段始终不碰（apply_staging 拦截）；非安全 diff 绝不自动合 master。

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const CREATE = args.includes('--create');
const DRY = !CREATE;
const ISSUE_ONLY = args.includes('--issue-only');
const AUTO_MERGE = args.includes('--auto-merge-safe');

// 安全字段集：仅价格 + 辅助（context/max_output）。release_date/status 变动需人审（可能隐含弃用）。
const SAFE_FIELDS = new Set(['input_price_per_mtok', 'output_price_per_mtok', 'context_window', 'max_output_tokens']);
const PRICE_FIELDS = new Set(['input_price_per_mtok', 'output_price_per_mtok']);
const PRICE_THRESHOLD = 0.5; // 价格变动幅度上限（±50%）；超出视为疑似解析错误，降级人审

function sh(cmd) {
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}
function shOut(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
}

// 判定 diff 是否为「纯安全变动」（可自动合并）
function isSafeDiff(diff) {
  const changes = diff.changes || [];
  const news = diff.news || [];
  const deprecated = diff.deprecated || [];
  const failed = diff.failed || [];
  const reasons = [];
  if (news.length) reasons.push(`含 ${news.length} 条新增候选`);
  if (deprecated.length) reasons.push(`含 ${deprecated.length} 条疑似下架`);
  if (failed.length) reasons.push(`含 ${failed.length} 个失败源`);
  for (const c of changes) {
    for (const f of c.fields) {
      if (!SAFE_FIELDS.has(f.field)) { reasons.push(`${c.id}.${f.field} 非安全字段`); continue; }
      if (PRICE_FIELDS.has(f.field)) {
        const oldV = Number(f.old) || 0;
        const newV = Number(f.new) || 0;
        const denom = Math.max(oldV, newV, 1e-9);
        const delta = Math.abs(newV - oldV) / denom;
        if (delta > PRICE_THRESHOLD) reasons.push(`${c.id}.${f.field} 价格变动 ${(delta * 100).toFixed(0)}% 超阈值 ${PRICE_THRESHOLD * 100}%`);
      }
    }
  }
  return { safe: reasons.length === 0 && changes.length > 0, reasons };
}

function main() {
  const diffPath = path.join(ROOT, 'data/.staging/diff.json');
  if (!fs.existsSync(diffPath)) {
    console.error('✗ 没有 diff.json，请先运行: npm run collect:offline && npm run diff');
    process.exit(2);
  }
  const diff = JSON.parse(fs.readFileSync(diffPath, 'utf8'));
  const changes = diff.changes || [];
  const news = diff.news || [];
  const deprecated = diff.deprecated || [];
  const failed = diff.failed || [];
  const total = changes.length + news.length + deprecated.length + failed.length;
  const summary = `${changes.length} 字段变动 / ${news.length} 新增 / ${deprecated.length} 疑似下架 / ${failed.length} 失败源`;

  const safe = isSafeDiff(diff);
  console.log('=== 构建同步 PR/合并（' + (DRY ? 'dry-run 预览' : 'CREATE') + '）===');
  console.log('摘要: ' + summary);
  console.log('安全判定: ' + (safe.safe ? '✓ 纯安全变动（可自动合并）' : '✗ 非安全（需人审）' + (safe.reasons.length ? ' — ' + safe.reasons.join('; ') : '')));
  if (total === 0) {
    console.log('无变更，跳过。');
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const branch = `data-sync/${date}`;
  const safeTag = safe.safe ? ' [安全变动·可自动合并]' : '';
  const title = `数据同步 ${date} — ${summary}${safeTag}`;
  const reportPath = path.join(ROOT, 'data/.staging/DATA_UPDATE_REPORT.md');
  const body = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '(无报告)';

  // ---- 安全自动合并路径（仅 --auto-merge-safe 且纯安全）----
  if (AUTO_MERGE && safe.safe) {
    console.log('\n模式: 安全自动合并 → 直接合入 master（绕过 PR）');
    console.log('--- 正文预览（前 600 字）---');
    console.log(body.slice(0, 600) + (body.length > 600 ? '\n…(截断)' : ''));
    if (DRY) {
      console.log('\n(dry-run) 未执行。加 --create --auto-merge-safe 才真正合入 master。');
      return;
    }
    sh('node scripts/apply_staging.cjs --apply');
    try {
      sh('git add data/model_variants.json data/model_variants_extra.json && git commit -m "data(sync): ' + summary + ' [auto-merge-safe]"');
    } catch {
      console.log('无 data/ 变更可提交，跳过。');
      return;
    }
    try {
      sh('git push origin master');
      console.log('✓ 安全自动合并完成：已直接合入 master（仅客观字段，free/定性字段未动）。');
    } catch (e) {
      console.error('✗ push master 失败（可能无写权限/需 PR）：', e.message);
      process.exit(1);
    }
    return;
  }

  // ---- 普通 PR / Issue 路径 ----
  const mode = changes.length > 0 ? 'PR（含 data/ 客观字段变更，人审后 merge）' : 'Issue（仅发现新增候选/失败源，需人工补定性字段）';
  console.log('模式: ' + mode + (safe.safe ? ' [纯安全变动，可加 --auto-merge-safe 自动合入]' : ''));
  if (changes.length > 0) {
    console.log('分支: ' + branch);
    console.log('标题: ' + title);
    console.log('--- 正文预览（前 1000 字）---');
    console.log(body.slice(0, 1000) + (body.length > 1000 ? '\n…(截断)' : ''));
  }
  if (DRY) {
    console.log('\n(dry-run) 未执行 git/gh。加 --create 才真正开 PR/Issue。');
    return;
  }

  if (changes.length > 0 && !ISSUE_ONLY) {
    sh(`git checkout -B ${branch}`);
    sh('node scripts/apply_staging.cjs --apply');
    try {
      sh(`git commit -m "data(sync): ${summary}" -- data/model_variants.json data/model_variants_extra.json`);
    } catch {
      console.log('无 data/ 变更可提交，跳过 PR。');
      sh('git checkout master');
      return;
    }
    sh(`git push -u origin ${branch}`);
    try {
      sh(`gh pr create --title "${title}" --body-file data/.staging/DATA_UPDATE_REPORT.md --base master`);
      console.log('✓ PR 已创建（未自动合并，请人工 review 后 merge）。');
    } catch (e) {
      console.error('✗ gh pr create 失败（可能无 gh / 无远端 / 已存在 PR）：', e.message);
      sh('git checkout master');
      process.exit(1);
    }
    sh('git checkout master');
  } else {
    // 仅新增候选 / 失败源，或 --issue-only：建 Issue 通知（新候选需人工补定性字段，无法自动入库）
    const t = changes.length > 0
      ? `数据同步发现 ${date} — ${summary}（issue-only 模式，未开 PR）`
      : `数据同步发现 ${date} — ${summary}`;
    try {
      sh(`gh issue create --title "${t}" --body-file data/.staging/DATA_UPDATE_REPORT.md`);
      console.log('✓ 已建通知 Issue（新候选需人工补定性字段后入库；有字段变动时如需自动开 PR 请去掉 issue-only）。');
    } catch (e) {
      console.error('✗ gh issue create 失败：', e.message);
      process.exit(1);
    }
  }
}

main();
