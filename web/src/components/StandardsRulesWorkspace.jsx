import { useEffect, useMemo, useState } from "react";
import GraphView from "../GraphView";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 10px 26px rgba(15,23,42,.05)" };
const muted = "#64748b";
const blue = "#2563eb";

function Badge({ children, tone = "blue" }) {
  const tones = { blue: ["#dbeafe", "#1d4ed8"], green: ["#dcfce7", "#15803d"], amber: ["#fef3c7", "#a16207"], gray: ["#f1f5f9", "#475569"] };
  const [background, color] = tones[tone] || tones.blue;
  return <span style={{ display: "inline-flex", alignItems: "center", minHeight: 22, padding: "3px 8px", borderRadius: 999, background, color, fontSize: 11, fontWeight: 850, whiteSpace: "nowrap" }}>{children}</span>;
}

function ruleTitle(rule) {
  return rule?.requirementText || [rule?.propertyName, rule?.operator, rule?.rawThreshold, rule?.unit].filter(Boolean).join(" ") || rule?.title || "未命名规则";
}

function ruleTypeLabel(type) {
  return type === "InspectionRequirement" ? "检查要求" : type === "ManagementRequirement" ? "管理要求" : "数值约束";
}

function normalizeDetail(payload, fallback) {
  if (!payload || payload.error) return fallback;
  return { ...fallback, ...payload, title: payload.title || fallback?.title, requirementText: payload.requirementText || fallback?.requirementText, evidence: payload.evidence?.length ? payload.evidence : fallback?.evidence || [] };
}

export default function StandardsRulesWorkspace() {
  const [status, setStatus] = useState(null);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [focused, setFocused] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API}/standard-rules/status`).then((response) => response.json()),
      fetch(`${API}/standard-rules/rules?limit=1000`).then((response) => response.json()),
    ]).then(([nextStatus, payload]) => {
      if (nextStatus.error || payload.error) throw new Error(nextStatus.error || payload.error);
      if (!cancelled) {
        setStatus(nextStatus);
        setItems(payload.items || []);
        if (payload.items?.length) setFocused(payload.items[0]);
      }
    }).catch((cause) => !cancelled && setError(String(cause.message || cause)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!focused?.ruleId) { setDetail(null); return undefined; }
    let cancelled = false;
    setDetail(focused);
    setDetailLoading(true);
    fetch(`${API}/standard-rules/rule/${encodeURIComponent(focused.ruleId)}`)
      .then((response) => response.json())
      .then((payload) => { if (!cancelled) setDetail(normalizeDetail(payload, focused)); })
      .catch(() => { /* list data remains visible when detail enrichment is unavailable */ })
      .finally(() => !cancelled && setDetailLoading(false));
    return () => { cancelled = true; };
  }, [focused]);

  const filtered = useMemo(() => items.filter((item) => {
    if (typeFilter && item.ruleType !== typeFilter) return false;
    return [item.title, item.clauseId, item.evidenceText, item.ruleType, item.page].join(" ").toLowerCase().includes(query.trim().toLowerCase());
  }), [items, query, typeFilter]);

  if (loading) return <div style={{ ...card, padding: 28 }}>正在读取已定稿标准规则…</div>;
  if (error) return <div style={{ ...card, padding: 18, color: "#b91c1c", background: "#fff1f2" }}>{error}</div>;

  return <div className="standards-workspace" style={{ display: "grid", gap: 16 }}>
    <style>{`@media (max-width: 980px){.standards-main-grid{grid-template-columns:1fr!important}.standards-detail{position:static!important}.standards-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media (max-width: 560px){.standards-metrics{grid-template-columns:1fr!important}.standards-toolbar{align-items:stretch!important}.standards-toolbar input,.standards-toolbar select{width:100%!important}}`}</style>
    <section style={{ ...card, padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}><div style={{ color: blue, fontSize: 12, fontWeight: 900 }}>隔离标准库 · GB 50089-2018</div><h2 style={{ margin: "6px 0", fontSize: 25 }}>标准规则库</h2><div style={{ color: muted, lineHeight: 1.7 }}>按标准、条款、规则和证据进行检索与核对。所有内容来自已定稿图谱，未混入材料风险链或 HAZOP 场景。</div></div>
        <div className="standards-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(100px,1fr))", gap: 8 }}><Metric label="已定稿规则" value={status?.ruleCount || 0} /><Metric label="当前结果" value={filtered.length} /><Metric label="证据链" value={items.filter((item) => item.evidenceText).length} /></div>
      </div>
    </section>

    <section className="standards-main-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 390px", gap: 16, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
        <div className="standards-toolbar" style={{ ...card, padding: 12, display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索规则、条款、页码或证据…" style={{ flex: "1 1 300px", minWidth: 0, border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", outline: "none" }} />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={{ width: 130, border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 9px", background: "#fff" }}><option value="">全部类型</option><option value="ManagementRequirement">管理要求</option><option value="InspectionRequirement">检查要求</option></select>
          <button onClick={() => { setQuery(""); setTypeFilter(""); }} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", background: "#fff", color: muted, cursor: "pointer" }}>清除筛选</button>
        </div>
        <div style={{ ...card, padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 4px 10px" }}><b>规则关系投影</b><Badge tone="green">已定稿图谱</Badge></div>{focused ? <GraphView graphMode="standardRule" focusRuleId={focused.ruleId} height={430} edgeLimit={80} /> : <Empty text="从下方规则清单选择记录。" />}</div>
        <div style={{ ...card, padding: 14 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b style={{ fontSize: 17 }}>规则清单</b><span style={{ color: muted, fontSize: 12 }}>共 {filtered.length} 条</span></div><div style={{ display: "grid", gap: 8, marginTop: 11, maxHeight: 560, overflowY: "auto", paddingRight: 3 }}>{filtered.map((item) => <RuleCard key={item.ruleId} item={item} selected={focused?.ruleId === item.ruleId} onClick={() => setFocused(item)} />)}{!filtered.length ? <Empty text="没有匹配的规则。" /> : null}</div></div>
      </div>
      <aside className="standards-detail" style={{ ...card, padding: 17, position: "sticky", top: 92, minHeight: 430, maxHeight: "calc(100vh - 112px)", overflowY: "auto" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14 }}><b style={{ fontSize: 18 }}>规则详情</b>{detailLoading ? <Badge tone="gray">补充证据中</Badge> : <Badge tone="green">已定稿</Badge>}</div><RuleDetail rule={detail} /></aside>
    </section>
  </div>;
}

function Metric({ label, value }) { return <div style={{ minWidth: 92, padding: "9px 11px", borderRadius: 8, background: "#f8fafc" }}><div style={{ color: muted, fontSize: 11 }}>{label}</div><div style={{ color: "#0f172a", fontSize: 22, fontWeight: 950, marginTop: 2 }}>{value}</div></div>; }
function Empty({ text }) { return <div style={{ minHeight: 120, display: "grid", placeItems: "center", color: muted, fontSize: 13 }}>{text}</div>; }
function RuleCard({ item, selected, onClick }) { return <button onClick={onClick} style={{ textAlign: "left", cursor: "pointer", border: selected ? "1px solid #2563eb" : "1px solid #e2e8f0", borderLeft: selected ? "4px solid #2563eb" : "4px solid #cbd5e1", background: selected ? "#eff6ff" : "#fff", borderRadius: 8, padding: "12px 13px", transition: "border-color 120ms ease, background 120ms ease" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}><Badge>{item.ruleType === "InspectionRequirement" ? "检查要求" : "管理要求"}</Badge>{item.evidenceText ? <Badge tone="green">有证据</Badge> : <Badge tone="gray">待补证据</Badge>}</div><span style={{ color: muted, fontSize: 12, whiteSpace: "nowrap" }}>第 {item.page || "-"} 页</span></div><div style={{ fontWeight: 850, lineHeight: 1.6, marginTop: 8, color: "#0f172a" }}>{item.title || "未命名规则"}</div><div style={{ display: "flex", gap: 14, marginTop: 7, color: muted, fontSize: 12 }}><span>条款 {item.clauseId || "未标注"}</span><span>置信度 {item.confidence === "" ? "-" : `${Math.round(Number(item.confidence) * 100)}%`}</span></div>{item.evidenceText ? <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.5, marginTop: 7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.evidenceText}</div> : null}</button>; }
function RuleDetail({ rule }) { if (!rule) return <Empty text="选择一条规则查看结构化表达、条款号和原文证据。" />; return <div style={{ display: "grid", gap: 14 }}><div style={{ padding: 12, background: "#eff6ff", borderRadius: 8, border: "1px solid #dbeafe" }}><div style={{ color: muted, fontSize: 11 }}>规则类型</div><div style={{ fontWeight: 900, marginTop: 4 }}>{ruleTypeLabel(rule.ruleType)}</div><div style={{ color: muted, fontSize: 12, marginTop: 6 }}>规则 ID：{rule.ruleId}</div></div><Info label="所属标准" value="GB 50089-2018" /><Info label="来源条款" value={rule.clause?.code || rule.clauseId || "未标注"} /><section><div style={{ color: muted, fontSize: 12 }}>结构化表达</div><div style={{ marginTop: 5, fontWeight: 850, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{ruleTitle(rule)}</div>{rule.subject || rule.action || rule.object ? <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f0", color: muted, fontSize: 12, lineHeight: 1.7 }}>主体：{rule.subject || "未明示"}<br />动作：{rule.action || "未明示"}<br />对象：{rule.object || "未明示"}</div> : null}</section><section><div style={{ color: muted, fontSize: 12 }}>原文证据</div>{(rule.evidence || []).length ? rule.evidence.map((evidence) => <div key={evidence.id} style={{ marginTop: 7, padding: 11, background: "#f8fafc", borderRadius: 8, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{evidence.text || "未记录证据文本"}<div style={{ color: muted, fontSize: 11, marginTop: 5 }}>第 {evidence.page || rule.page || "-"} 页 · {evidence.sourceBlockId || "来源单元未标注"}</div></div>) : <div style={{ marginTop: 7, color: muted, lineHeight: 1.7 }}>当前接口未返回证据明细。可在统一证据链表中查看原文定位。</div>}</section></div>; }
function Info({ label, value }) { return <div><div style={{ color: muted, fontSize: 12 }}>{label}</div><div style={{ fontWeight: 850, marginTop: 4, lineHeight: 1.55 }}>{value}</div></div>; }
