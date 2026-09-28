import { useCallback, useEffect, useMemo, useState } from "react";
import GraphView from "./GraphView";
import MaterialStructurePanel from "./components/MaterialStructurePanel";
import HazopWorkspace from "./components/HazopWorkspace";
import MaterialRiskWorkspace from "./components/MaterialRiskWorkspace";
import StandardsRulesWorkspace from "./components/StandardsRulesWorkspace";
import { normalizeStructureResponse } from "./structure-utils";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const RELATION_TITLES = {
  HAS_HAZARD: "危险特性",
  HAS_EXPOSURE_ROUTE: "侵入途径",
  CAUSES_HEALTH_EFFECT: "健康影响",
  CAUSES_HEALTH_HAZARD: "健康危害",
  REQUIRES_CONTROL_MEASURE: "控制措施",
  ALLOWS_FIREFIGHTING_AGENT: "适用灭火介质",
  PROHIBITS_FIREFIGHTING_AGENT: "禁止灭火介质",
  INEFFECTIVE_FIREFIGHTING_AGENT: "无效灭火介质",
  INCOMPATIBLE_WITH: "禁忌接触",
  REQUIRES_FIRST_AID: "急救措施",
  REQUIRES_FIREFIGHTING: "灭火要求",
  REQUIRES_SPILL_RESPONSE: "泄漏处置",
  REQUIRES_STORAGE_CONTROL: "储运控制",
};

const PROPERTY_GROUP_ORDER = ["基本信息", "理化性质", "安全特性", "能量特性", "其他属性"];

const palette = {
  bg: "#f4f7fb",
  card: "#ffffff",
  ink: "#0f172a",
  muted: "#64748b",
  border: "rgba(148,163,184,.18)",
  primary: "#2563eb",
  primarySoft: "#eff6ff",
  danger: "#dc2626",
  dangerSoft: "#fef2f2",
  success: "#059669",
  successSoft: "#ecfdf5",
  amber: "#d97706",
  amberSoft: "#fffbeb",
};

const card = {
  background: palette.card,
  border: `1px solid ${palette.border}`,
  borderRadius: 22,
  boxShadow: "0 14px 36px rgba(15,23,42,.06)",
};

function Pill({ children, tone = "blue" }) {
  const tones = {
    blue: ["#eff6ff", "#1d4ed8", "#bfdbfe"],
    red: ["#fef2f2", "#b91c1c", "#fecaca"],
    green: ["#ecfdf5", "#047857", "#a7f3d0"],
    amber: ["#fffbeb", "#b45309", "#fde68a"],
    slate: ["#f8fafc", "#475569", "#e2e8f0"],
  };
  const [background, color, border] = tones[tone] || tones.blue;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 999, fontSize: 12, fontWeight: 800, background, color, border: `1px solid ${border}` }}>
      {children}
    </span>
  );
}

function MetricCard({ label, value, helper, tone = "blue" }) {
  const tones = {
    blue: ["#eff6ff", "#1d4ed8"],
    green: ["#ecfdf5", "#047857"],
    amber: ["#fffbeb", "#b45309"],
    red: ["#fef2f2", "#b91c1c"],
  };
  const [background, color] = tones[tone] || tones.blue;
  return (
    <div style={{ ...card, padding: 18, background }}>
      <div style={{ fontSize: 13, color, fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 30, color: palette.ink, fontWeight: 950, marginTop: 8 }}>{value ?? "-"}</div>
      <div style={{ fontSize: 12, color: palette.muted, marginTop: 5 }}>{helper}</div>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div style={{ ...card, padding: 30, textAlign: "center", color: palette.muted }}>
      <div style={{ fontSize: 18, color: palette.ink, fontWeight: 900 }}>{title}</div>
      <div style={{ marginTop: 8, lineHeight: 1.7 }}>{text}</div>
    </div>
  );
}

function LoadingBlock({ text = "正在读取图谱数据…" }) {
  return (
    <div style={{ ...card, padding: 28, textAlign: "center", color: palette.muted }}>
      <div style={{ width: 30, height: 30, border: "3px solid #dbeafe", borderTopColor: palette.primary, borderRadius: "50%", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
      {text}
    </div>
  );
}

function MaterialCard({ item, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: 14,
        borderRadius: 16,
        border: selected ? "1.5px solid #60a5fa" : `1px solid ${palette.border}`,
        background: selected ? "#eff6ff" : "#fff",
        cursor: "pointer",
        boxShadow: selected ? "0 8px 20px rgba(37,99,235,.10)" : "none",
      }}
    >
      <div style={{ fontWeight: 900, color: palette.ink, lineHeight: 1.4 }}>{item.name}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
        <Pill tone="blue">{item.category || "未分类"}</Pill>
        {(item.hazardCodes || []).slice(0, 2).map((code) => <Pill key={code} tone="red">危险分类 {String(code).replace(/^UN\s*/i, "")}</Pill>)}
      </div>
      {(item.variantCode || item.casNumbers?.length) ? (
        <div style={{ marginTop: 9, color: palette.muted, fontSize: 12 }}>
          {item.variantCode ? `型号：${item.variantCode}` : ""}
          {item.variantCode && item.casNumbers?.length ? " · " : ""}
          {item.casNumbers?.length ? `CAS：${item.casNumbers.join("、")}` : ""}
        </div>
      ) : null}
    </button>
  );
}

function Overview({ summary, materials, onSelect }) {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ ...card, padding: 26, background: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 72%,#2563eb 100%)", color: "#fff" }}>
        <div style={{ fontSize: 13, fontWeight: 800, opacity: .8 }}>风险辨识预测系统 · 危险物料子图</div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34, letterSpacing: -1 }}>危险物料风险知识图谱</h1>
        <div style={{ maxWidth: 760, lineHeight: 1.75, opacity: .86 }}>
          系统统一管理全材料目录、材料风险画像、风险预测链路和证据追溯，并按业务场景组织知识图谱，支撑危险物料查询、风险辨识、管控措施关联与结果追溯。
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
        <MetricCard label="危险物料" value={summary?.counts?.materials} helper="独立物料实例" tone="blue" />
        <MetricCard label="物料类别" value={summary?.counts?.categories} helper="火工药剂、炸药、发射药等" tone="green" />
        <MetricCard label="原文危险分类" value={summary?.counts?.hazardClasses} helper={`${summary?.counts?.formallyClassifiedMaterials || 0} 种材料有明确分类，${summary?.counts?.unclassifiedMaterials || 0} 种原文未给出`} tone="red" />
        <MetricCard label="可计算参数" value={summary?.counts?.numericProperties} helper="通过数值校验的属性" tone="amber" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 18 }}>
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: palette.ink }}>物料类别分布</div>
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            {(summary?.categoryStats || []).map((item) => {
              const max = Math.max(...(summary?.categoryStats || []).map((x) => x.count), 1);
              const width = Math.max(8, (item.count / max) * 100);
              return (
                <div key={item.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span style={{ fontWeight: 800, color: palette.ink }}>{item.name}</span>
                    <span style={{ color: palette.muted }}>{item.count} 种</span>
                  </div>
                  <div style={{ height: 9, background: "#eef2f7", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${width}%`, height: "100%", background: "linear-gradient(90deg,#60a5fa,#2563eb)", borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: palette.ink }}>风险分类概览</div>
          <div style={{ marginTop: 14, fontSize: 13, fontWeight: 900 }}>原文危险货物分类</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            {(summary?.formalHazardClassStats || []).map((item) => (
              <div key={item.name} style={{ padding: "12px 14px", minWidth: 110, background: palette.dangerSoft, borderRadius: 14, border: "1px solid #fecaca" }}>
                <div style={{ fontWeight: 900, color: palette.danger }}>危险分类 {String(item.name).replace(/^UN\s*/i, "")}</div>
                <div style={{ color: palette.muted, marginTop: 4, fontSize: 12 }}>{item.materialCount} 种物料</div>
              </div>
            ))}
            {(summary?.formalHazardClassStats || []).length === 0 ? <div style={{ color: palette.muted, fontSize: 12 }}>当前来源未提供明确危险货物分类。</div> : null}
          </div>
          <div style={{ marginTop: 18, paddingTop: 15, borderTop: `1px solid ${palette.border}`, fontSize: 13, fontWeight: 900 }}>材料风险特征分类</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {(summary?.riskCharacteristicStats || []).map((item) => (
              <div key={item.riskType} style={{ padding: "10px 12px", minWidth: 108, background: "#fff7ed", borderRadius: 13, border: "1px solid #fed7aa" }}>
                <div style={{ fontWeight: 850, color: "#c2410c" }}>{item.name}</div>
                <div style={{ color: palette.muted, marginTop: 4, fontSize: 12 }}>{item.materialCount} 种物料</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, color: palette.muted, fontSize: 12, lineHeight: 1.65 }}>
            {summary?.classificationNote || "材料风险特征由属性规则识别，不等同于法定危险货物分类。"}
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: palette.ink }}>代表性物料</div>
            <div style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}>点击任一物料进入单体风险画像</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, marginTop: 16 }}>
          {materials.slice(0, 9).map((item) => <MaterialCard key={item.id} item={item} onClick={() => onSelect(item)} />)}
        </div>
      </div>
    </div>
  );
}

function PropertyTable({ properties }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const item of properties || []) {
      const group = item.group || "其他属性";
      if (!map.has(group)) map.set(group, []);
      map.get(group).push(item);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ai = PROPERTY_GROUP_ORDER.indexOf(a);
      const bi = PROPERTY_GROUP_ORDER.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
  }, [properties]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {groups.map(([group, rows]) => (
        <div key={group} style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", background: "#f8fafc", borderBottom: `1px solid ${palette.border}`, fontWeight: 900, color: palette.ink }}>{group}</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: palette.muted }}>
                  <th style={{ textAlign: "left", padding: "11px 16px" }}>属性</th>
                  <th style={{ textAlign: "left", padding: "11px 16px" }}>标准值</th>
                  <th style={{ textAlign: "left", padding: "11px 16px" }}>原始描述</th>
                  <th style={{ textAlign: "left", padding: "11px 16px" }}>状态</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id || `${group}-${row.name}`} style={{ borderTop: `1px solid ${palette.border}`, verticalAlign: "top" }}>
                    <td style={{ padding: "13px 16px", fontWeight: 850, color: palette.ink, width: "25%" }}>{row.name}</td>
                    <td style={{ padding: "13px 16px", color: palette.primary, fontWeight: 850, width: "20%" }}>{row.value || "-"}</td>
                    <td style={{ padding: "13px 16px", color: palette.muted, lineHeight: 1.55 }}>{row.rawValue || "-"}
                      {row.measurements?.length ? (
                        <div style={{ marginTop: 7, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {row.measurements.map((m, idx) => <Pill key={`${m.role}-${idx}`} tone="green">{m.metric || m.role}：{m.label}</Pill>)}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: "13px 16px" }}>{row.numericValidated ? <Pill tone="green">可计算</Pill> : <Pill tone="slate">文本描述</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceList({ evidence }) {
  if (!evidence?.length) return <EmptyState title="暂无证据记录" text="该物料当前没有返回可展开的单元格证据。" />;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {evidence.map((item, idx) => (
        <div key={`${item.cell}-${idx}`} style={{ ...card, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 900, color: palette.ink }}>{RELATION_TITLES[item.relationType] || item.relationType} · {item.targetName || "事实"}</div>
            <Pill tone="slate">{item.cell || "来源位置"}</Pill>
          </div>
          <div style={{ marginTop: 8, color: palette.muted, fontSize: 12 }}>{item.sourceDoc} · 字段：{item.fieldName || "-"}</div>
          <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: "#f8fafc", color: palette.ink, lineHeight: 1.65 }}>{item.text || "-"}</div>
        </div>
      ))}
    </div>
  );
}

function RelationCards({ relations }) {
  const entries = Object.entries(relations || {}).filter(([, rows]) => rows?.length);
  if (!entries.length) return <EmptyState title="暂无风险与管控事实" text="当前物料没有返回已接受的风险或控制关系。" />;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}>
      {entries.map(([type, rows]) => {
        const danger = ["HAS_HAZARD", "CAUSES_HEALTH_EFFECT", "CAUSES_HEALTH_HAZARD", "PROHIBITS_FIREFIGHTING_AGENT", "INEFFECTIVE_FIREFIGHTING_AGENT", "INCOMPATIBLE_WITH"].includes(type);
        return (
          <div key={type} style={{ ...card, padding: 17, borderTop: `4px solid ${danger ? "#ef4444" : "#10b981"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900, color: palette.ink }}>{RELATION_TITLES[type] || type}</div>
              <Pill tone={danger ? "red" : "green"}>{rows.length}</Pill>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {rows.slice(0, 8).map((row, idx) => (
                <div key={`${row.targetName}-${idx}`} style={{ padding: "9px 11px", background: danger ? palette.dangerSoft : palette.successSoft, borderRadius: 11, lineHeight: 1.45 }}>
                  <div style={{ fontWeight: 850, color: palette.ink }}>{row.targetName}</div>
                  {row.description && row.description !== row.targetName ? <div style={{ marginTop: 4, color: palette.muted, fontSize: 12 }}>{row.description}</div> : null}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HazardClassDetail({ item }) {
  return (
    <div style={{
      marginTop: 10,
      padding: 12,
      borderRadius: 12,
      background: "#fff7f7",
      border: "1px solid #fecaca",
      display: "grid",
      gap: 6,
      fontSize: 12,
      lineHeight: 1.55,
    }}>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
        <Pill tone="red">危险分类 {item.code || "-"}</Pill>
        <Pill tone="slate">{item.roleName || "未注明分类角色"}</Pill>
      </div>
      <div><span style={{ color: palette.muted }}>分类体系：</span><b>{item.classificationSystemName || item.classificationSystem || "-"}</b></div>
      <div><span style={{ color: palette.muted }}>危险项别：</span><b>{item.division || "-"}</b></div>
      <div><span style={{ color: palette.muted }}>配装组：</span><b>{item.compatibilityGroup || "未注明"}</b></div>
      {item.conditionText ? <div><span style={{ color: palette.muted }}>适用条件：</span>{item.conditionText}</div> : null}
      <div><span style={{ color: palette.muted }}>来源位置：</span><b>{item.sourceDoc || "-"} · {item.sheetName || "Sheet1"}!{item.cell || "-"}</b></div>
      <div><span style={{ color: palette.muted }}>原始字段：</span>{item.fieldName || "危险性类别"}</div>
      <div style={{ padding: 9, background: "#fff", borderRadius: 9 }}>
        <span style={{ color: palette.muted }}>原始文本：</span>{item.rawText || "-"}
      </div>
    </div>
  );
}

function ProfileHeader({ profile, structureInfo }) {
  const m = profile?.material;
  if (!m) return null;
  return (
    <div
      className="material-profile-header"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1.15fr) minmax(360px,.85fr)",
        gap: 16,
        alignItems: "stretch",
      }}
    >
      <div style={{ ...card, padding: 22, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill tone="blue">{m.category}</Pill>
          {(m.hazardCodes || []).map((code) => (
            <Pill key={code} tone="red">
              危险分类 {String(code).replace(/^UN\s*/i, "")}
            </Pill>
          ))}
          {m.variantCode ? <Pill tone="amber">型号 {m.variantCode}</Pill> : null}
        </div>

        <h1 style={{ margin: "12px 0 5px", color: palette.ink, fontSize: 30 }}>{m.name}</h1>
        {m.rawName && m.rawName !== m.name ? (
          <div style={{ color: palette.muted }}>原始名称：{m.rawName}</div>
        ) : null}

        <div style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 10,
        }}>
          {[
            ["CAS", m.casNumbers?.join("、") || "-"],
            ["分子式", m.formula || "-"],
            ["来源", m.sourceDoc || "-"],
            ["原始行", m.sourceRow || "-"],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: 12, borderRadius: 12, background: "#f8fafc", minWidth: 0 }}>
              <div style={{ color: palette.muted, fontSize: 12 }}>{label}</div>
              <div style={{ marginTop: 4, color: palette.ink, fontWeight: 850, overflowWrap: "anywhere" }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, borderTop: `1px solid ${palette.border}`, paddingTop: 14 }}>
          <div style={{ fontWeight: 900 }}>原文危险货物分类</div>
          <div style={{ color: palette.muted, fontSize: 12, marginTop: 3 }}>仅展示来源资料“危险性类别”等字段明确给出的正式分类。</div>
          {(profile.hazardClassDetails || []).length ? (
            (profile.hazardClassDetails || []).map((item, index) => (
              <HazardClassDetail key={`${item.code}-${index}`} item={item} />
            ))
          ) : (
            <div style={{ marginTop: 10, padding: "11px 12px", borderRadius: 12, background: "#f8fafc", color: palette.muted, fontSize: 13 }}>
              原文未给出明确危险货物分类
            </div>
          )}

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${palette.border}` }}>
            <div style={{ fontWeight: 900 }}>材料风险特征</div>
            <div style={{ color: palette.muted, fontSize: 12, marginTop: 3 }}>由已审核材料属性命中版本化规则后形成，用于提示可能的风险通道。</div>
            {(profile.riskCharacteristics || []).length ? (
              <div style={{ display: "grid", gap: 9, marginTop: 10 }}>
                {(profile.riskCharacteristics || []).map((item) => (
                  <div key={item.riskType} style={{ padding: "10px 12px", borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <b style={{ color: "#c2410c" }}>{item.name || item.riskType}</b>
                      <Pill tone={item.riskLevel === "high" ? "red" : "amber"}>
                        链路关注等级：{item.riskLevel === "high" ? "高" : item.riskLevel === "medium-high" ? "较高" : "中"}
                      </Pill>
                    </div>
                    <div style={{ marginTop: 6, color: palette.muted, fontSize: 12, lineHeight: 1.6 }}>
                      依据属性：{(item.properties || []).join("、") || "-"}；规则：{(item.ruleIds || []).join("、") || "-"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 10, padding: "11px 12px", borderRadius: 12, background: "#f8fafc", color: palette.muted, fontSize: 13 }}>
                当前材料没有命中可生成风险链的属性规则。
              </div>
            )}
            <div style={{ marginTop: 9, color: palette.muted, fontSize: 12, lineHeight: 1.6 }}>
              {profile.riskClassificationNote || "材料风险特征由已审核属性和版本化规则识别，不等同于法定危险货物分类。"}
            </div>
          </div>
        </div>
      </div>

      <MaterialStructurePanel structureInfo={structureInfo} material={m} />
    </div>
  );
}

function DemoGraph({ materialId, mode, onSelect }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 5px 12px" }}>
        <div>
          <div style={{ fontWeight: 900, color: palette.ink }}>{mode === "demoProfile" ? "材料关键知识画像" : "风险与管控链"}</div>
          <div style={{ color: palette.muted, fontSize: 12, marginTop: 3 }}>当前视图仅呈现业务分析所需的关键节点，证据和长文本按需查看。</div>
        </div>
        <Pill tone="green">单材料投影</Pill>
      </div>
      <GraphView materialId={materialId} graphMode={mode} nodeLimit={30} edgeLimit={40} height={520} onSelect={onSelect} />
    </div>
  );
}


function TopNavButton({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      border: active ? "1px solid #93c5fd" : "1px solid transparent",
      background: active ? "#eff6ff" : "transparent",
      color: active ? palette.primary : palette.muted,
      borderRadius: 12,
      padding: "9px 14px",
      fontWeight: 900,
      cursor: "pointer",
    }}>{children}</button>
  );
}

function AllMaterials({ materials, onSelect, onGraphSelect }) {
  const [category, setCategory] = useState("全部");
  const [view, setView] = useState("catalog");
  const categories = useMemo(() => ["全部", ...Array.from(new Set((materials || []).map((m) => m.category).filter(Boolean)))], [materials]);
  const filtered = useMemo(() => category === "全部" ? (materials || []) : (materials || []).filter((m) => m.category === category), [materials, category]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ ...card, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 950 }}>全材料展示</div>
            <div style={{ color: palette.muted, marginTop: 5 }}>完整管理164个具体物料。目录视图用于项目检索，关系视图用于分析物料—类别—危险分类关联。</div>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <TopNavButton active={view === "catalog"} onClick={() => setView("catalog")}>材料目录</TopNavButton>
            <TopNavButton active={view === "graph"} onClick={() => setView("graph")}>关系总览</TopNavButton>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          {categories.map((item) => <button key={item} onClick={() => setCategory(item)} style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "7px 11px", fontWeight: 850, background: category === item ? palette.primary : "#f1f5f9", color: category === item ? "#fff" : palette.muted }}>{item}</button>)}
        </div>
      </div>

      {view === "graph" ? (
        <div style={{ ...card, padding: 14 }}>
          <div style={{ fontWeight: 900, padding: "3px 5px 12px" }}>全材料关系总览 · 仅展示具体物料、物料类别和危险分类</div>
          <GraphView graphMode="material" nodeLimit={300} edgeLimit={600} height={650} onSelect={onGraphSelect} />
        </div>
      ) : (
        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontWeight: 900 }}>{category} · {filtered.length} 种</div>
            <Pill tone="green">完整材料目录</Pill>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
            {filtered.map((item) => <MaterialCard key={item.id} item={item} onClick={() => onSelect(item)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function RiskWorkspace({ onGraphSelect, onChainSelect }) {
  const [stats, setStats] = useState(null);
  const [chains, setChains] = useState([]);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetch(`${API}/risk/stats`).then((r) => r.json()),
      fetch(`${API}/risk/chains?limit=120&onlyWithRules=false&q=${encodeURIComponent(query)}`).then((r) => r.json()),
    ]).then(([s, c]) => {
      if (s.error) throw new Error(s.error);
      if (c.error) throw new Error(c.error);
      setStats(s);
      setChains(c.rows || []);
    }).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [load]);

  const infer = async () => {
    setRunning(true);
    setError("");
    try {
      const response = await fetch(`${API}/risk/infer`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "风险链路构建失败");
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  if (loading && !stats) return <LoadingBlock text="正在读取风险预测链路…" />;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ ...card, padding: 22, background: "linear-gradient(135deg,#fff7ed,#fff,#fef2f2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 950 }}>风险辨识与预测链路</div>
            <div style={{ color: palette.muted, marginTop: 5 }}>保留原项目的核心工作模块：物料归一、刺激识别、风险事件预测、管控措施、监测变量和区域规则匹配。</div>
          </div>
          <button disabled={running} onClick={infer} style={{ border: 0, borderRadius: 13, padding: "11px 15px", cursor: running ? "wait" : "pointer", color: "#fff", background: palette.danger, fontWeight: 900 }}>{running ? "正在构建…" : "构建 / 刷新风险链路"}</button>
        </div>
      </div>

      {error ? <div style={{ ...card, padding: 14, color: palette.danger, background: palette.dangerSoft }}>{error}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
        <MetricCard label="预测风险链" value={stats?.predictedRiskChains ?? 0} helper="已生成链路" tone="red" />
        <MetricCard label="归一物料" value={stats?.canonicalMaterials ?? 0} helper="标准物料" tone="blue" />
        <MetricCard label="刺激类型" value={stats?.stimuli ?? 0} helper="刺激因素" tone="amber" />
        <MetricCard label="区域规则" value={stats?.areaRules ?? 0} helper="区域规则" tone="green" />
      </div>

      <div style={{ ...card, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "3px 5px 12px" }}>
          <div>
            <div style={{ fontWeight: 900 }}>{focused ? `单条链路：${focused.name || focused.chainId || focused.chainDbId}` : "风险链路全局投影"}</div>
            <div style={{ color: palette.muted, fontSize: 12, marginTop: 3 }}>全局投影限制链路数量；点击下方链路卡片可查看单条完整规则路径。</div>
          </div>
          {focused ? <button onClick={() => { setFocused(null); onChainSelect?.(null); onGraphSelect?.(null); }} style={{ border: 0, borderRadius: 11, padding: "8px 12px", cursor: "pointer", fontWeight: 850 }}>返回全局链路</button> : null}
        </div>
        <GraphView graphMode={focused ? "riskSingle" : "risk"} focusChainId={focused?.graphNodeId || String(focused?.chainDbId || "")} nodeLimit={80} edgeLimit={1600} height={610} onSelect={onGraphSelect} />
      </div>

      <div style={{ ...card, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>风险链路清单</div>
            <div style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}>共返回 {chains.length} 条，可按工序、物料、危险因素或刺激搜索。</div>
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索风险链路…" style={{ width: 280, border: "1px solid #dbe3ef", borderRadius: 12, padding: "10px 12px", outline: "none" }} />
        </div>
        {!chains.length ? <div style={{ marginTop: 16 }}><EmptyState title="当前没有预测链路" text="点击“构建 / 刷新风险链路”。该模块依赖原项目的risk_rules.tsv、extracted_facts.csv和risk-graph.js。" /></div> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12, marginTop: 16 }}>
            {chains.map((chain) => (
              <button key={chain.chainDbId} onClick={() => { setFocused(chain); onChainSelect?.(chain); onGraphSelect?.(null); }} style={{ textAlign: "left", border: focused?.chainDbId === chain.chainDbId ? "1.5px solid #fb7185" : `1px solid ${palette.border}`, background: focused?.chainDbId === chain.chainDbId ? "#fff1f2" : "#fff", borderRadius: 15, padding: 15, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 900, color: palette.ink }}>{chain.name || `${chain.material || "物料"}风险链`}</div>
                  <Pill tone={chain.hasRuleMatch ? "green" : "amber"}>{chain.hasRuleMatch ? `规则${chain.areaRules?.length || 0}` : "候选链"}</Pill>
                </div>
                <div style={{ marginTop: 10, color: palette.muted, lineHeight: 1.65, fontSize: 13 }}>
                  <b style={{ color: palette.ink }}>{chain.process || "未指定工序"}</b> → {chain.material || "未指定物料"} → {chain.stimulus || chain.hazardFactor || "风险刺激"} → {(chain.events || []).map((x) => x.name).join("、") || "风险事件"}
                </div>
                {(chain.controls || []).length ? <div style={{ marginTop: 8, color: palette.success, fontSize: 12 }}>管控：{chain.controls.slice(0, 3).map((x) => x.name).join("、")}</div> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


const RISK_PROPERTY_LABELS = {
  name: "名称",
  entity_type: "实体类型",
  source_doc: "来源文档",
  source_document: "来源文档",
  source_chapter: "来源章节",
  source_location: "来源位置",
  evidence: "证据文本",
  evidence_text: "证据文本",
  confidence: "置信度",
  method: "匹配方法",
  match_method: "匹配方法",
  matchMethod: "匹配方法",
  match_confidence: "匹配置信度",
  matchConfidence: "匹配置信度",
  condition: "适用条件",
  operation: "规则/操作",
  category: "规则分类",
  zone: "危险区域",
  process: "工序",
  material: "物料",
  stimulus: "刺激类型",
  hazard_factor: "危险因素",
  relation_name: "关系名称",
};

function formatRiskValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.map((item) => formatRiskValue(item)).filter(Boolean).join("、");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  if (typeof value === "number" && value >= 0 && value <= 1) return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return String(value);
}

function RiskPropertyList({ properties }) {
  const hidden = new Set([
    "_neo4jInternalId", "_neo4jType", "attributes_json", "properties_json",
    "source", "extractor", "source_file", "inference_method",
    "updated_at", "created_at",
  ]);
  const rows = Object.entries(properties || {})
    .filter(([key, value]) => !hidden.has(key) && formatRiskValue(value))
    .sort(([a], [b]) => {
      const priority = ["source_doc", "source_document", "source_chapter", "source_location", "evidence", "evidence_text", "confidence"];
      const ai = priority.indexOf(a);
      const bi = priority.indexOf(b);
      if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
      return a.localeCompare(b, "zh");
    });

  if (!rows.length) return <div style={{ color: palette.muted, fontSize: 12 }}>该元素没有可展示的业务属性。</div>;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map(([key, value]) => {
        const text = formatRiskValue(value);
        const isLong = text.length > 90 || text.includes("\n");
        return (
          <div key={key} style={{ padding: 10, borderRadius: 11, background: "#f8fafc", fontSize: 12, lineHeight: 1.65 }}>
            <div style={{ color: palette.muted }}>{RISK_PROPERTY_LABELS[key] || key}</div>
            <div style={{ marginTop: 3, color: palette.ink, fontWeight: isLong ? 500 : 800, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{text}</div>
          </div>
        );
      })}
    </div>
  );
}

function riskProvenanceFromProperties(properties = {}) {
  const sourceDoc = properties.source_doc || properties.source_document || "";
  if (!sourceDoc) return [];
  return [{
    factId: properties.fact_id || "",
    relationName: properties.relation_name || properties._neo4jType || "",
    sourceDoc,
    sourceSection: properties.source_section || properties.source_chapter || "",
    sourceLocation: properties.source_location || "",
    evidence: properties.evidence || properties.evidence_text || "",
    confidence: properties.confidence,
  }];
}

function RiskProvenanceList({ provenance, emptyText = "当前元素没有关联到带文档来源的抽取事实。" }) {
  const rows = Array.isArray(provenance)
    ? provenance.filter((item) => item && item.sourceDoc)
    : [];
  if (!rows.length) return <div style={{ color: palette.muted, fontSize: 12, lineHeight: 1.65 }}>{emptyText}</div>;

  const kindLabels = {
    extracted_fact: "抽取事实",
    area_rule: "区域规则",
    stimulus_rule: "刺激规则",
  };

  return (
    <div style={{ display: "grid", gap: 9 }}>
      {rows.map((item, index) => (
        <div key={`${item.sourceDoc}-${item.factId || index}-${index}`} style={{ padding: 11, borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 12, lineHeight: 1.65 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
            <div style={{ fontWeight: 900, color: palette.primary }}>{item.sourceDoc}</div>
            {item.provenanceKind ? <Pill tone={item.provenanceKind === "extracted_fact" ? "blue" : "green"}>{kindLabels[item.provenanceKind] || "来源文档"}</Pill> : null}
          </div>
          {item.sourceSection ? <div><span style={{ color: palette.muted }}>章节：</span>{item.sourceSection}</div> : null}
          {item.sourceLocation ? <div><span style={{ color: palette.muted }}>位置：</span>{item.sourceLocation}</div> : null}
          {item.relationName ? <div><span style={{ color: palette.muted }}>抽取关系：</span>{item.relationName}</div> : null}
          {item.factId ? <div><span style={{ color: palette.muted }}>事实编号：</span>{item.factId}</div> : null}
          {item.confidence !== null && item.confidence !== undefined ? <div><span style={{ color: palette.muted }}>抽取置信度：</span>{formatRiskValue(item.confidence)}</div> : null}
          {item.evidence ? <div style={{ marginTop: 7, padding: 8, background: "#fff", borderRadius: 8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}><span style={{ color: palette.muted }}>原文证据：</span>{item.evidence}</div> : null}
        </div>
      ))}
    </div>
  );
}

function RiskNameTags({ items, tone = "blue", empty = "未记录" }) {
  const rows = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!rows.length) return <span style={{ color: palette.muted, fontSize: 12 }}>{empty}</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {rows.map((item, index) => <Pill key={`${item.id || item.name || index}-${index}`} tone={tone}>{item.name || String(item)}</Pill>)}
    </div>
  );
}

function RiskChainTrace({ chain }) {
  if (!chain) return null;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ padding: 13, borderRadius: 14, background: "#fff7ed", border: "1px solid #fed7aa" }}>
        <div style={{ color: palette.amber, fontSize: 12, fontWeight: 900 }}>当前预测链路</div>
        <div style={{ marginTop: 5, fontWeight: 950, lineHeight: 1.5 }}>{chain.name || chain.chainId || `链路 ${chain.chainDbId}`}</div>
        <div style={{ marginTop: 9, display: "grid", gap: 6, color: palette.muted, fontSize: 12, lineHeight: 1.55 }}>
          <div><b style={{ color: palette.ink }}>工序：</b>{chain.process || "-"}</div>
          <div><b style={{ color: palette.ink }}>物料：</b>{chain.material || "-"}</div>
          <div><b style={{ color: palette.ink }}>危险因素：</b>{chain.hazardFactor || "-"}</div>
          <div><b style={{ color: palette.ink }}>刺激：</b>{chain.stimulus || "-"}</div>
          <div><b style={{ color: palette.ink }}>置信度：</b>{formatRiskValue(chain.confidence) || "-"}</div>
          <div><b style={{ color: palette.ink }}>结果性质：</b>基于抽取事实与风险规则形成的预测链路</div>
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>抽取结果来源文档</div>
        <RiskProvenanceList provenance={chain.provenance} emptyText="当前链路尚未返回可追溯的抽取文档，请检查 extracted_facts.csv 的来源文档字段是否已导入。" />
      </div>
      <div><div style={{ fontWeight: 850, marginBottom: 7 }}>原始物料</div><RiskNameTags items={chain.originalMaterials} tone="blue" /></div>
      <div><div style={{ fontWeight: 850, marginBottom: 7 }}>预测事件</div><RiskNameTags items={chain.events} tone="red" /></div>
      <div><div style={{ fontWeight: 850, marginBottom: 7 }}>管控措施</div><RiskNameTags items={chain.controls} tone="green" /></div>
      <div><div style={{ fontWeight: 850, marginBottom: 7 }}>监测变量</div><RiskNameTags items={chain.monitors} tone="amber" /></div>
      <div>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>规则匹配与抽取证据</div>
        {(chain.areaRules || []).length ? (
          <div style={{ display: "grid", gap: 9 }}>
            {chain.areaRules.map((rule, index) => (
              <div key={`${rule.id || index}-${index}`} style={{ padding: 11, borderRadius: 12, background: palette.successSoft, border: "1px solid #a7f3d0", fontSize: 12, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 900, color: palette.success }}>{rule.operation || rule.name || `区域规则 ${index + 1}`}</div>
                {rule.category ? <div><span style={{ color: palette.muted }}>分类：</span>{rule.category}</div> : null}
                {rule.zone ? <div><span style={{ color: palette.muted }}>危险区域：</span>{rule.zone}</div> : null}
                {rule.condition ? <div><span style={{ color: palette.muted }}>适用条件：</span>{rule.condition}</div> : null}
                {rule.matchMethod ? <div><span style={{ color: palette.muted }}>匹配方法：</span>{rule.matchMethod}</div> : null}
                {rule.matchConfidence !== null && rule.matchConfidence !== undefined ? <div><span style={{ color: palette.muted }}>匹配置信度：</span>{formatRiskValue(rule.matchConfidence)}</div> : null}
                {rule.evidence ? <div style={{ marginTop: 6, padding: 8, background: "#fff", borderRadius: 8, whiteSpace: "pre-wrap" }}><span style={{ color: palette.muted }}>规则证据文本：</span>{rule.evidence}</div> : null}
              </div>
            ))}
          </div>
        ) : <div style={{ color: palette.muted, fontSize: 12 }}>当前链路尚未匹配区域规则。</div>}
      </div>
    </div>
  );
}

function RiskTracePanel({ graphItem, nodeDetail, chain, loading }) {
  if (graphItem?.data) {
    const data = graphItem.data;
    const isNode = graphItem.kind === "node";
    const properties = isNode ? (nodeDetail?.properties || data.props || {}) : (data.props || {});
    const provenance = isNode
      ? (nodeDetail?.provenance || [])
      : riskProvenanceFromProperties(properties);
    return (
      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <div style={{ padding: 13, borderRadius: 14, background: palette.primarySoft, border: "1px solid #bfdbfe" }}>
          <div style={{ fontSize: 12, color: palette.primary, fontWeight: 900 }}>{isNode ? "风险节点详情" : "风险关系详情"}</div>
          <div style={{ marginTop: 5, fontWeight: 950, lineHeight: 1.45 }}>{String(data.label || data.type || nodeDetail?.name || graphItem.id).replace(/\n/g, " · ")}</div>
          <div style={{ marginTop: 5, color: palette.muted, fontSize: 12 }}>{data.group || data.relationType || nodeDetail?.label || "图谱元素"}</div>
          {isNode && nodeDetail?.relationshipCount !== undefined ? <div style={{ marginTop: 5, color: palette.muted, fontSize: 12 }}>直接关系：{nodeDetail.relationshipCount} 条</div> : null}
        </div>
        {loading ? <div style={{ color: palette.muted, fontSize: 12 }}>正在读取节点属性与溯源信息…</div> : null}
        <RiskPropertyList properties={properties} />
        <div style={{ paddingTop: 10, borderTop: `1px solid ${palette.border}` }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>抽取结果来源文档</div>
          {isNode && nodeDetail?.provenanceResolution === "predicted_chain_support" ? (
            <div style={{ marginBottom: 9, padding: 9, borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: 12, lineHeight: 1.6 }}>
              当前节点是系统生成的预测链路。下列文档不是该预测节点自身的来源，而是沿“工序—原始物料—危险因素—事件/管控/监测”回溯得到的支撑抽取事实与规则文档。
            </div>
          ) : null}
          <RiskProvenanceList
            provenance={provenance}
            emptyText={isNode
              ? "该节点暂未解析到支撑它的来源文档。预测链路节点需要沿其关联的原始事实节点继续回溯。"
              : "该关系属于系统推理或图谱组织关系，没有独立原文来源；请点击对应链路节点或链路卡片查看支撑文档。"}
          />
        </div>
        <div style={{ color: palette.muted, fontSize: 12, lineHeight: 1.65 }}>
          这里仅把抽取结果中的来源文档、章节、定位和原文证据作为溯源信息；抽取插件名称和内部推理标识不作为文档来源展示。
        </div>
      </div>
    );
  }
  if (chain) return <div style={{ marginTop: 14 }}><RiskChainTrace chain={chain} /></div>;
  return <div style={{ marginTop: 14, color: palette.muted, lineHeight: 1.75, fontSize: 13 }}>点击风险图中的节点或原始事实连线，可查看抽取结果的来源文档、章节、位置和原文证据；点击链路卡片，可查看支撑整条预测链路的文档溯源。</div>;
}

function ClassificationGraphInfo({ graphItem }) {
  const data = graphItem?.data;
  const props = data?.props || {};
  if (!data) return null;

  const isHazardNode = data.group === "HazardClassification";
  const isHazardEdge = data.relationType === "HAS_HAZARD_CLASS" || props._neo4jType === "HAS_HAZARD_CLASS";
  if (!isHazardNode && !isHazardEdge) {
    return (
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 850, marginBottom: 8 }}>当前图元素</div>
        <div style={{ padding: 12, background: "#f8fafc", borderRadius: 12 }}>
          <div style={{ fontWeight: 900 }}>{String(data.label || data.type || "").replace(/\n/g, " · ")}</div>
          <div style={{ color: palette.muted, marginTop: 5, fontSize: 12 }}>{data.group || data.relationType || "图谱元素"}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 900, marginBottom: 9 }}>危险分类说明</div>
      <div style={{ padding: 13, background: "#fff7f7", border: "1px solid #fecaca", borderRadius: 13, display: "grid", gap: 7, fontSize: 12, lineHeight: 1.55 }}>
        <div style={{ fontSize: 15, fontWeight: 950, color: palette.danger }}>
          {props.display_name || String(data.label || "危险分类").replace(/\n/g, " ")}
        </div>
        <div><span style={{ color: palette.muted }}>分类体系：</span>{props.classification_system_name || "联合国危险货物运输分类（UN TDG）"}</div>
        <div><span style={{ color: palette.muted }}>危险项别：</span>{props.hazard_division || props.division || "-"}</div>
        <div><span style={{ color: palette.muted }}>配装组：</span>{props.compatibility_group || "未注明"}</div>
        {props.classification_role_name || props.role ? <div><span style={{ color: palette.muted }}>分类角色：</span>{props.classification_role_name || props.role}</div> : null}
        {props.condition_text ? <div><span style={{ color: palette.muted }}>适用条件：</span>{props.condition_text}</div> : null}
        {(props.source_doc_resolved || props.source_cell) ? (
          <>
            <div><span style={{ color: palette.muted }}>来源文件：</span>{props.source_doc_resolved || props.source_doc || "-"}</div>
            <div><span style={{ color: palette.muted }}>来源位置：</span>{props.source_sheet || "Sheet1"}!{props.source_cell || "-"}</div>
            <div><span style={{ color: palette.muted }}>原始字段：</span>{props.source_field || "危险性类别"}</div>
            <div style={{ padding: 9, borderRadius: 9, background: "#fff" }}><span style={{ color: palette.muted }}>原始文本：</span>{props.source_text || props.raw_text || "-"}</div>
          </>
        ) : (
          <div style={{ color: palette.muted }}>
            该分类节点是共享标准节点。请点击“物料 → 危险分类”的连线查看该物料对应的原始单元格和原文。
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [summary, setSummary] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]);
  const [page, setPage] = useState("home");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [profile, setProfile] = useState(null);
  const [structureInfo, setStructureInfo] = useState(null);
  const [tab, setTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState("");
  const [graphItem, setGraphItem] = useState(null);
  const [riskItem, setRiskItem] = useState(null);
  const [riskNodeDetail, setRiskNodeDetail] = useState(null);
  const [riskNodeLoading, setRiskNodeLoading] = useState(false);
  const [riskChain, setRiskChain] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/demo/summary`).then((r) => r.json()),
      fetch(`${API}/demo/materials?limit=12`).then((r) => r.json()),
      fetch(`${API}/demo/materials?limit=300`).then((r) => r.json()),
    ]).then(([s, m, all]) => {
      if (s.error) throw new Error(s.error);
      if (m.error) throw new Error(m.error);
      if (all.error) throw new Error(all.error);
      setSummary(s);
      setFeatured(m);
      setAllMaterials(all);
      setResults(m);
    }).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`${API}/demo/materials?q=${encodeURIComponent(query)}&limit=300`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setResults(data);
        })
        .catch((e) => setError(String(e)));
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (page !== "risk" || riskItem?.kind !== "node" || !riskItem.id) return undefined;
    let cancelled = false;
    fetch(`${API}/node/${encodeURIComponent(riskItem.id)}`)
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok || data.error) throw new Error(data.error || "节点详情读取失败");
        if (!cancelled) setRiskNodeDetail(data);
      })
      .catch((cause) => {
        if (!cancelled) setRiskNodeDetail({ error: String(cause), properties: riskItem.data?.props || {} });
      })
      .finally(() => { if (!cancelled) setRiskNodeLoading(false); });
    return () => { cancelled = true; };
  }, [page, riskItem]);

  const chooseMaterial = useCallback((item) => {
    setPage("detail");
    setSelected(item);
    setTab("profile");
    setGraphItem(null);
    setRiskItem(null);
    setRiskNodeDetail(null);
    setRiskNodeLoading(false);
    setRiskChain(null);
    setProfile(null);
    setStructureInfo(null);
    setError("");
    setProfileLoading(true);

    const stableId = item.stableId || item.id;
    Promise.all([
      fetch(`${API}/demo/material/${encodeURIComponent(item.id)}/profile`)
        .then((response) => response.json()),
      fetch(`${API}/structure/material/${encodeURIComponent(stableId)}`)
        .then((response) => response.json())
        .catch(() => ({
          available: false,
          reason: "structure_mapping_not_found",
        })),
    ])
      .then(([profileData, structureData]) => {
        if (profileData.error) throw new Error(profileData.error);
        setProfile(profileData);
        setStructureInfo(normalizeStructureResponse(structureData));
      })
      .catch((cause) => setError(String(cause)))
      .finally(() => setProfileLoading(false));
  }, []);

  const goHome = () => {
    setPage("home");
    setSelected(null);
    setProfile(null);
    setStructureInfo(null);
    setGraphItem(null);
    setRiskItem(null);
    setRiskNodeDetail(null);
    setRiskNodeLoading(false);
    setRiskChain(null);
    setTab("profile");
  };

  const keyProperties = useMemo(() => (profile?.properties || []).slice(0, 8), [profile]);

  if (loading) return <div style={{ minHeight: "100vh", background: palette.bg, padding: 30 }}><LoadingBlock /></div>;

  return (
    <div style={{ minHeight: "100vh", background: palette.bg, color: palette.ink, fontFamily: 'Inter,"Microsoft YaHei",Arial,sans-serif' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        button,input{font:inherit}
        @media (max-width: 1180px) {
          .material-profile-header { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 860px) {
          .system-header-title { visibility: hidden; pointer-events: none; }
        }
      `}</style>
      <header style={{ height: 72, background: "rgba(255,255,255,.94)", borderBottom: `1px solid ${palette.border}`, position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(12px)" }}>
        <div style={{
          width: "100%",
          maxWidth: "none",
          margin: "0 auto",
          padding: "0 22px",
          height: "100%",
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
          alignItems: "center",
          gap: 18,
        }}>
          <button
            className="system-header-title"
            onClick={goHome}
            style={{
              justifySelf: "start",
              minWidth: 0,
              border: 0,
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ fontWeight: 950, fontSize: 20, color: palette.ink }}>风险辨识预测系统</div>
            <div style={{ fontSize: 12, color: palette.muted, marginTop: 3 }}>材料资料 · 材料风险链 · 产线 HAZOP · 证据追溯</div>
          </button>

          <nav style={{
            justifySelf: "center",
            display: "flex",
            gap: 4,
            padding: 4,
            borderRadius: 14,
            background: "#f8fafc",
            whiteSpace: "nowrap",
          }}>
            <TopNavButton active={page === "home"} onClick={goHome}>项目总览</TopNavButton>
            <TopNavButton active={page === "materials"} onClick={() => {
              setPage("materials");
              setSelected(null);
              setProfile(null);
              setStructureInfo(null);
              setGraphItem(null);
              setRiskItem(null);
              setRiskNodeDetail(null);
              setRiskChain(null);
            }}>材料资料</TopNavButton>
            <TopNavButton active={page === "materialRisk"} onClick={() => {
              setPage("materialRisk");
              setSelected(null);
              setProfile(null);
              setStructureInfo(null);
              setGraphItem(null);
              setRiskItem(null);
              setRiskNodeDetail(null);
              setRiskChain(null);
            }}>材料风险链</TopNavButton>
            <TopNavButton active={page === "standards"} onClick={() => {
              setPage("standards");
              setSelected(null);
              setProfile(null);
              setStructureInfo(null);
              setGraphItem(null);
              setRiskItem(null);
              setRiskNodeDetail(null);
              setRiskChain(null);
              setError("");
            }}>标准规则库</TopNavButton>
            <TopNavButton active={page === "hazop"} onClick={() => {
              setPage("hazop");
              setSelected(null);
              setProfile(null);
              setStructureInfo(null);
              setGraphItem(null);
              setRiskItem(null);
              setRiskNodeDetail(null);
              setRiskChain(null);
              setError("");
            }}>产线 HAZOP</TopNavButton>
          </nav>

          <div aria-hidden="true" style={{ justifySelf: "end", minWidth: 0 }} />
        </div>
      </header>

      <div style={{ width: "100%", maxWidth: "none", margin: "0 auto", padding: 20, display: "grid", gridTemplateColumns: page === "hazop" || page === "materialRisk" || page === "standards" ? "minmax(0,1fr)" : "300px minmax(0,1fr) 310px", gap: 18, alignItems: "start" }}>
        {page !== "materialRisk" && page !== "hazop" && page !== "standards" ? <aside style={{ ...card, padding: 16, position: "sticky", top: 92, maxHeight: "calc(100vh - 112px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 900, fontSize: 17 }}>物料检索</div>
          <div style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}>只返回具体物料，不混入证据、属性和技术节点。</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入物料名、型号、RDX、CAS…"
            style={{ width: "100%", border: "1px solid #dbe3ef", borderRadius: 14, padding: "12px 13px", marginTop: 14, outline: "none", background: "#fbfdff" }}
          />
          <div style={{ marginTop: 10, fontSize: 12, color: palette.muted }}>{results.length} 个结果</div>
          <div style={{ display: "grid", gap: 9, marginTop: 10, overflowY: "auto", paddingRight: 4 }}>
            {results.map((item) => <MaterialCard key={item.id} item={item} selected={selected?.id === item.id} onClick={() => chooseMaterial(item)} />)}
          </div>
        </aside> : null}

        <main style={{ minWidth: 0 }}>
          {error ? <div style={{ ...card, padding: 14, marginBottom: 14, color: palette.danger, background: palette.dangerSoft }}>{error}</div> : null}
          {page === "hazop" ? (
            <HazopWorkspace onOpenMaterial={chooseMaterial} />
          ) : page === "standards" ? (
            <StandardsRulesWorkspace />
          ) : page === "materialRisk" ? (
            <MaterialRiskWorkspace />
          ) : page === "materials" ? (
            <AllMaterials materials={allMaterials} onSelect={chooseMaterial} onGraphSelect={setGraphItem} />
          ) : !selected ? (
            <Overview summary={summary} materials={featured} onSelect={chooseMaterial} />
          ) : profileLoading ? (
            <LoadingBlock text={`正在生成“${selected.name}”风险画像…`} />
          ) : profile ? (
            <div style={{ display: "grid", gap: 16 }}>
              <ProfileHeader profile={profile} structureInfo={structureInfo} />
              <div style={{ ...card, padding: 8, display: "flex", gap: 6 }}>
                {[
                  ["profile", "材料画像"],
                  ["risk", "风险与管控"],
                  ["properties", "属性参数"],
                  ["evidence", "证据来源"],
                ].map(([key, label]) => (
                  <button key={key} onClick={() => { setTab(key); setGraphItem(null); }} style={{ border: 0, borderRadius: 13, padding: "10px 15px", fontWeight: 850, cursor: "pointer", background: tab === key ? palette.primary : "transparent", color: tab === key ? "#fff" : palette.muted }}>
                    {label}
                  </button>
                ))}
              </div>

              {tab === "profile" ? (
                <>
                  <DemoGraph materialId={profile.material.id} mode="demoProfile" onSelect={setGraphItem} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div style={{ ...card, padding: 18 }}>
                      <div style={{ fontWeight: 900 }}>关键属性</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 12 }}>
                        {keyProperties.map((p) => <div key={p.id || p.name} style={{ padding: 12, borderRadius: 12, background: "#f8fafc" }}><div style={{ color: palette.muted, fontSize: 12 }}>{p.name}</div><div style={{ fontWeight: 900, color: palette.primary, marginTop: 4 }}>{p.value}</div></div>)}
                      </div>
                    </div>
                    <div style={{ ...card, padding: 18 }}>
                      <div style={{ fontWeight: 900 }}>主要组分</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                        {(profile.components || []).length ? profile.components.map((c, i) => <Pill key={`${c.name}-${i}`} tone="blue">{c.name}{c.proportion ? ` · ${c.proportion}` : ""}</Pill>) : <span style={{ color: palette.muted }}>暂无组分信息</span>}
                      </div>
                      {profile.material.compositionRaw ? <div style={{ marginTop: 14, padding: 12, background: "#f8fafc", borderRadius: 12, color: palette.muted, lineHeight: 1.6 }}>{profile.material.compositionRaw}</div> : null}
                    </div>
                  </div>
                </>
              ) : null}

              {tab === "risk" ? (
                <>
                  <DemoGraph materialId={profile.material.id} mode="demoRisk" onSelect={setGraphItem} />
                  <RelationCards relations={profile.relations} />
                </>
              ) : null}

              {tab === "properties" ? <PropertyTable properties={profile.properties} /> : null}
              {tab === "evidence" ? <EvidenceList evidence={profile.evidence} /> : null}
            </div>
          ) : <EmptyState title="未能读取材料画像" text="请重新选择一个具体物料。" />}
        </main>

        {page !== "hazop" && page !== "materialRisk" && page !== "standards" ? <aside style={{ ...card, padding: 17, position: "sticky", top: 92, minHeight: 240, maxHeight: "calc(100vh - 112px)", overflowY: "auto" }}>
          <div style={{ fontWeight: 900, fontSize: 17 }}>项目信息栏</div>
          {page === "risk" ? (
            <RiskTracePanel
              graphItem={riskItem}
              nodeDetail={riskNodeDetail}
              chain={riskChain}
              loading={riskNodeLoading}
            />
          ) : graphItem?.data ? (
            <>
              <ClassificationGraphInfo graphItem={graphItem} />
              {!selected ? (
                <div style={{ marginTop: 14, color: palette.muted, fontSize: 12, lineHeight: 1.7 }}>
                  在“全材料 → 关系总览”中，点击危险分类节点可查看分类含义；点击物料与分类之间的连线可查看源文件、单元格和原始文本。
                </div>
              ) : null}
            </>
          ) : !selected ? (
            <div style={{ marginTop: 14, color: palette.muted, lineHeight: 1.75, fontSize: 13 }}>
              “材料资料”展示 PRODUCT_CATALOG_V1 中已审核的材料目录和关系总览。原文危险分类只展示来源文档明确给出的“危险性类别”；材料风险特征则由属性规则识别，二者不会混作同一种分类。
            </div>
          ) : (
            <>
              <div style={{ marginTop: 14, padding: 14, background: palette.primarySoft, borderRadius: 14 }}>
                <div style={{ fontWeight: 900, color: palette.ink }}>{selected.name}</div>
                <div style={{ color: palette.muted, marginTop: 6, fontSize: 12 }}>{selected.category}</div>
                {(profile?.hazardClassDetails || []).length ? (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #dbeafe", fontSize: 12, color: palette.muted, lineHeight: 1.6 }}>
                    危险分类来源：原始资料中的“危险性类别”字段；系统只做格式标准化，不补造法定分类。
                  </div>
                ) : null}
              </div>
              {graphItem?.data ? (
                <ClassificationGraphInfo graphItem={graphItem} />
              ) : (
                <div style={{ marginTop: 14, color: palette.muted, fontSize: 13, lineHeight: 1.65 }}>点击中心图中的节点，可在这里查看其名称、类型和关联信息。</div>
              )}
              <div style={{ marginTop: 18, borderTop: `1px solid ${palette.border}`, paddingTop: 15 }}>
                <div style={{ fontWeight: 850 }}>系统说明</div>
                <div style={{ color: palette.muted, fontSize: 12, marginTop: 8, lineHeight: 1.7 }}>
                  当前视图展示关键业务信息，详细数据和来源证据可在“证据来源”页签中查看。
                </div>
              </div>
            </>
          )}
        </aside> : null}
      </div>
    </div>
  );
}
