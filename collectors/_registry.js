// 自动发现 collectors/*.js 中「导出且继承 BaseCollector」的适配器（无需手工登记）。
// 跳过框架文件：_base / _registry / _config / _whitelist。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BaseCollector } from './_base.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(['_base.js', '_registry.js', '_config.js', '_whitelist.js', '_openrouter.js']);

export async function loadCollectors(dir) {
  const base = dir || __dirname;
  const files = fs.readdirSync(base).filter((f) => f.endsWith('.js') && !SKIP.has(f));
  const found = [];
  for (const f of files) {
    const mod = await import(path.join(base, f));
    const C = mod.default || mod;
    if (C && typeof C === 'function' && C.prototype instanceof BaseCollector) found.push(C);
  }
  return found;
}
