import StructureCard from "./StructureCard";

const panelStyle = {
  background: "#fff",
  border: "1px solid rgba(148,163,184,.18)",
  borderRadius: 22,
  boxShadow: "0 14px 36px rgba(15,23,42,.06)",
};

function EmptyStructure({ reason }) {
  const text = reason === "structure_mapping_not_found"
    ? "本地结构映射尚未部署。先完成结构审核，再运行离线结构流水线。"
    : "暂无已审核结构，该物料已进入结构补充或复核清单。";

  return (
    <div style={{
      minHeight: 300,
      display: "grid",
      placeItems: "center",
      padding: 24,
      textAlign: "center",
      color: "#64748b",
      background: "#f8fafc",
      borderRadius: 15,
      border: "1px dashed #cbd5e1",
    }}>
      <div>
        <div style={{ fontSize: 40, lineHeight: 1, color: "#2563eb" }}>⌬</div>
        <div style={{ marginTop: 12, color: "#0f172a", fontWeight: 900 }}>暂无可靠结构图</div>
        <div style={{ marginTop: 7, lineHeight: 1.7, fontSize: 13, maxWidth: 330 }}>{text}</div>
        <div style={{ marginTop: 10, fontSize: 12 }}>分子式仅用于校验，不用于自动猜测结构。</div>
      </div>
    </div>
  );
}

export default function MaterialStructurePanel({ structureInfo, material }) {
  const entry = structureInfo?.material;

  return (
    <section style={{ ...panelStyle, padding: 16, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a" }}>二维分子结构</div>
          <div style={{ marginTop: 3, color: "#64748b", fontSize: 12 }}>
            本地审核结构库 · 离线 SVG
          </div>
        </div>
        {entry?.materialType === "mixture" ? (
          <span style={{ color: "#b45309", fontWeight: 800, fontSize: 12 }}>混合物主要组分</span>
        ) : null}
      </div>

      {!structureInfo?.available || !entry ? (
        <EmptyStructure reason={structureInfo?.reason} />
      ) : entry.materialType === "mixture" ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 12,
          maxHeight: 530,
          overflowY: "auto",
          paddingRight: 2,
        }}>
          {entry.components.map((component) => (
            <StructureCard
              key={component.componentId}
              title={component.componentName}
              subtitle={component.proportionRaw || (component.contentValue ? `${component.contentValue}${component.contentUnit || ""}` : "")}
              svg={component.svg}
              smiles={component.smiles}
              reviewStatus={component.reviewStatus}
              formulaCheck={component.formulaCheck}
              typeLabel="主要组分"
              meta={[
                { label: "CAS", value: component.casNumber },
                { label: "分子式", value: component.molecularFormula },
                { label: "结构来源", value: component.structureSource },
              ]}
            />
          ))}
        </div>
      ) : (
        <StructureCard
          title={entry.materialName || material?.name || "当前物料"}
          svg={entry.structure?.svg}
          smiles={entry.structure?.smiles}
          reviewStatus={entry.reviewStatus}
          formulaCheck={entry.formulaCheck}
          typeLabel={entry.materialType === "polymer" ? "聚合物重复单元" : "单一化合物"}
          meta={[
            { label: "CAS", value: entry.casNumber || material?.casNumbers?.join("、") },
            { label: "分子式", value: entry.molecularFormula || material?.formula },
            { label: "结构来源", value: entry.structureSource },
          ]}
        />
      )}
    </section>
  );
}
