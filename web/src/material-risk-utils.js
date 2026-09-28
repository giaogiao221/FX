export function chainTypeLabel(value) {
  return String(value || "").toUpperCase() === "FACT" ? "原文事实" : "系统推断";
}

export function evidenceLevelLabel(value) {
  return value === "explicit_fact" ? "事实证据" : value === "rule_inference" ? "规则推断" : "未标注";
}

export function riskLevelLabel(value) {
  const labels = { high: "高", "medium-high": "较高", medium: "中", low: "低" };
  return labels[value] || "待评估";
}

export function normalizeMaterialRiskPayload(payload = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  return {
    ...payload,
    datasetId: payload.datasetId || "PRODUCT_CATALOG_V1",
    materialCount: Number(payload.materialCount || 0),
    items: items.map((item) => ({
      ...item,
      materialName: item.material?.name || "未命名材料",
      propertyName: item.property?.name || "风险属性",
      propertyValue: item.property?.rawValue || "",
      triggerName: item.trigger?.name || "",
      outcomeText: (item.outcomes || []).map((outcome) => outcome.name).filter(Boolean).join("、"),
      ruleId: item.rule?.ruleId || "",
    })),
  };
}
