// BaseCollector —— 所有官方源适配器的基类（ESM）
// 设计：
//   fetchRaw()  拉原始数据（网络 best-effort；离线模式读 collectors/_fixtures/<id>.json）
//   normalize() 把原始数据映射为「仅含白名单客观字段」的 patch 数组
//   run()       统一入口，失败隔离（单源抛错不影响其他源）
// 注意：本项目 package.json 为 "type":"module"，故 collectors/*.js 为 ESM；
//       编排脚本 scripts/run_collectors.cjs 为 .cjs（CommonJS），通过动态 import() 加载本模块。

export function toNum(v) {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
export function toInt(v) {
  const n = toNum(v);
  return n === undefined ? undefined : Math.floor(n);
}

export class BaseCollector {
  static id = '';
  static label = '';
  static official = true;
  static requiresKey = false;
  static sourceUrl = '';
  static providerId = ''; // 对齐 data/providers.json 的 provider_id

  constructor(ctx = {}) {
    this.ctx = ctx;
    this.providerId = this.constructor.providerId || this.constructor.id;
    this.http = ctx.http || defaultHttp();
    this.log = ctx.log || ((...a) => console.log(...a));
  }

  async fetchRaw() { throw new Error('fetchRaw not implemented'); }
  normalize(raw) { throw new Error('normalize not implemented'); }
  async discover() { return []; } // 仅第三方发现源用

  async request(url, opts = {}) {
    return this.http.get(url, opts);
  }

  async run() {
    const started = Date.now();
    try {
      const raw = await this.fetchRaw();
      const normalized = this.normalize(raw) || [];
      const today = new Date().toISOString().slice(0, 10);
      const patches = normalized
        .filter((p) => p && p.id)
        .map((p) => ({
          id: p.id,
          provider_id: this.providerId,
          ...p,
          last_checked_at: today,
          _source: this.constructor.id,
          _status: 'ok',
        }));
      this.log(`  ✓ ${this.constructor.label}: ${patches.length} 条型号已采集`);
      return {
        source: this.constructor.id,
        provider_id: this.providerId,
        status: 'ok',
        count: patches.length,
        patches,
        elapsedMs: Date.now() - started,
      };
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      this.log(`  ✗ ${this.constructor.label}: 采集失败 — ${msg}`);
      return {
        source: this.constructor.id,
        provider_id: this.providerId,
        status: 'failed',
        error: msg,
        count: 0,
        patches: [],
        elapsedMs: Date.now() - started,
      };
    }
  }
}

// 默认 HTTP 客户端：Node 22 全局 fetch + 超时中断；失败抛错由 run() 捕获（失败隔离）
function defaultHttp() {
  return {
    async get(url, opts = {}) {
      const timeoutMs = opts.timeoutMs || 15000;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: ctrl.signal, headers: opts.headers || {} });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) return await res.json();
        return await res.text();
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
