function toNumber(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function toText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

export function riskTone(level) {
  const value = toText(level).toUpperCase();
  if (value === "S" || value === "E" || value === "EXTREME") return "critical";
  if (value === "H" || value === "HIGH") return "high";
  if (value === "M" || value === "MEDIUM") return "medium";
  if (value === "L" || value === "LOW") return "low";
  return "unknown";
}

export function formatRisk(level, severity = "", likelihood = "") {
  const risk = toText(level, "—");
  const severityText = toText(severity);
  const likelihoodText = toText(likelihood);
  return severityText || likelihoodText
    ? `${risk} · ${severityText || "—"}/${likelihoodText || "—"}`
    : risk;
}

export function normalizeHazopLine(value = {}) {
  return {
    lineCode: toText(value.lineCode || value.code).toUpperCase(),
    name: toText(value.name, "未命名生产线"),
    processCount: toNumber(value.processCount),
    scenarioCount: toNumber(value.scenarioCount),
    causeCount: toNumber(value.causeCount),
    consequenceCount: toNumber(value.consequenceCount),
    controlCount: toNumber(value.controlCount),
    recommendationCount: toNumber(value.recommendationCount),
  };
}

export function normalizeHazopProcess(value = {}) {
  return {
    id: toText(value.id),
    dbId: toText(value.dbId),
    lineCode: toText(value.lineCode).toUpperCase(),
    nodeCode: toText(value.nodeCode).toUpperCase(),
    processOrder: toNumber(value.processOrder, 999),
    name: toText(value.name, "未命名工序"),
    displayName: toText(value.displayName || value.name, "未命名工序"),
    description: toText(value.description),
    scenarioCount: toNumber(value.scenarioCount),
    causeCount: toNumber(value.causeCount),
    consequenceCount: toNumber(value.consequenceCount),
    controlCount: toNumber(value.controlCount),
    recommendationCount: toNumber(value.recommendationCount),
  };
}

export function normalizeHazopScenario(value = {}) {
  return {
    id: toText(value.id),
    dbId: toText(value.dbId),
    serialNo: toText(value.serialNo),
    name: toText(value.name, "未命名 HAZOP 场景"),
    description: toText(value.description),
    parameter: toText(value.parameter),
    deviation: toText(value.deviation),
    initialSeverity: toText(value.initialSeverity),
    initialLikelihood: toText(value.initialLikelihood),
    initialRisk: toText(value.initialRisk),
    residualSeverity: toText(value.residualSeverity),
    residualLikelihood: toText(value.residualLikelihood),
    residualRisk: toText(value.residualRisk),
    recommendationCategory: toText(value.recommendationCategory),
    recommendationNo: toText(value.recommendationNo),
    responsibleParty: toText(value.responsibleParty),
    remarks: toText(value.remarks),
    source: value.source && typeof value.source === "object" ? value.source : {},
    causeCount: toNumber(value.causeCount),
    abnormalCount: toNumber(value.abnormalCount),
    consequenceCount: toNumber(value.consequenceCount),
    controlCount: toNumber(value.controlCount),
    recommendationCount: toNumber(value.recommendationCount),
    involvedCount: toNumber(value.involvedCount),
  };
}
