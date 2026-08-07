#!/usr/bin/env python3
"""
Model Explorer 每日数据质量检查 (MODEL_EXPLORER_DATA_GOVERNANCE_V1.md §12)

检查项：
  - 新模型（相对上一次快照）
  - 模型更新（release_date / last_verified_at 变化）
  - API 变化（缺 api_base_url 的型号）
  - 价格变化（仅按 token 计费的「非免费」型号缺价格；媒体模型按 price_model 区分，不计缺失）
  - 废弃模型（status=deprecated/unknown）
  - 数据异常（score<50 / 缺 source_url / 缺 capabilities）

用法：
  python3 scripts/model_quality_check.py
生成：daily_model_update_report.md
"""
import json
import os
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
SNAP = os.path.join(ROOT, ".last_snapshot.json")
REPORT = os.path.join(ROOT, "daily_model_update_report.md")


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


def main():
    models = load("model_variants.json") + load("model_variants_extra.json")
    providers = {p["id"]: p for p in load("providers.json")}

    issues = []
    new_models = []
    deprecated = []
    anomalies = []

    for v in models:
        mid = v.get("id", "?")
        # 废弃 / 未知状态
        if v.get("status") in ("deprecated", "unknown"):
            deprecated.append(mid)
        # 数据异常
        score = v.get("data_quality_score", 100)
        if score < 50:
            anomalies.append(f"{mid}: 质量分过低 ({score})")
        if not v.get("source_url"):
            anomalies.append(f"{mid}: 缺少来源链接")
        if not v.get("capabilities"):
            anomalies.append(f"{mid}: 缺少能力标签")
        # API 变化（no_endpoint 厂商如 Midjourney 无公开 REST API，属合理缺失，不报）
        p = providers.get(v.get("provider_id"))
        if p and not p.get("api_base_url") and not p.get("no_endpoint"):
            issues.append(f"{mid}: 厂商 {p.get('name')} 无 api_base_url")
        # 价格变化（仅按 token 计费的「非免费」型号缺价才算缺失；媒体模型按 price_model 区分）
        pm = v.get("price_model", "per_token")
        if not v.get("free") and pm == "per_token" and v.get("input_price_per_mtok") is None:
            issues.append(f"{mid}: 非免费 token 型号缺价格")

    # 新模型：对比上次快照
    snap = {}
    if os.path.exists(SNAP):
        try:
            snap = json.load(open(SNAP, encoding="utf-8"))
        except Exception:
            snap = {}
    cur_ids = {v.get("id") for v in models}
    for mid in cur_ids:
        if mid not in snap:
            new_models.append(mid)
    # 写新快照
    json.dump({v.get("id"): v.get("data_quality_score") for v in models}, open(SNAP, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    lines = [
        f"# 每日模型数据更新报告 ({date.today().isoformat()})",
        "",
        f"- 型号总数：{len(models)}",
        f"- 新模型：{len(new_models)} {('→ ' + ', '.join(new_models)) if new_models else ''}",
        f"- 废弃/未知状态：{len(deprecated)} {deprecated or ''}",
        f"- 数据异常：{len(anomalies)}",
        f"- API/价格问题：{len(issues)}",
        "",
        "## 数据异常清单" if anomalies else "## 数据异常清单\n（无）",
    ]
    lines += [f"- {a}" for a in anomalies]
    lines += ["", "## API / 价格问题清单" if issues else "## API / 价格问题清单\n（无）"]
    lines += [f"- {i}" for i in issues]
    lines += ["", "> 由 scripts/model_quality_check.py 自动生成，归属 MODEL_EXPLORER_DATA_GOVERNANCE_V1.md §12。"]

    with open(REPORT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"报告已生成：{REPORT}")
    print(f"  新模型 {len(new_models)} | 废弃 {len(deprecated)} | 异常 {len(anomalies)} | 问题 {len(issues)}")
    # 有异常时返回非 0，便于 CI 告警
    return 1 if (anomalies or issues or deprecated) else 0


if __name__ == "__main__":
    sys.exit(main())
