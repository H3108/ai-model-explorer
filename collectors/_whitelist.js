// 客观字段白名单：Collector 仅允许写入这些字段。
// 定性 / 人工字段（one_liner_cn / capabilities / best_for / free / free_note / verified_date …）一律不碰。
export const OBJECTIVE_FIELDS = [
  'input_price_per_mtok',
  'output_price_per_mtok',
  'context_window',
  'max_output_tokens',
  'release_date',
  'status',
  'media_pricing',
  'media_type',
  'source_url',
  'last_checked_at',
];

// 安全网：从任意 patch 中仅保留白名单字段（用于 staging 落盘 / apply 合入前清洗）
export function pickObjective(patch) {
  const out = {};
  for (const k of OBJECTIVE_FIELDS) {
    if (patch[k] !== undefined && patch[k] !== null) out[k] = patch[k];
  }
  return out;
}
