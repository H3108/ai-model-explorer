// AI Model Explorer — 纯展示层：格式化 / 徽章 / 卡片 / 区块（无路由、无事件）
import { TIER, MODALITY, SPEED_CN, API_STYLE_CN } from './constants.js'
import {
  state, providerOf, familyOf, famName, modalityOf, variantById,
  variantsOfFamily, variantsOfProvider, apiAccessOf, versionsOf,
} from './store.js'

// ---------- 格式化 ----------
export function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
export function cur(c) {
  return c === 'CNY' ? '¥' : '$'
}
export function priceLabel(v) {
  if (v.free) return '免费'
  if (v.media_pricing && v.media_pricing.price != null) {
    const m = v.media_pricing
    return `${cur(m.currency)}${m.price} / ${m.unit === 'image' ? '张' : m.unit === 'second' ? '秒' : m.unit || '次'}`
  }
  if (v.input_price_per_mtok == null) return '未公开'
  return `${cur(v.currency)}${v.input_price_per_mtok} / ${cur(v.currency)}${v.output_price_per_mtok}`
}
// 对比表价格列：免费/带说明的型号后加一个可悬停或点击的信息点，展开 free_note
export function priceCell(v) {
  const label = priceLabel(v)
  if (!v.free_note) return esc(label)
  const dot = `<i class="free-info" tabindex="0" role="button" aria-label="获取说明">i<span class="free-tip">${esc(v.free_note)}</span></i>`
  return `<span class="price-cell">${esc(label)}${dot}</span>`
}
export function priceValue(v) {
  // 媒体计费（图像/视频）以美元计，×40 为 USD→CNY 近似换算，仅用于排序/量级比较
  if (v.media_pricing && v.media_pricing.price != null) return v.media_pricing.price * 40
  if (v.input_price_per_mtok == null) return Number.MAX_SAFE_INTEGER
  return (v.input_price_per_mtok + (v.output_price_per_mtok ?? v.input_price_per_mtok)) / 2
}
export function ctxShort(n) {
  if (n == null) return '—'
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`
  return String(n)
}
export function logoHTML(p, size = 'md') {
  const file = p.logo_file || `assets/logos/${p.id}.svg`
  return `<span class="brandmark bm-${size}" style="--brand:${esc(p.brand_color || '#173e35')}"><img src="${esc(file)}" alt="${esc(p.name || '')}" loading="lazy" onerror="this.replaceWith(document.createTextNode('${esc((p.name || '?').slice(0, 1))}'))"></span>`
}
export function catBadge(p, extraCls = '') {
  if (!p.category) return ''
  const map = { free: ['免费 API', 'cat-free'], gateway: ['托管网关', 'cat-gateway'] }
  const [label, cls] = map[p.category] || [p.category, '']
  return `<span class="cat-badge ${cls} ${extraCls}" title="${esc(p.category === 'gateway' ? '第三方托管网关：聚合多家模型，一个 API key 调用' : '可 API key 调用的真·免费模型')}">${esc(label)}</span>`
}
export function modBadge(v, extraCls = '') {
  const m = MODALITY[modalityOf(v)]
  return `<span class="mod-badge mod-${modalityOf(v)} ${extraCls}"><i>${m.icon}</i>${m.short}</span>`
}
export function modalityMix(list) {
  const c = { text: 0, image: 0, video: 0 }
  list.forEach((v) => c[modalityOf(v)]++)
  return Object.entries(c)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `<span class="mod-chip mod-${k}"><i>${MODALITY[k].icon}</i>${MODALITY[k].short} ${n}</span>`)
    .join('')
}
export function capTags(v) {
  const p = providerOf(v)
  const caps = v.capabilities || {}
  const strong = (c) => c && ['high', 'highest'].includes(c.tier)
  const tags = []
  if (strong(caps.coding)) tags.push('编码')
  if (strong(caps.reasoning)) tags.push('推理')
  if (strong(caps.agent)) tags.push('智能体')
  if ((v.context_window || 0) >= 128000) tags.push('长上下文')
  if (v.vision_support || v.media_type) tags.push('多模态')
  if (p.country === 'CN') tags.push('中文优化')
  if (v.open_weight) tags.push('开放权重')
  if (v.input_price_per_mtok != null && v.input_price_per_mtok <= 1) tags.push('低成本')
  return tags
}

// ---------- 通用组件 ----------
export function pageHead({ eyebrow, title, desc, back }) {
  return `<div class="page-head">
    ${back ? `<button class="back-link" data-back="${esc(back)}">← 返回</button>` : ''}
    <span class="eyebrow">${esc(eyebrow || '')}</span>
    <h1>${title}</h1>
    ${desc ? `<p class="page-desc">${desc}</p>` : ''}
  </div>`
}
export function statCard(label, value, note) {
  return `<div class="stat-card"><span class="stat-label">${esc(label)}</span><b class="stat-value">${value}</b>${note ? `<small>${esc(note)}</small>` : ''}</div>`
}
export function capBar(dim, cap) {
  const t = TIER[cap.tier] || { label: cap.tier, lv: 'mid', pct: 50 }
  return `<div class="cap-row">
    <div class="cap-row-head"><b>${dim.cn}<span>${dim.en}</span></b><span class="tier-pill tier-${t.lv}">${t.label}</span></div>
    <div class="cap-track"><i class="tier-${t.lv}" style="width:${t.pct}%"></i></div>
    <small>${esc(cap.basis || '')}</small>
  </div>`
}
// 模型卡（列表/网格通用）
// 数据质量评级（阈值与 scripts/governance_v1.js 的 grade() 一致：A≥90 / B≥70 / C≥50 / D<50）
export const gradeOf = (v) => { const s = v.data_quality_score || 0; return s >= 90 ? 'A' : s >= 70 ? 'B' : s >= 50 ? 'C' : 'D' }
export const gradeBadge = (v) => {
  const g = gradeOf(v)
  return `<span class="grade-badge g-${g}" title="数据质量 ${v.data_quality_score || 0} 分">${g}</span>`
}
export function modelCard(v, extra = '') {
  const p = providerOf(v)
  const f = familyOf(v)
  const free = v.free ? `<span class="free-badge" title="${esc(v.free_note || '免费可用')}">免费</span>` : ''
  const priceTxt =
    modalityOf(v) === 'text'
      ? v.free ? '免费' : `${priceLabel(v)} /M`
      : priceLabel(v)
  const meta =
    modalityOf(v) === 'text'
      ? `<span>${ctxShort(v.context_window)} 上下文</span><span>${priceTxt}</span>`
      : `<span>${esc(v.max_resolution || v.max_duration_sec ? (v.max_resolution || v.max_duration_sec + 's') : '—')}</span><span>${priceTxt}</span>`
  const tags = [modBadge(v), gradeBadge(v), free, extra].filter(Boolean).join('')
  return `<a class="model-card" href="#model/${encodeURIComponent(v.id)}">
    <div class="mc-top">${logoHTML(p, 'sm')}${tags ? `<div class="mc-tags">${tags}</div>` : ''}</div>
    <b class="mc-name">${esc(v.name_cn || v.name)}</b>
    <small class="mc-from">${esc(p.name_cn || p.name)}${famName(v) ? ' · ' + esc(famName(v)) : ''}</small>
    <p class="mc-desc">${esc(v.one_liner_cn || '')}</p>
    <div class="mc-meta">${meta}</div>
  </a>`
}
export function emptyBox(text) {
  return `<div class="empty-box"><span>✦</span><p>${esc(text)}</p></div>`
}

// 首页精选推荐：质量优先、热度破平（与治理 §11 一致），取前 n
export function recommendedModels(n = 6) {
  const scoreOf = {}
  state.recommendations.forEach((r) => r.model_ids.forEach((m) => (scoreOf[m.id] = (scoreOf[m.id] || 0) + m.score)))
  return Object.entries(scoreOf)
    .map(([id, heat]) => ({ v: variantById(id), heat }))
    .filter((x) => x.v && gradeOf(x.v) !== 'D') // D 级彻底降权，不进首页
    .sort((a, b) => {
      const qa = a.v.data_quality_score || 0, qb = b.v.data_quality_score || 0
      if (qb !== qa) return qb - qa
      return b.heat - a.heat
    })
    .slice(0, n)
    .map((x) => x.v)
}

// ---------- 型号详情区块 ----------
export function codeExamples(v) {
  const p = providerOf(v)
  const base = p.api_base_url || 'http://localhost:8000/v1'
  const isLocal = !p.api_base_url
  const model = v.model_id || v.id
  const style = p.api_style
  const prompt = '你好，介绍一下你自己'
  if (v.media_type === 'image' && style === 'openai') {
    return {
      py: `from openai import OpenAI\n\nclient = OpenAI(api_key="YOUR_API_KEY")\n\nimage = client.images.generate(\n    model="${model}",\n    prompt="一只赛博朋克风格的猫",\n    size="1024x1024",\n    n=1,\n)\nprint(image.data[0].url or image.data[0].b64_json)`,
      js: `const res = await fetch("${base}/images/generations", {\n  method: "POST",\n  headers: { "Content-Type": "application/json", Authorization: "Bearer YOUR_API_KEY" },\n  body: JSON.stringify({ model: "${model}", prompt: "一只赛博朋克风格的猫", size: "1024x1024", n: 1 }),\n});\nconst data = await res.json();\nconsole.log(data.data[0].url || data.data[0].b64_json);`,
      curl: `curl ${base}/images/generations \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -d '{ "model": "${model}", "prompt": "一只赛博朋克风格的猫", "size": "1024x1024", "n": 1 }'`,
    }
  }
  if (v.media_type === 'video' && style === 'google') {
    return {
      py: `import google.generativeai as genai\n\ngenai.configure(api_key="YOUR_API_KEY")\nmodel = genai.GenerativeModel("${model}")\noperation = model.generate_content("一只猫在月球上奔跑")  # Veo\nvideo = operation.result()  # 轮询获取视频结果`,
      js: `const res = await fetch("${base}/models/${model}:generateContent?key=YOUR_API_KEY", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "一只猫在月球上奔跑" }] }] }),\n});\nconst data = await res.json();\nconsole.log(data.candidates?.[0]?.content?.parts?.[0]);`,
      curl: `curl "${base}/models/${model}:generateContent?key=YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "contents": [{"role":"user","parts":[{"text":"一只猫在月球上奔跑"}]}] }'`,
    }
  }
  if (v.media_type) {
    const docs = p.api_docs ? `<a class="text-link" href="${esc(p.api_docs)}" target="_blank" rel="noopener">官方文档 ↗</a>` : '无公开文档'
    const baseUrlPart = (p.api_base_url && !p.no_endpoint) ? ' · Base URL：<code>' + esc(p.api_base_url) + '</code>' : ''
    return { note: `该模型通过官方平台 / API 调用，无统一 SDK 示例。请参考：${docs}${baseUrlPart}。` }
  }
  if (style === 'anthropic') {
    return {
      py: `import anthropic\n\nclient = anthropic.Anthropic(api_key="YOUR_API_KEY")\nmessage = client.messages.create(\n    model="${model}",\n    max_tokens=1024,\n    messages=[{"role": "user", "content": "${prompt}"}],\n)\nprint(message.content[0].text)`,
      js: `const res = await fetch("${base}/v1/messages", {\n  method: "POST",\n  headers: { "Content-Type": "application/json", "x-api-key": "YOUR_API_KEY", "anthropic-version": "2023-06-01" },\n  body: JSON.stringify({ model: "${model}", max_tokens: 1024, messages: [{ role: "user", content: "${prompt}" }] }),\n});\nconst data = await res.json();\nconsole.log(data.content[0].text);`,
      curl: `curl ${base}/v1/messages \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: YOUR_API_KEY" \\\n  -H "anthropic-version: 2023-06-01" \\\n  -d '{ "model": "${model}", "max_tokens": 1024, "messages": [{"role":"user","content":"${prompt}"}] }'`,
    }
  }
  if (style === 'google') {
    return {
      py: `import google.generativeai as genai\n\ngenai.configure(api_key="YOUR_API_KEY")\nmodel = genai.GenerativeModel("${model}")\nresponse = model.generate_content("${prompt}")\nprint(response.text)`,
      js: `const res = await fetch("${base}/models/${model}:generateContent?key=YOUR_API_KEY", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "${prompt}" }] }] }),\n});\nconst data = await res.json();\nconsole.log(data.candidates[0].content.parts[0].text);`,
      curl: `curl "${base}/models/${model}:generateContent?key=YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "contents": [{"role":"user","parts":[{"text":"${prompt}"}]}] }'`,
    }
  }
  return {
    py: `from openai import OpenAI\n\nclient = OpenAI(\n    base_url="${base}",\n    api_key="YOUR_API_KEY",\n)\n\nresponse = client.chat.completions.create(\n    model="${model}",\n    messages=[{"role": "user", "content": "${prompt}"}],\n)\nprint(response.choices[0].message.content)`,
    js: `const res = await fetch("${base}/chat/completions", {\n  method: "POST",\n  headers: { "Content-Type": "application/json", Authorization: "Bearer YOUR_API_KEY" },\n  body: JSON.stringify({ model: "${model}", messages: [{ role: "user", content: "${prompt}" }] }),\n});\nconst data = await res.json();\nconsole.log(data.choices[0].message.content);`,
    curl: `curl ${base}/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -d '{ "model": "${model}", "messages": [{"role":"user","content":"${prompt}"}] }'`,
    isLocal,
  }
}
export function priceBlock(v) {
  if (!v.price_model) return ''
  const LBL = { per_token: '按 Token 计费', per_image: '按张计费（图像生成）', per_second: '按秒计费（视频生成）' }
  let detail = ''
  if (v.price_model === 'per_token') {
    if (v.free) detail = '免费模型（无 token 价）'
    else if (v.input_price_per_mtok != null) detail = `输入 ${cur(v.currency)}${v.input_price_per_mtok}/百万 tokens · 输出 ${cur(v.currency)}${v.output_price_per_mtok}/百万 tokens`
    else detail = '价格未公开'
  } else {
    detail = v.price_note || ''
  }
  return `<div class="api-price"><b>${LBL[v.price_model] || v.price_model}</b>${detail ? `<span>${esc(detail)}</span>` : ''}</div>`
}
export function apiBlockHTML(v) {
  const p = providerOf(v)
  const base = p.api_base_url || 'http://localhost:8000/v1'
  const ex = codeExamples(v)
  const aa = apiAccessOf(v)
  const acc = aa ? aa.accesses[0] : null
  const noEndpoint = !!((acc && acc.no_endpoint) || p.no_endpoint)
  const accessFact = noEndpoint
    ? `<div class="api-fact"><b>官方访问</b><span>${p.website ? `<a class="text-link" href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website)}</a>` : '暂无公开 API 端点'}</span></div>`
    : `<div class="api-fact"><b>接入地址</b><code>${esc(acc ? acc.base_url : (p.api_base_url || '（自托管）'))}</code></div>`
  const feats = (acc && acc.features) || []
  const hasTool = feats.includes('tool_calling') || !!(v.capabilities && v.capabilities.agent && v.capabilities.agent.tier)
  const hasStream = feats.includes('streaming')
  const facts = `<div class="api-facts">
    ${accessFact}
    <div class="api-fact"><b>模型 ID</b><code>${esc(v.model_id || v.id)}</code></div>
    <div class="api-fact"><b>接口协议</b><code>${esc(API_STYLE_CN[acc ? acc.protocol : p.api_style] || (acc ? acc.protocol : p.api_style) || '—')}</code></div>
    <div class="api-fact"><b>认证方式</b><code>${esc((acc && acc.auth_type) || 'api_key')}</code></div>
    <div class="api-fact api-feat"><b>能力支持</b><span>${hasTool ? '<i class="feat on">Tool Calling</i>' : ''}${hasStream ? '<i class="feat on">Streaming</i>' : ''}<i class="feat dim">Structured Output（见官方文档）</i></span></div>
  </div>`
  const price = priceBlock(v)
  const apiNote = (acc && acc.api_note) ? `<p class="api-note">⚠ ${esc(acc.api_note)}</p>` : ''
  if (ex.note) return `<div class="api-block">${facts}${price}${apiNote}<p class="muted">${ex.note}</p></div>`
  const note = ex.isLocal
    ? '<p class="muted">开放权重模型：将 Base URL 换成你自托管的推理服务（vLLM / Ollama 默认监听 <code>http://localhost:8000/v1</code>）。</p>'
    : ''
  const tab = (label, key) => `<button class="code-tab${key === 'py' ? ' selected' : ''}" data-code-tab="${key}">${label}</button>`
  const pre = (key, code) => `<pre class="code-block${key === 'py' ? '' : ' hidden'}" data-code="${key}"><code>${esc(code)}</code></pre>`
  return `<div class="api-block">${facts}${price}${apiNote}${note}
    <div class="code-tabs">${tab('Python', 'py')}${tab('JavaScript', 'js')}${tab('curl', 'curl')}<button class="copy-btn" data-copy>复制</button></div>
    ${pre('py', ex.py)}${pre('js', ex.js)}${pre('curl', ex.curl)}</div>`
}
export function specCards(v) {
  if (v.media_type) {
    const m = v.media_pricing || {}
    return [
      statCard('模态', MODALITY[modalityOf(v)].label),
      statCard('最高分辨率', esc(v.max_resolution || '—')),
      statCard('最长时长', v.max_duration_sec ? v.max_duration_sec + ' 秒' : '—'),
      statCard('原生音频', v.has_audio == null ? '—' : v.has_audio ? '支持' : '不支持'),
      statCard('单价', v.free ? '免费' : (m.price != null ? priceLabel(v) : '未公开'), v.free ? '' : (m.note || '')),
      statCard('速度档', esc(SPEED_CN[v.speed_tier] || v.speed_tier || '—')),
      statCard('开放权重', v.open_weight ? '是' : '否'),
      statCard('发布', esc(v.release_date || '—')),
    ].join('')
  }
  return [
    statCard('上下文窗口', ctxShort(v.context_window), v.context_window ? v.context_window.toLocaleString() + ' token' : ''),
    statCard('最大输出', v.max_output_tokens ? ctxShort(v.max_output_tokens) : '—', v.max_output_tokens ? v.max_output_tokens.toLocaleString() + ' token' : ''),
    statCard('输入价格', v.free ? '免费' : (v.input_price_per_mtok == null ? '未公开' : `${cur(v.currency)}${v.input_price_per_mtok}`), '每百万 token'),
    statCard('输出价格', v.free ? '免费' : (v.output_price_per_mtok == null ? '未公开' : `${cur(v.currency)}${v.output_price_per_mtok}`), '每百万 token'),
    statCard('速度档', esc(SPEED_CN[v.speed_tier] || v.speed_tier || '—')),
    statCard('视觉输入', v.vision_support ? '支持' : '不支持'),
    statCard('参数规模', esc(v.params || '未公开')),
    statCard('开放权重', v.open_weight ? '是' : '否'),
  ].join('')
}
// 参数速读：把 122B / 256K 这类数字翻译成通俗含义（Option B 解读区块）
export function paramInsight(v) {
  const items = []
  // 参数规模
  const pr = (v.params || '').trim()
  if (pr && pr !== '未公开') {
    const m = pr.match(/(\d+(?:\.\d+)?)\s*([BT])/i)
    if (m) {
      const num = parseFloat(m[1])
      const unit = m[2].toUpperCase()
      const billions = unit === 'T' ? num * 1000 : num
      let band, desc
      if (billions < 8) { band = '轻量级'; desc = '参数少、体积小，适合端侧部署、高频低延迟调用，但复杂推理能力有限。' }
      else if (billions < 30) { band = '中小规模'; desc = '在速度与质量间取得平衡，多数日常任务够用，显存占用可控。' }
      else if (billions < 70) { band = '中大型'; desc = '进入高质量区间，长文理解与复杂推理更稳，需要较好算力。' }
      else if (billions <= 150) { band = '大型稠密'; desc = '旗舰级稠密模型，推理质量高，但更吃显存与算力、速度偏慢。' }
      else { band = '超大规模'; desc = '参数规模位于顶端（多为 MoE 混合专家架构），能力最强，但对算力与上下文规划要求最高。' }
      items.push({ k: '参数规模', v: pr, band, desc })
    }
  }
  // 上下文窗口
  const cw = v.context_window
  if (cw) {
    const k = cw / 1000
    const km = k >= 1000 ? (k / 1000).toFixed(k % 1000 === 0 ? 0 : 1) + 'M' : (Number.isInteger(k) ? k : Math.round(k)) + 'K'
    const chars = Math.round(cw * 0.7)
    let band, desc
    if (cw < 32000) { band = '标准窗口'; desc = '适合单轮问答与中短文档，长文档需分段处理。' }
    else if (cw < 128000) { band = '长窗口'; desc = '可一次喂入数万字长文，胜任多数文档摘要与多轮对话。' }
    else if (cw < 256000) { band = '超长窗口'; desc = '能处理整篇论文或报告，长程依赖保持更好。' }
    else { band = '极长窗口'; desc = '可整本小说或数百页资料一次放入，适合超长文档问答、代码库级检索。' }
    items.push({ k: '上下文窗口', v: km + '（' + cw.toLocaleString() + ' token）', band, desc, tip: '约 ' + chars.toLocaleString() + ' 中文字' })
  }
  // 计费单位
  if (!v.free && (v.input_price_per_mtok != null || v.output_price_per_mtok != null)) {
    items.push({ k: '计费单位', v: '每百万 token', band: '计价基准', desc: '1M token ≈ 约 75 万中文字 ≈ 一本中等长度的书。输入/输出分别计费，输出通常更贵。' })
  }
  if (!items.length) return ''
  return `<section class="detail-sec"><h3>参数速读<small>这些数字到底意味着什么</small></h3><div class="insight-grid">${items
    .map((it) => `<article class="insight-card"><div class="insight-top"><span class="insight-k">${esc(it.k)}</span><span class="insight-band">${esc(it.band)}</span></div><b class="insight-val">${esc(it.v)}</b><p>${esc(it.desc)}</p>${it.tip ? `<small class="insight-tip">${esc(it.tip)}</small>` : ''}</article>`)
    .join('')}</div></section>`
}
// 治理 v2.0「模型生态与基准」区块：开放权重仓库 + 实时基准看板（不写死分数，避免编造）
export function ecoBlock(v) {
  const g = gradeOf(v)
  const benchLinks = [
    { n: 'Artificial Analysis', u: 'https://artificialanalysis.ai/models' },
    { n: 'LMArena', u: 'https://lmarena.ai/leaderboard' },
  ]
  const repo = v.repo_url
  const benchRow = (v.benchmarks && v.benchmarks.length)
    ? `<div class="eco-row"><b>本站基准记录</b><span><ul class="bench-list">${v.benchmarks.map((b) => `<li><b>${esc(b.name)}</b><span>${esc(b.score)}${b.source ? ` · <a href="${esc(b.source)}" target="_blank" rel="noopener">来源↗</a>` : ''}</span></li>`).join('')}</ul></span></div>`
    : ''
  const links = benchLinks.map((l) => `<a class="eco-link" href="${esc(l.u)}" target="_blank" rel="noopener">${esc(l.n)} ↗</a>`).join('')
  const repoEl = repo ? `<a class="eco-link" href="${esc(repo)}" target="_blank" rel="noopener">官方仓库 / 模型页 ↗</a>` : '<span class="muted">闭源模型，无公开仓库</span>'
  const qNote = ['C', 'D'].includes(g) ? ' · <span class="muted">完整度偏低，建议以官方文档为准</span>' : ''
  return `<section class="detail-sec"><h3>模型生态与基准<small>开放权重与第三方基准看板</small></h3>
    <div class="eco-box">
      <div class="eco-row"><b>数据质量</b><span>${gradeBadge(v)} ${v.data_quality_score || 0} 分${qNote}</span></div>
      <div class="eco-row"><b>官方仓库</b><span>${repoEl}</span></div>
      <div class="eco-row"><b>实时基准</b><span class="eco-links">${links}<p class="muted" style="margin:.4em 0 0">本站不写死基准分数（避免过时/编造），请用上方看板核对实时表现。</p></span></div>
      ${benchRow}
    </div></section>`
}
// 版本信息（来自 model_versions.json）：展示该型号的各版本与发布时间
export function versionBlockHTML(v) {
  const vs = versionsOf(v)
  if (!vs.length) return ''
  const rows = vs.map((x) => {
    const st = x.status === 'active' ? '<span class="tag tag-open">在售</span>' : (x.status ? `<span class="tag">${esc(x.status)}</span>` : '')
    const ctx = x.context_length ? `<span class="muted">· 上下文 ${ctxShort(x.context_length)}</span>` : ''
    return `<div class="ver-row"><b>${esc(x.version)}</b><span class="muted">${esc(x.release_date || '—')} ${ctx}</span>${st}</div>`
  }).join('')
  return `<section class="detail-sec"><h3>版本<small>来自 model_versions.json</small></h3>
    <div class="ver-box">${rows}</div></section>`
}
export function namingBlock(v) {
  const hay = `${v.name || ''} ${v.name_cn || ''} ${v.model_id || ''}`.toLowerCase()
  const hits = state.naming.filter((n) => hay.includes(n.term.toLowerCase()))
  if (!hits.length) return ''
  return `<section class="detail-sec"><h3>型号命名解读</h3><div class="naming-grid">${hits
    .map((n) => `<article class="naming-card"><span class="naming-term">${esc(n.term)}</span><b>${esc(n.name_cn)}</b><p>${esc(n.description_cn)}</p><small>例：${esc(n.example)}</small></article>`)
    .join('')}</div></section>`
}
export function relatedBlock(v) {
  const sib = variantsOfFamily(v.family_id).filter((x) => x.id !== v.id).slice(0, 4)
  const other = variantsOfProvider(v.provider_id).filter((x) => x.id !== v.id && x.family_id !== v.family_id).slice(0, 4)
  if (!sib.length && !other.length) return ''
  const grp = (title, list) =>
    list.length ? `<div class="rel-group"><h4>${title}</h4><div class="card-grid compact">${list.map((x) => modelCard(x)).join('')}</div></div>` : ''
  return `<section class="detail-sec"><h3>相关模型</h3>${grp('同系列其他型号', sib)}${grp('同厂商其他系列', other)}</section>`
}
