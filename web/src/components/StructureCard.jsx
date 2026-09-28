import { useState } from "react";
import StructureStatusBadge from "./StructureStatusBadge";

export default function StructureCard({
  title,
  subtitle,
  svg,
  smiles,
  reviewStatus,
  formulaCheck,
  meta = [],
  typeLabel,
}) {
  const [showSmiles, setShowSmiles] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article style={{
      border: "1px solid rgba(148,163,184,.22)",
      borderRadius: 16,
      background: "#fff",
      overflow: "hidden",
      minWidth: 0,
    }}>
      <div style={{
        minHeight: 238,
        display: "grid",
        placeItems: "center",
        background: "#fff",
        padding: 12,
      }}>
        {!imageFailed && svg ? (
          <img
            src={svg}
            alt={`${title}二维结构图`}
            style={{ width: "100%", height: 224, objectFit: "contain" }}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div style={{
            display: "grid",
            placeItems: "center",
            minHeight: 220,
            color: "#64748b",
            textAlign: "center",
            lineHeight: 1.7,
          }}>
            结构图文件不存在或无法读取
          </div>
        )}
      </div>

      <div style={{ padding: 14, borderTop: "1px solid rgba(148,163,184,.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, color: "#0f172a", overflowWrap: "anywhere" }}>{title}</div>
            {subtitle ? <div style={{ marginTop: 3, fontSize: 12, color: "#64748b" }}>{subtitle}</div> : null}
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#1d4ed8", whiteSpace: "nowrap" }}>{typeLabel}</span>
        </div>

        <div style={{ marginTop: 10 }}>
          <StructureStatusBadge reviewStatus={reviewStatus} formulaCheck={formulaCheck} />
        </div>

        {meta.map((item) => (
          item.value ? (
            <div key={item.label} style={{ marginTop: 7, fontSize: 12, color: "#475569", overflowWrap: "anywhere" }}>
              <span style={{ color: "#94a3b8" }}>{item.label}：</span>{item.value}
            </div>
          ) : null
        ))}

        {smiles ? (
          <>
            <button
              type="button"
              onClick={() => setShowSmiles((value) => !value)}
              style={{
                marginTop: 10,
                border: 0,
                padding: 0,
                background: "transparent",
                color: "#2563eb",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              {showSmiles ? "收起 SMILES" : "查看 SMILES"}
            </button>
            {showSmiles ? (
              <div style={{
                marginTop: 8,
                padding: 9,
                borderRadius: 9,
                background: "#f8fafc",
                color: "#334155",
                fontFamily: "Consolas, monospace",
                fontSize: 11,
                overflowWrap: "anywhere",
              }}>
                {smiles}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}
