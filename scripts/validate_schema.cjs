#!/usr/bin/env node
// Phase 0 — 零依赖 JSON Schema 校验 + 数据兼容验证
// 校验 data/model_variants.json / model_variants_extra.json / providers.json
// 不依赖任何第三方库（遵循项目零依赖约定）。

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')

function loadJson(rel) {
  const p = path.join(ROOT, rel)
  if (!fs.existsSync(p)) { console.error('✗ 找不到文件: ' + rel); process.exit(2) }
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

// ---------- 极简 JSON Schema 校验器（支持 type / required / enum / properties / items / additionalProperties） ----------
function typeMatch(value, type) {
  if (type === 'null') return value === null
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value)
  if (type === 'number') return typeof value === 'number'
  if (type === 'string') return typeof value === 'string'
  if (type === 'boolean') return typeof value === 'boolean'
  if (type === 'array') return Array.isArray(value)
  if (type === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value)
  return true
}

function validate(inst, schema, at, errors) {
  if (inst === undefined) return // 必填由父级 required 负责
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!types.some((t) => typeMatch(inst, t))) {
      errors.push(at + ': 类型错误，期望 ' + types.join('|') + '，实际 ' + (inst === null ? 'null' : typeof inst))
    }
  }
  if (schema.enum && !schema.enum.includes(inst)) {
    errors.push(at + ': 值 ' + JSON.stringify(inst) + ' 不在枚举 [' + schema.enum.join(', ') + ']')
  }
  if (schema.required && typeof inst === 'object' && inst !== null && !Array.isArray(inst)) {
    for (const r of schema.required) {
      if (inst[r] === undefined) errors.push(at + ': 缺少必填字段 "' + r + '"')
    }
  }
  if (Array.isArray(inst) && schema.items) {
    inst.forEach((it, i) => validate(it, schema.items, at + '[' + i + ']', errors))
  }
  if (typeof inst === 'object' && inst !== null && !Array.isArray(inst) && schema.properties) {
    for (const key of Object.keys(schema.properties)) {
      if (inst[key] !== undefined) validate(inst[key], schema.properties[key], at + '.' + key, errors)
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(inst)) {
        if (!schema.properties[key]) errors.push(at + '.' + key + ': 不允许的额外字段')
      }
    }
  }
}

// ---------- 加载 Schema ----------
const variantSchema = loadJson('data/schema/variant.schema.json')
const providerSchema = loadJson('data/schema/provider.schema.json')

const errors = []
const warns = []

// ---------- 结构校验 ----------
for (const file of ['data/model_variants.json', 'data/model_variants_extra.json']) {
  const arr = loadJson(file)
  if (!Array.isArray(arr)) { errors.push(file + ': 应为数组'); continue }
  arr.forEach((v, i) => validate(v, variantSchema, file + '[' + i + ']', errors))
}
{
  const arr = loadJson('data/providers.json')
  if (!Array.isArray(arr)) errors.push('data/providers.json: 应为数组')
  else arr.forEach((p, i) => validate(p, providerSchema, 'providers[' + i + ']', errors))
}

// ---------- 数据兼容验证（前端关键不变量） ----------
const variantsMain = loadJson('data/model_variants.json')
const variantsExtra = loadJson('data/model_variants_extra.json')
const variants = [...variantsMain, ...variantsExtra]
const providers = loadJson('data/providers.json')
const providerIds = new Set(providers.map((p) => p.id))

const seen = new Set()
for (const v of variants) {
  if (!v.id) { errors.push('存在缺少 id 的型号'); continue }
  if (seen.has(v.id)) errors.push('重复 id: ' + v.id)
  seen.add(v.id)
  if (v.provider_id && !providerIds.has(v.provider_id)) errors.push('未知 provider_id: ' + v.provider_id + '（型号 ' + v.id + '）')
  if (v.free === true && !v.free_note) warns.push('free 型号缺少 free_note: ' + v.id)
}

// ---------- 报告 ----------
console.log('=== 数据兼容校验（Phase 0）===')
console.log('型号总数: ' + variants.length + '（主 ' + variantsMain.length + ' + 增量 ' + variantsExtra.length + '）')
console.log('厂商总数: ' + providers.length)
console.log('结构错误: ' + errors.length + '   兼容警告: ' + warns.length)
if (warns.length) warns.slice(0, 30).forEach((w) => console.log('  ⚠ ' + w))
if (errors.length) {
  console.log('\n错误明细:')
  errors.slice(0, 50).forEach((e) => console.log('  ✗ ' + e))
  console.log('\n✗ 校验失败：' + errors.length + ' 处错误')
  process.exit(1)
}
console.log('\n✓ 全部通过：Schema 结构正确，前端关键不变量完整（id 唯一 / provider_id 外键有效 / 必填齐全）')
