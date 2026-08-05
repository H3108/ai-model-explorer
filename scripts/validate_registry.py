"""Validate the static Model Registry relationships and required fields."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
FILES = ["providers", "models", "pricing", "capabilities", "api", "categories", "recommendations"]

def load(name):
    with (DATA / f"{name}.json").open(encoding="utf-8") as handle:
        return json.load(handle)

def main():
    registry = {name: load(name) for name in FILES}
    provider_ids = {item["id"] for item in registry["providers"]}
    model_ids = {item["id"] for item in registry["models"]}
    assert len(provider_ids) == len(registry["providers"]), "duplicate provider id"
    assert len(model_ids) == len(registry["models"]), "duplicate model id"
    assert all(item["provider_id"] in provider_ids for item in registry["models"]), "model provider_id is missing"
    assert {item["model_id"] for item in registry["pricing"]} == model_ids, "pricing coverage mismatch"
    assert {item["model_id"] for item in registry["capabilities"]} == model_ids, "capability coverage mismatch"
    assert {item["provider"] for item in registry["api"]} == provider_ids, "api provider coverage mismatch"
    for model in registry["models"]:
        for field in ("id", "provider_id", "model_name", "display_name_cn", "model_family", "model_type", "description_cn", "usage_example_cn", "best_for", "avoid_for", "performance_level", "cost_level"):
            assert field in model, f"{model['id']} missing {field}"
    print("REGISTRY_VALID", {name: len(registry[name]) if isinstance(registry[name], list) else "object" for name in FILES})

if __name__ == "__main__":
    main()
