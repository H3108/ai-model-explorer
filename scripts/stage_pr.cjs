#!/usr/bin/env node
// Phase 2 — 将 staging 差异自动开 PR（不自动合并）。
//
// 流程：
//   1. 读 data/.staging/diff.json，汇总 字段变动 / 新增候选 / 疑似下架 / 失败源
//   2. 若「字段变动 > 0」：切 data-sync/<date> 分支 → apply_staging --apply（仅客观字段写 data/）
//      → 提交 data 文件（不含 .staging）→ push → gh pr create（base=master，不自动 merge）
//   3. 若仅「新增候选 / 失败源」无字段变动：退化为建 Issue 通知（新候选需人工补定性字段，无法自动入库）
//   4. 全 0：跳过
//
// 默认 --dry-run：只打印 PR/Issue 标题与正文预览，不执行 git/gh（本地预演用）。
// --create：真正执行（需 gh CLI + 远端写权限；CI 由 data-sync.yml 调用）。
// --issue-only：即使有字段变动也只建 Issue 通知、不开 PR（CI 的 dry_run 输入使用）。
//
// 安全网：free / 定性字段始终不碰（apply_staging 已拦截）；本脚本不修改 master，仅开 PR 供人审。
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const CREATE = args.includes('--create');
const DRY = !CREATE;
const ISSUE_ONLY = args.includes('--issue-only');

function sh(cmd) {
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}
function shOut(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
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

  console.log('=== 构建同步 PR（' + (DRY ? 'dry-run 预览' : 'CREATE') + '）===');
  console.log('摘要: ' + summary);
  if (total === 0) {
    console.log('无变更，跳过。');
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const branch = `data-sync/${date}`;
  const title = `数据同步 ${date} — ${summary}`;
  const reportPath = path.join(ROOT, 'data/.staging/DATA_UPDATE_REPORT.md');
  const body = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '(无报告)';

  const mode = changes.length > 0 ? 'PR（含 data/ 客观字段变更，人审后 merge）' : 'Issue（仅发现新增候选 / 失败源，需人工补定性字段）';
  console.log('模式: ' + mode);
  if (changes.length > 0) console.log('分支: ' + branch);
  console.log('标题: ' + title);
  console.log('--- 正文预览（前 1000 字）---');
  console.log(body.slice(0, 1000) + (body.length > 1000 ? '\n…(截断)' : ''));

  if (DRY) {
    console.log('\n(dry-run) 未执行 git/gh。加 --create 才真正开 PR/Issue（需 gh + 远端）。');
    return;
  }

  // ---- 真实执行 ----
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
