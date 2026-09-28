import { useEffect, useMemo, useState } from "react";
import {
  formatRisk,
  normalizeHazopLine,
  normalizeHazopProcess,
  normalizeHazopScenario,
  riskTone,
} from "../hazop-utils";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const colors = {
  ink: "#0f172a",
  muted: "#64748b",
  border: "rgba(148,163,184,.22)",
  primary: "#2563eb",
  primarySoft: "#eff6ff",
  card: "#ffffff",
  critical: ["#fef2f2", "#b91c1c", "#fecaca"],
  high: ["#fff7ed", "#c2410c", "#fed7aa"],
  medium: ["#fffbeb", "#a16207", "#fde68a"],
  low: ["#ecfdf5", "#047857", "#a7f3d0"],
  unknown: ["#f8fafc", "#475569", "#e2e8f0"],
};

const panel = {
  background: colors.card,
  border: `1px solid ${colors.border}`,
  borderRadius: 20,
  boxShadow: "0 12px 30px rgba(15,23,42,.05)",
};

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || `请求失败：${response.status}`);
  return data;
}

function Metric({ label, value, helper }) {
  return (
    <div style={{ ...panel, padding: 16, minWidth: 0 }}>
      <div style={{ color: colors.muted, fontSize: 12, fontWeight: 800 }}>{label}</div>
      <div style={{ color: colors.ink, fontSize: 26, fontWeight: 950, marginTop: 7 }}>{value ?? "—"}</div>
      {helper ? <div style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{helper}</div> : null}
    </div>
  );
}

function Badge({ children, tone = "unknown" }) {
  const [background, color, borderColor] = colors[tone] || colors.unknown;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${borderColor}`, background, color, borderRadius: 999, padding: "4px 8px", fontWeight: 850, fontSize: 12 }}>
      {children}
    </span>
  );
}

function RiskBadge({ level, severity, likelihood, label }) {
  return (
    <div style={{ padding: 11, borderRadius: 14, background: colors[riskTone(level)]?.[0] || colors.unknown[0], border: `1px solid ${colors[riskTone(level)]?.[2] || colors.unknown[2]}` }}>
      <div style={{ color: colors.muted, fontSize: 11, fontWeight: 850 }}>{label}</div>
      <div style={{ color: colors[riskTone(level)]?.[1] || colors.unknown[1], fontWeight: 950, marginTop: 4 }}>
        {formatRisk(level, severity, likelihood)}
      </div>
    </div>
  );
}

function Loading({ text }) {
  return <div style={{ ...panel, padding: 24, textAlign: "center", color: colors.muted }}>{text}</div>;
}

function Empty({ title, text }) {
  return (
    <div style={{ ...panel, padding: 24, textAlign: "center" }}>
      <div style={{ fontWeight: 900, color: colors.ink }}>{title}</div>
      <div style={{ marginTop: 7, color: colors.muted, lineHeight: 1.65, fontSize: 13 }}>{text}</div>
    </div>
  );
}

function NodeList({ title, items, emptyText, tone = "slate" }) {
  return (
    <section style={{ ...panel, padding: 15, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ color: colors.ink, fontWeight: 900 }}>{title}</div>
        <Badge tone={tone === "red" ? "critical" : tone === "green" ? "low" : "unknown"}>{items.length}</Badge>
      </div>
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        {items.length ? items.map((item) => (
          <div key={item.id || item.name} style={{ padding: 11, borderRadius: 12, border: `1px solid ${colors.border}`, background: "#fbfdff", color: colors.ink, lineHeight: 1.55, fontSize: 13 }}>
            {item.name}
          </div>
        )) : <div style={{ color: colors.muted, fontSize: 13 }}>{emptyText}</div>}
      </div>
    </section>
  );
}

function ProcessTimeline({ processes, selectedId, onSelect }) {
  return (
    <div className="hazop-process-scroll" style={{ ...panel, padding: 15, overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: 9, minWidth: "max-content" }}>
        {processes.map((process, index) => (
          <div key={process.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <button
              type="button"
              onClick={() => onSelect(process)}
              style={{
                width: 220,
                minHeight: 108,
                textAlign: "left",
                borderRadius: 16,
                border: selectedId === process.id ? "2px solid #60a5fa" : `1px solid ${colors.border}`,
                background: selectedId === process.id ? colors.primarySoft : "#fff",
                padding: 13,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <Badge>{process.nodeCode || `工序 ${process.processOrder}`}</Badge>
                <span style={{ color: colors.primary, fontSize: 12, fontWeight: 900 }}>{process.scenarioCount} 场景</span>
              </div>
              <div style={{ color: colors.ink, fontWeight: 900, lineHeight: 1.45, marginTop: 9 }}>{process.displayName}</div>
              <div style={{ color: colors.muted, fontSize: 11, marginTop: 7 }}>{process.causeCount} 原因 · {process.consequenceCount} 后果 · {process.controlCount} 控制</div>
            </button>
            {index < processes.length - 1 ? (
              <div title="NEXT_PROCESS" style={{ color: colors.primary, fontWeight: 950, fontSize: 24 }}>→</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScenarioCard({ item, active, onClick }) {
  const tone = riskTone(item.initialRisk);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: 12,
        borderRadius: 14,
        border: active ? "2px solid #60a5fa" : `1px solid ${colors.border}`,
        background: active ? colors.primarySoft : "#fff",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ fontWeight: 950, color: colors.ink }}>{item.serialNo || "无序号"}</div>
        <Badge tone={tone}>{item.initialRisk || "未定级"}</Badge>
      </div>
      <div style={{ color: colors.ink, fontWeight: 800, lineHeight: 1.5, marginTop: 7 }}>{item.deviation || item.name}</div>
      <div style={{ color: colors.muted, fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>{item.description || item.name}</div>
      <div style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>{item.causeCount} 原因 · {item.consequenceCount} 后果 · {item.controlCount} 控制</div>
    </button>
  );
}

function ScenarioChain({ detail }) {
  const event = detail.event;
  const triggerNames = [...(detail.abnormalities || []), ...(detail.causes || [])];
  const consequences = detail.consequences || [];
  return (
    <section style={{ ...panel, padding: 17 }}>
      <div style={{ fontWeight: 900, color: colors.ink }}>场景风险链</div>
      <div className="hazop-chain" style={{ display: "grid", gridTemplateColumns: "minmax(170px,1fr) 36px minmax(220px,1.2fr) 36px minmax(170px,1fr)", alignItems: "stretch", gap: 8, marginTop: 13 }}>
        <div style={{ padding: 13, borderRadius: 15, background: "#fff7ed", border: "1px solid #fed7aa" }}>
          <div style={{ color: "#9a3412", fontSize: 12, fontWeight: 900 }}>偏差 / 失控原因</div>
          <div style={{ color: colors.ink, fontWeight: 900, marginTop: 7 }}>{event.parameter || "参数"} · {event.deviation || "偏差"}</div>
          <div style={{ display: "grid", gap: 5, marginTop: 8, color: colors.muted, fontSize: 12 }}>
            {triggerNames.slice(0, 4).map((item) => <div key={item.id}>• {item.name}</div>)}
            {!triggerNames.length ? <div>记录中未填写原因</div> : null}
          </div>
        </div>
        <div style={{ display: "grid", placeItems: "center", color: colors.primary, fontSize: 24, fontWeight: 950 }}>→</div>
        <div style={{ padding: 13, borderRadius: 15, background: colors.primarySoft, border: "2px solid #93c5fd" }}>
          <div style={{ color: colors.primary, fontSize: 12, fontWeight: 900 }}>HAZOP 场景</div>
          <div style={{ color: colors.ink, fontWeight: 950, marginTop: 7, lineHeight: 1.5 }}>{event.name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 11 }}>
            <RiskBadge label="初始风险" level={event.initialRisk} severity={event.initialSeverity} likelihood={event.initialLikelihood} />
            <RiskBadge label="残余风险" level={event.residualRisk} severity={event.residualSeverity} likelihood={event.residualLikelihood} />
          </div>
        </div>
        <div style={{ display: "grid", placeItems: "center", color: colors.primary, fontSize: 24, fontWeight: 950 }}>→</div>
        <div style={{ padding: 13, borderRadius: 15, background: "#fef2f2", border: "1px solid #fecaca" }}>
          <div style={{ color: "#b91c1c", fontSize: 12, fontWeight: 900 }}>可能后果</div>
          <div style={{ display: "grid", gap: 7, marginTop: 8, color: colors.ink, fontSize: 13, lineHeight: 1.5 }}>
            {consequences.slice(0, 5).map((item) => <div key={item.id}>• {item.name}</div>)}
            {!consequences.length ? <div style={{ color: colors.muted }}>记录中未填写后果</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function InvolvedItems({ items, onOpenMaterial }) {
  return (
    <section style={{ ...panel, padding: 15 }}>
      <div style={{ fontWeight: 900, color: colors.ink }}>涉及设备与物料</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {items.length ? items.map((item) => item.materialProfile ? (
          <button
            type="button"
            key={item.id}
            onClick={() => onOpenMaterial?.(item.materialProfile)}
            style={{ border: "1px solid #bfdbfe", background: colors.primarySoft, color: "#1d4ed8", borderRadius: 12, padding: "9px 11px", cursor: "pointer", fontWeight: 850 }}
            title="打开旧图中的物料画像与分子结构"
          >
            {item.name} → 物料画像
          </button>
        ) : (
          <span key={item.id} style={{ border: `1px solid ${colors.border}`, background: "#f8fafc", color: colors.ink, borderRadius: 12, padding: "9px 11px", fontWeight: 800 }}>
            {item.name} · {item.type}
          </span>
        )) : <span style={{ color: colors.muted, fontSize: 13 }}>当前场景未关联设备或物料。</span>}
      </div>
    </section>
  );
}

function EvidencePanel({ evidence, event }) {
  const source = evidence[0]?.source || event.source || {};
  return (
    <section style={{ ...panel, padding: 15 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ fontWeight: 900, color: colors.ink }}>证据与原始定位</div>
        <Badge>{evidence.length} 条</Badge>
      </div>
      <div style={{ marginTop: 11, padding: 12, borderRadius: 13, background: "#f8fafc", color: colors.muted, fontSize: 12, lineHeight: 1.7 }}>
        <div><strong style={{ color: colors.ink }}>来源文件：</strong>{source.document || event.source?.document || "—"}</div>
        <div><strong style={{ color: colors.ink }}>来源位置：</strong>{source.sheet || event.source?.sheet || "—"}!{source.excelRow ?? event.source?.excelRow ?? "—"}</div>
      </div>
      <div style={{ display: "grid", gap: 9, marginTop: 10 }}>
        {evidence.map((item) => (
          <div key={item.id} style={{ borderLeft: "4px solid #60a5fa", background: "#fbfdff", padding: "11px 12px", borderRadius: "0 12px 12px 0", color: colors.ink, lineHeight: 1.65, fontSize: 13 }}>
            {item.evidenceText}
          </div>
        ))}
        {!evidence.length ? <div style={{ color: colors.muted, fontSize: 13 }}>当前场景暂无单独的来源记录。</div> : null}
      </div>
    </section>
  );
}

export default function HazopWorkspace({ onOpenMaterial }) {
  const [status, setStatus] = useState(null);
  const [lines, setLines] = useState([]);
  const [selectedLine, setSelectedLine] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState("lines");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([getJson(`${API}/hazop/status`), getJson(`${API}/hazop/lines`)])
      .then(([statusData, lineData]) => {
        if (cancelled) return;
        const normalizedLines = (lineData.items || []).map(normalizeHazopLine);
        setStatus(statusData);
        setLines(normalizedLines);
        setSelectedLine(normalizedLines[0] || null);
      })
      .catch((cause) => { if (!cancelled) setError(String(cause)); })
      .finally(() => { if (!cancelled) setLoading(""); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedLine?.lineCode) return undefined;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading("processes");
      setProcesses([]);
      setSelectedProcess(null);
      setScenarios([]);
      setSelectedScenario(null);
      setDetail(null);
      try {
        const data = await getJson(`${API}/hazop/line/${encodeURIComponent(selectedLine.lineCode)}/processes`);
        if (cancelled) return;
        const normalized = (data.items || []).map(normalizeHazopProcess)
          .sort((left, right) => left.processOrder - right.processOrder);
        setProcesses(normalized);
        setSelectedProcess(normalized[0] || null);
      } catch (cause) {
        if (!cancelled) setError(String(cause));
      } finally {
        if (!cancelled) setLoading("");
      }
    })();
    return () => { cancelled = true; };
  }, [selectedLine]);

  useEffect(() => {
    if (!selectedProcess?.id) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading("scenarios");
      setScenarios([]);
      setSelectedScenario(null);
      setDetail(null);
      getJson(`${API}/hazop/process/${encodeURIComponent(selectedProcess.id)}/scenarios?q=${encodeURIComponent(query)}&limit=300`)
        .then((data) => {
          if (cancelled) return;
          const normalized = (data.items || []).map(normalizeHazopScenario);
          setScenarios(normalized);
          setSelectedScenario(normalized[0] || null);
        })
        .catch((cause) => { if (!cancelled) setError(String(cause)); })
        .finally(() => { if (!cancelled) setLoading(""); });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedProcess, query]);

  useEffect(() => {
    if (!selectedScenario?.id) return undefined;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading("detail");
      setDetail(null);
      try {
        const data = await getJson(`${API}/hazop/scenario/${encodeURIComponent(selectedScenario.id)}`);
        if (!cancelled) setDetail(data);
      } catch (cause) {
        if (!cancelled) setError(String(cause));
      } finally {
        if (!cancelled) setLoading("");
      }
    })();
    return () => { cancelled = true; };
  }, [selectedScenario]);

  const selectedLineStats = useMemo(() => selectedLine || {
    processCount: 0, scenarioCount: 0, causeCount: 0, controlCount: 0,
  }, [selectedLine]);

  return (
    <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
      <style>{`
        @media (max-width: 1120px) {
          .hazop-body { grid-template-columns: 1fr !important; }
          .hazop-scenario-list { position: static !important; max-height: none !important; }
        }
        @media (max-width: 900px) {
          .hazop-metrics { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
          .hazop-chain { grid-template-columns: 1fr !important; }
          .hazop-chain > div:nth-child(2), .hazop-chain > div:nth-child(4) { transform: rotate(90deg); min-height: 30px; }
          .hazop-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <section style={{ ...panel, padding: 22, background: "linear-gradient(135deg,#0f172a,#1e3a8a 72%,#2563eb)", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div style={{ opacity: .78, fontSize: 12, fontWeight: 850 }}>生产线 HAZOP 分析</div>
            <h1 style={{ margin: "7px 0 8px", fontSize: 30 }}>HAZOP 分析</h1>
            <div style={{ maxWidth: 850, opacity: .86, lineHeight: 1.7 }}>
              按生产线和工序查看偏差、原因、可能后果、现有保护措施、建议措施及来源记录。
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge tone={status?.nextProcessCount === 9 ? "low" : "high"}>工序链路：{status?.nextProcessCount === 9 ? "完整" : "待完善"}</Badge>
          </div>
        </div>
      </section>

      {error ? <div style={{ ...panel, padding: 13, color: "#b91c1c", background: "#fef2f2" }}>{error}</div> : null}

      <div className="hazop-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
        <Metric label="生产线" value={status?.lineCount ?? lines.length} helper="DA / H / R" />
        <Metric label="当前生产线工序" value={selectedLineStats.processCount} helper={selectedLineStats.name || "请选择生产线"} />
        <Metric label="当前生产线场景" value={selectedLineStats.scenarioCount} helper={`${selectedLineStats.causeCount} 条原因记录`} />
        <Metric label="保护措施" value={selectedLineStats.controlCount} helper={`${selectedLineStats.recommendationCount} 条建议措施`} />
      </div>

      <section style={{ ...panel, padding: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: colors.muted, fontSize: 12, fontWeight: 850, marginRight: 3 }}>生产线</span>
          {lines.map((line) => (
            <button
              type="button"
              key={line.lineCode}
              onClick={() => setSelectedLine(line)}
              style={{ border: selectedLine?.lineCode === line.lineCode ? "2px solid #60a5fa" : `1px solid ${colors.border}`, borderRadius: 13, background: selectedLine?.lineCode === line.lineCode ? colors.primarySoft : "#fff", padding: "9px 12px", cursor: "pointer", color: colors.ink, fontWeight: 900 }}
            >
              {line.name} · {line.scenarioCount}
            </button>
          ))}
        </div>
      </section>

      {loading === "lines" || loading === "processes" ? <Loading text="正在读取生产线和工序…" /> : processes.length ? (
        <ProcessTimeline processes={processes} selectedId={selectedProcess?.id} onSelect={setSelectedProcess} />
      ) : <Empty title="没有工序数据" text="当前未获取到工序数据，请检查生产线与工序关联。" />}

      <div className="hazop-body" style={{ display: "grid", gridTemplateColumns: "340px minmax(0,1fr)", gap: 16, alignItems: "start" }}>
        <aside className="hazop-scenario-list" style={{ ...panel, padding: 14, position: "sticky", top: 92, maxHeight: "calc(100vh - 112px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <div style={{ fontWeight: 900, color: colors.ink }}>场景清单</div>
            <Badge>{scenarios.length}</Badge>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索偏差、后果、序号…"
            style={{ width: "100%", border: "1px solid #dbe3ef", borderRadius: 12, padding: "10px 11px", outline: "none", marginTop: 11 }}
          />
          <div style={{ display: "grid", gap: 8, marginTop: 10, overflowY: "auto", paddingRight: 3 }}>
            {loading === "scenarios" ? <div style={{ color: colors.muted, padding: 12 }}>正在读取场景…</div> : scenarios.map((scenario) => (
              <ScenarioCard key={scenario.id} item={scenario} active={selectedScenario?.id === scenario.id} onClick={() => setSelectedScenario(scenario)} />
            ))}
            {!loading && !scenarios.length ? <div style={{ color: colors.muted, padding: 12 }}>当前工序没有匹配场景。</div> : null}
          </div>
        </aside>

        <main style={{ minWidth: 0, display: "grid", gap: 14 }}>
          {loading === "detail" ? <Loading text="正在展开场景风险链…" /> : detail?.event ? (
            <>
              <ScenarioChain detail={detail} />
              <div className="hazop-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <NodeList title="现有保护措施" items={detail.controls || []} emptyText="记录中未填写现有保护措施。" tone="green" />
                <NodeList title="建议措施" items={detail.recommendations || []} emptyText="该场景没有新增建议措施。" tone="red" />
              </div>
              <InvolvedItems items={detail.involved || []} onOpenMaterial={onOpenMaterial} />
              <EvidencePanel evidence={detail.evidence || []} event={detail.event} />
            </>
          ) : <Empty title="请选择一个 HAZOP 场景" text="从左侧选择场景，查看原因、后果、现有保护措施、建议措施和来源记录。" />}
        </main>
      </div>
    </div>
  );
}
