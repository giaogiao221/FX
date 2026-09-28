import { useEffect, useMemo, useState } from "react";
import GraphView from "../GraphView";
import {
  chainTypeLabel,
  evidenceLevelLabel,
  normalizeMaterialRiskPayload,
  riskLevelLabel,
} from "../material-risk-utils";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, boxShadow: "0 12px 30px rgba(15,23,42,.06)" };
const muted = "#64748b";

function Metric({ label, value, note }) {
  return <div style={{ ...card, padding: 16 }}><div style={{ color: muted, fontSize: 12 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 950, marginTop: 5 }}>{value ?? 0}</div><div style={{ color: muted, fontSize: 12, marginTop: 5 }}>{note}</div></div>;
}

function Badge({ children, tone = "blue" }) {
  const tones = {
    blue: ["#dbeafe", "#1d4ed8"], red: ["#fee2e2", "#b91c1c"], green: ["#dcfce7", "#15803d"], amber: ["#fef3c7", "#a16207"], gray: ["#f1f5f9", "#475569"],
  };
  const [background, color] = tones[tone] || tones.blue;
  return <span style={{ display: "inline-flex", padding: "4px 9px", borderRadius: 999, background, color, fontSize: 11, fontWeight: 850 }}>{children}</span>;
}

function ChainDetail({ chain }) {
  if (!chain) return <div style={{ color: muted, lineHeight: 1.8 }}>点击链路卡片或图中节点查看事实来源、推断规则和风险终点。</div>;
  const inferred = chain.chainType === "INFERRED";
  return <div style={{ display: "grid", gap: 12 }}>
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
      <Badge tone={inferred ? "red" : "green"}>{chainTypeLabel(chain.chainType)}</Badge>
      <Badge tone="blue">{evidenceLevelLabel(chain.evidenceLevel)}</Badge>
      <Badge tone={chain.riskLevel === "high" ? "red" : "amber"}>链路关注等级：{riskLevelLabel(chain.riskLevel)}</Badge>
    </div>
    <div><div style={{ color: muted, fontSize: 12 }}>材料</div><div style={{ fontWeight: 900, marginTop: 4 }}>{chain.materialName}</div></div>
    <div><div style={{ color: muted, fontSize: 12 }}>事实属性</div><div style={{ fontWeight: 850, marginTop: 4 }}>{chain.propertyName}</div><div style={{ marginTop: 5, lineHeight: 1.7 }}>{chain.propertyValue || "未记录原始值"}</div></div>
    {inferred ? <>
      <div><div style={{ color: muted, fontSize: 12 }}>推断路径</div><div style={{ lineHeight: 1.8, marginTop: 4 }}>{chain.triggerName || "风险刺激"} → {chain.outcomeText || "风险结果"}</div></div>
      <div><div style={{ color: muted, fontSize: 12 }}>规则</div><div style={{ marginTop: 4, fontWeight: 850 }}>{chain.ruleId} · v{chain.rule?.version || "1.0.0"}</div><div style={{ color: muted, fontSize: 12, marginTop: 4 }}>置信度 {Math.round(Number(chain.confidence || 0) * 100)}%，结论标记为系统推断，不替代人工审核。</div></div>
      <div><div style={{ color: muted, fontSize: 12 }}>推断机理</div><div style={{ marginTop: 5, lineHeight: 1.75 }}>{chain.reasoning?.rationale || chain.rule?.rationale || "由已审核材料属性命中确定性规则，再映射潜在刺激与可能后果。"}</div>{(chain.reasoning?.steps || []).length ? <ol style={{ margin: "7px 0 0", paddingLeft: 20, color: "#334155", lineHeight: 1.75 }}>{chain.reasoning.steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol> : null}</div>
      <div><div style={{ color: muted, fontSize: 12 }}>关注等级依据</div><div style={{ marginTop: 5, lineHeight: 1.7 }}>{(chain.priorityBasis || []).join("；") || "当前链路只标识风险通道，关注等级待结合分类和试验响应复核。"}</div></div>
      <div><div style={{ color: muted, fontSize: 12 }}>判定边界</div><div style={{ marginTop: 5, lineHeight: 1.7, color: "#64748b" }}>{(chain.reasoning?.limitations || []).join("；") || "该推断不计算事故概率，也不替代工艺场景风险评价。"}</div></div>
    </> : null}
    <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 11 }}><div style={{ color: muted, fontSize: 12 }}>证据来源</div><div style={{ marginTop: 4, fontWeight: 800 }}>{chain.evidence?.sourceDoc || "未记录来源文档"}{chain.evidence?.tableRow ? ` · 表格第 ${chain.evidence.tableRow} 行` : ""}</div><div style={{ color: muted, lineHeight: 1.7, marginTop: 6, whiteSpace: "pre-wrap" }}>{chain.evidence?.text || "当前事实未关联证据原文。"}</div></div>
  </div>;
}

export default function MaterialRiskWorkspace() {
  const [status, setStatus] = useState(null);
  const [chains, setChains] = useState([]);
  const [chainType, setChainType] = useState("");
  const [riskType, setRiskType] = useState("");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API}/material-risk/status`).then((r) => r.json()),
      fetch(`${API}/material-risk/chains?limit=1000`).then((r) => r.json()),
    ]).then(([statusPayload, chainPayload]) => {
      if (cancelled) return;
      if (statusPayload.error || chainPayload.error) throw new Error(statusPayload.error || chainPayload.error);
      setStatus(statusPayload);
      setChains(normalizeMaterialRiskPayload(chainPayload).items);
      setLoading(false);
    }).catch((cause) => {
      if (!cancelled) { setError(String(cause.message || cause)); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => chains.filter((chain) => {
    if (chainType && chain.chainType !== chainType) return false;
    if (riskType && chain.riskType !== riskType) return false;
    if (query) {
      const haystack = [chain.materialName, chain.propertyName, chain.propertyValue, chain.triggerName, chain.outcomeText, chain.ruleId].join(" ").toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
    }
    return true;
  }), [chains, chainType, riskType, query]);

  if (loading) return <div style={{ ...card, padding: 30 }}>正在读取材料风险链…</div>;
  if (error) return <div style={{ ...card, padding: 18, color: "#b91c1c", background: "#fff1f2" }}>{error}</div>;

  return <div style={{ display: "grid", gap: 16 }}>
    <section style={{ ...card, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div><div style={{ fontSize: 12, fontWeight: 900, color: "#2563eb" }}>材料资料域 · PRODUCT_CATALOG_V1</div><h2 style={{ margin: "7px 0 6px", fontSize: 26 }}>材料独立风险链</h2><div style={{ color: muted, lineHeight: 1.75, maxWidth: 900 }}>链路仅由材料属性、危险分类和原文证据形成，不使用产线、工序或 HAZOP 场景。实线表示入库事实，虚线表示版本化规则推断。</div></div>
        <div style={{ display: "flex", gap: 8 }}><Badge tone="green">事实链可溯源</Badge><Badge tone="red">推断链需审核</Badge></div>
      </div>
    </section>

    <section style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
      <Metric label="材料总数" value={status?.materialCount} note="当前产品目录已接受材料" />
      <Metric label="可形成风险链的材料" value={status?.materialsWithRiskChains} note="存在感度、爆发点或安定性依据" />
      <Metric label="原文事实链" value={status?.factChainCount} note="不包含规则结论" />
      <Metric label="系统推断链" value={status?.inferredChainCount} note={`${status?.ruleCount || 0}/${status?.configuredRuleCount || 0} 条规则已命中`} />
    </section>

    <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 16, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ ...card, padding: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索材料、属性、触发条件或规则…" style={{ flex: "1 1 320px", border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px" }} />
          <select value={chainType} onChange={(e) => setChainType(e.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px" }}><option value="">事实 + 推断</option><option value="FACT">仅原文事实</option><option value="INFERRED">仅系统推断</option></select>
          <select value={riskType} onChange={(e) => setRiskType(e.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px" }}><option value="">全部风险类型</option><option value="friction">摩擦</option><option value="impact">撞击/冲击</option><option value="electrostatic">静电</option><option value="flame">火焰</option><option value="thermal">异常受热</option><option value="stability">安定性边界</option></select>
        </div>
        <div style={{ ...card, padding: 12 }}>
          <div style={{ padding: "4px 5px 12px", fontWeight: 900 }}>{focused ? `单条链路：${focused.materialName}` : "材料风险链全局投影"}</div>
          <GraphView graphMode={focused ? "materialRiskSingle" : "materialRisk"} focusChainId={focused?.chainId || ""} nodeLimit={120} edgeLimit={600} height={580} />
        </div>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontWeight: 900, fontSize: 18 }}>链路清单</div><div style={{ color: muted, fontSize: 12 }}>{filtered.length} 条</div></div>
          <div style={{ display: "grid", gap: 9, marginTop: 12, maxHeight: 560, overflowY: "auto" }}>
            {filtered.map((chain) => <button key={chain.chainId} onClick={() => setFocused(chain)} style={{ textAlign: "left", border: focused?.chainId === chain.chainId ? "1px solid #2563eb" : "1px solid #e2e8f0", borderRadius: 14, background: focused?.chainId === chain.chainId ? "#eff6ff" : "#fff", padding: 13, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div style={{ fontWeight: 900 }}>{chain.materialName}</div><Badge tone={chain.chainType === "FACT" ? "green" : "red"}>{chainTypeLabel(chain.chainType)}</Badge></div>
              <div style={{ marginTop: 7, color: muted, lineHeight: 1.6 }}>{chain.propertyName}：{chain.propertyValue || "已记录"}</div>
              {chain.chainType === "INFERRED" ? <div style={{ marginTop: 6, color: "#334155" }}>{chain.triggerName} → {chain.outcomeText}</div> : null}
            </button>)}
          </div>
        </div>
      </div>
      <aside style={{ ...card, padding: 17, position: "sticky", top: 92 }}><div style={{ fontWeight: 900, fontSize: 18, marginBottom: 14 }}>链路解释与证据</div><ChainDetail chain={focused} /></aside>
    </section>
  </div>;
}
