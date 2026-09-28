export function normalizeStructureResponse(payload) {
  if (!payload || payload.available !== true || !payload.material) {
    return {
      available: false,
      reason: payload?.reason || "no_approved_structure",
      material: null,
    };
  }

  return {
    available: true,
    reason: "",
    material: {
      ...payload.material,
      components: Array.isArray(payload.material.components)
        ? payload.material.components
        : [],
    },
  };
}

export function structureStatusLabel(status) {
  const labels = {
    approved: "已审核",
    pending: "待审核",
    conflict: "存在冲突",
    rejected: "已拒绝",
  };
  return labels[String(status || "").toLowerCase()] || "未注明";
}

export function formulaCheckLabel(status) {
  const labels = {
    match: "分子式一致",
    mismatch: "分子式需复核",
    salt_or_hydrate: "盐或水合物",
    unavailable: "无法校验",
  };
  return labels[String(status || "").toLowerCase()] || "无法校验";
}
