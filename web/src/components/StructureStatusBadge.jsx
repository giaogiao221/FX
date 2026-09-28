import { formulaCheckLabel, structureStatusLabel } from "../structure-utils";

const tones = {
  green: { background: "#ecfdf5", border: "#a7f3d0", color: "#047857" },
  amber: { background: "#fffbeb", border: "#fde68a", color: "#b45309" },
  red: { background: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
  slate: { background: "#f8fafc", border: "#e2e8f0", color: "#475569" },
};

function Badge({ children, tone = "slate" }) {
  const style = tones[tone] || tones.slate;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      borderRadius: 999,
      border: `1px solid ${style.border}`,
      background: style.background,
      color: style.color,
      fontSize: 12,
      fontWeight: 800,
      padding: "5px 9px",
    }}>
      {children}
    </span>
  );
}

export default function StructureStatusBadge({ reviewStatus, formulaCheck }) {
  const normalizedReview = String(reviewStatus || "").toLowerCase();
  const normalizedFormula = String(formulaCheck || "").toLowerCase();
  const reviewTone = normalizedReview === "approved"
    ? "green"
    : normalizedReview === "conflict"
      ? "red"
      : "amber";
  const formulaTone = normalizedFormula === "match"
    ? "green"
    : normalizedFormula === "mismatch"
      ? "amber"
      : "slate";

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      <Badge tone={reviewTone}>{structureStatusLabel(reviewStatus)}</Badge>
      <Badge tone={formulaTone}>{formulaCheckLabel(formulaCheck)}</Badge>
    </div>
  );
}
