import { useEffect, useRef, useState } from "react";
import { DataSet, Network } from "vis-network/standalone";
import { dedupeGraphPayload } from "./graph-data-utils";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const GROUP_STYLES = {
  // v11：整体缩小节点，预测链路图不再被大圆遮挡文字与边。
  PredictedRiskChain: { color: { background: '#ef4444', border: '#991b1b', highlight: { background: '#dc2626', border: '#7f1d1d' } }, size: 22 },
  MaterialRiskChain: { color: { background: '#f43f5e', border: '#9f1239', highlight: { background: '#e11d48', border: '#881337' } }, size: 21 },
  RiskTrigger: { color: { background: '#f59e0b', border: '#b45309', highlight: { background: '#d97706', border: '#92400e' } }, size: 17 },
  RiskOutcome: { color: { background: '#fb7185', border: '#be123c', highlight: { background: '#f43f5e', border: '#9f1239' } }, size: 18 },
  MaterialRiskRule: { color: { background: '#a78bfa', border: '#7c3aed', highlight: { background: '#8b5cf6', border: '#6d28d9' } }, size: 14 },
  CanonicalMaterial: { color: { background: '#fb7185', border: '#be123c', highlight: { background: '#f43f5e', border: '#9f1239' } }, size: 18 },
  Stimulus: { color: { background: '#f59e0b', border: '#b45309', highlight: { background: '#d97706', border: '#92400e' } }, size: 17 },
  RiskEvent: { color: { background: '#f87171', border: '#dc2626', highlight: { background: '#ef4444', border: '#b91c1c' } }, size: 18 },
  DangerZone: { color: { background: '#f97316', border: '#c2410c', highlight: { background: '#ea580c', border: '#9a3412' } }, size: 16 },
  AreaRule: { color: { background: '#a78bfa', border: '#7c3aed', highlight: { background: '#8b5cf6', border: '#6d28d9' } }, size: 16 },
  ProtectionRule: { color: { background: '#22c55e', border: '#15803d', highlight: { background: '#16a34a', border: '#166534' } }, size: 16 },
  Material: { color: { background: "#fb7185", border: "#be123c", highlight: { background: "#f43f5e", border: "#9f1239" } }, size: 17 },
  HazardFactor: { color: { background: "#facc15", border: "#ca8a04", highlight: { background: "#eab308", border: "#a16207" } }, size: 16 },
  Process: { color: { background: "#60a5fa", border: "#2563eb", highlight: { background: "#3b82f6", border: "#1d4ed8" } }, size: 17 },
  ControlMeasure: { color: { background: "#34d399", border: "#059669", highlight: { background: "#10b981", border: "#047857" } }, size: 16 },
  Personnel: { color: { background: "#a78bfa", border: "#7c3aed", highlight: { background: "#8b5cf6", border: "#6d28d9" } }, size: 16 },
  Equipment: { color: { background: "#fb923c", border: "#ea580c", highlight: { background: "#f97316", border: "#c2410c" } }, size: 16 },
  Environment: { color: { background: "#2dd4bf", border: "#0f766e", highlight: { background: "#14b8a6", border: "#0f766e" } }, size: 16 },
  MaterialFamily: { color: { background: "#e879f9", border: "#a21caf", highlight: { background: "#d946ef", border: "#86198f" } }, size: 20 },
  MaterialCategory: { color: { background: "#93c5fd", border: "#2563eb", highlight: { background: "#60a5fa", border: "#1d4ed8" } }, size: 17 },
  HazardClassification: { color: { background: "#fca5a5", border: "#dc2626", highlight: { background: "#f87171", border: "#b91c1c" } }, size: 16 },
  MaterialProperty: { color: { background: "#7dd3fc", border: "#0284c7", highlight: { background: "#38bdf8", border: "#0369a1" } }, size: 14 },
  PropertyMeasurement: { color: { background: "#bbf7d0", border: "#16a34a", highlight: { background: "#86efac", border: "#15803d" } }, size: 12 },
  ChemicalComponent: { color: { background: "#c4b5fd", border: "#7c3aed", highlight: { background: "#a78bfa", border: "#6d28d9" } }, size: 14 },
  ComponentGroup: { color: { background: "#ddd6fe", border: "#8b5cf6", highlight: { background: "#c4b5fd", border: "#7c3aed" } }, size: 13 },
  HealthEffect: { color: { background: "#fdba74", border: "#ea580c", highlight: { background: "#fb923c", border: "#c2410c" } }, size: 14 },
  ExposureRoute: { color: { background: "#5eead4", border: "#0f766e", highlight: { background: "#2dd4bf", border: "#115e59" } }, size: 13 },
  FirefightingAgent: { color: { background: "#fef08a", border: "#ca8a04", highlight: { background: "#fde047", border: "#a16207" } }, size: 14 },
  Standard: { color: { background: "#2563eb", border: "#1d4ed8", highlight: { background: "#1d4ed8", border: "#1e40af" } }, size: 20 },
  Clause: { color: { background: "#60a5fa", border: "#2563eb", highlight: { background: "#3b82f6", border: "#1d4ed8" } }, size: 16 },
  ManagementRequirement: { color: { background: "#34d399", border: "#059669", highlight: { background: "#10b981", border: "#047857" } }, size: 17 },
  InspectionRequirement: { color: { background: "#fbbf24", border: "#b45309", highlight: { background: "#f59e0b", border: "#92400e" } }, size: 17 },
  Evidence: { color: { background: "#e2e8f0", border: "#94a3b8", highlight: { background: "#cbd5e1", border: "#64748b" } }, size: 9 },
  Property: { color: { background: "#38bdf8", border: "#0284c7", highlight: { background: "#0ea5e9", border: "#0369a1" } }, size: 14 },
  Value: { color: { background: "#86efac", border: "#16a34a", highlight: { background: "#4ade80", border: "#15803d" } }, size: 13 },
  Node: { color: { background: "#cbd5e1", border: "#64748b", highlight: { background: "#94a3b8", border: "#475569" } }, size: 15 },
};

const GRAPH_BG = "radial-gradient(circle at top left, #f8fbff 0, #ffffff 42%, #f8fafc 100%)";

function isRiskGraphMode(graphMode) {
  return ["risk", "riskSingle", "materialRisk", "materialRiskSingle"].includes(graphMode);
}

function isMaterialRiskGraphMode(graphMode) {
  return graphMode === "materialRisk" || graphMode === "materialRiskSingle";
}

function buildUrl({ graphMode, materialId, nodeLimit, edgeLimit, focusChainId, focusRuleId }) {
  if (graphMode === "standardRule" && focusRuleId) {
    return `${API}/graph/standard-rule/${encodeURIComponent(focusRuleId)}?edgeLimit=${encodeURIComponent(edgeLimit)}`;
  }
  if (graphMode === "demoProfile") {
    return `${API}/demo/material/${encodeURIComponent(materialId)}/graph?view=profile`;
  }
  if (graphMode === "demoRisk") {
    return `${API}/demo/material/${encodeURIComponent(materialId)}/graph?view=risk`;
  }
  if (graphMode === "materialRiskSingle" && focusChainId) {
    return `${API}/graph/material-risk-chain/${encodeURIComponent(focusChainId)}`;
  }
  if (graphMode === "materialRisk") {
    return `${API}/graph/material-risk-chains?chainLimit=${encodeURIComponent(nodeLimit)}`;
  }
  if (graphMode === "riskSingle" && focusChainId) {
    return `${API}/graph/risk-chain/${encodeURIComponent(focusChainId)}`;
  }
  if (graphMode === "risk") {
    return `${API}/graph/risk-chains?chainLimit=${encodeURIComponent(nodeLimit)}&edgeLimit=${encodeURIComponent(edgeLimit)}`;
  }
  if (graphMode === "material") {
    return `${API}/graph/material-overview?nodeLimit=${encodeURIComponent(nodeLimit)}&edgeLimit=${encodeURIComponent(edgeLimit)}`;
  }
  if (graphMode === "all") {
    return `${API}/graph/all?nodeLimit=${encodeURIComponent(nodeLimit)}&edgeLimit=${encodeURIComponent(edgeLimit)}`;
  }
  if (graphMode === "properties") {
    return `${API}/graph/material/${encodeURIComponent(materialId)}?view=properties&edgeLimit=${encodeURIComponent(edgeLimit)}`;
  }
  if (graphMode === "focusFull") {
    return `${API}/graph/material/${encodeURIComponent(materialId)}?view=full&edgeLimit=${encodeURIComponent(edgeLimit)}`;
  }
  return `${API}/graph/material/${encodeURIComponent(materialId)}?view=core&edgeLimit=${encodeURIComponent(edgeLimit)}`;
}

function normalizeId(id) {
  return String(id ?? "");
}

function compactLabel(value, max = 24) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ");
  if (cleaned.length <= max) return cleaned;

  const first = cleaned.slice(0, Math.floor(max / 2));
  const second = cleaned.slice(Math.floor(max / 2), max);
  return `${first}\n${second}…`;
}

function compactEdgeLabel(value, max = 18) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function getNodeDistance(count) {
  // v11：节点变小后，适当增强互斥；看起来更清楚，但不会像早期版本那么稀疏。
  if (count > 5000) return 112;
  if (count > 2000) return 132;
  if (count > 800) return 154;
  if (count > 200) return 178;
  return 210;
}

function getRiskPhysicsOptions(nodeCount, edgeCount) {
  const dense = edgeCount > nodeCount * 2.2;

  return {
    enabled: true,
    solver: "forceAtlas2Based",
    maxVelocity: 38,
    minVelocity: 1.05,
    timestep: 0.36,
    stabilization: { enabled: true, iterations: 300, updateInterval: 20, fit: false },
    forceAtlas2Based: {
      // 负值绝对值越大，互斥越强。v11 比 v10 明显增强，避免预测链路大节点堆在一起。
      gravitationalConstant: dense ? -74 : -62,
      centralGravity: dense ? 0.045 : 0.055,
      springLength: dense ? 126 : 146,
      springConstant: 0.062,
      damping: 0.82,
      avoidOverlap: 1.0,
    },
  };
}

function getPhysicsOptions(nodeCount, edgeCount) {
  const huge = nodeCount > 2500;
  const large = nodeCount > 800;
  const dense = edgeCount > nodeCount * 1.6;

  if (huge) {
    return {
      enabled: true,
      solver: "forceAtlas2Based",
      maxVelocity: 54,
      minVelocity: 1.2,
      timestep: 0.4,
      stabilization: { enabled: true, iterations: 160, updateInterval: 20, fit: false },
      forceAtlas2Based: {
        gravitationalConstant: dense ? -58 : -46,
        centralGravity: 0.028,
        springLength: dense ? 96 : 122,
        springConstant: 0.062,
        damping: 0.72,
        avoidOverlap: 0.82,
      },
    };
  }

  return {
    enabled: true,
    solver: "repulsion",
    maxVelocity: large ? 46 : 40,
    minVelocity: 1.1,
    timestep: 0.42,
    stabilization: { enabled: true, iterations: large ? 180 : 240, updateInterval: 20, fit: false },
    repulsion: {
      // 这是“互斥”的核心参数：值越大，节点越分散，越不容易重叠。
      // 当前版本比上一版收紧约 20%-30%，视觉上更紧凑。
      nodeDistance: getNodeDistance(nodeCount),
      centralGravity: large ? 0.055 : 0.075,
      springLength: dense ? 118 : 152,
      springConstant: 0.052,
      damping: 0.72,
    },
  };
}

function graphButtonStyle(disabled = false) {
  return {
    minWidth: 34,
    height: 34,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    borderRadius: 12,
    background: disabled ? "rgba(248, 250, 252, 0.7)" : "rgba(255, 255, 255, 0.92)",
    color: disabled ? "#94a3b8" : "#0f172a",
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.10)",
    backdropFilter: "blur(10px)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
  };
}

export default function GraphView({
  materialId,
  graphMode = "focus",
  nodeLimit = 600,
  edgeLimit = 1200,
  height = 640,
  onSelect,
  onMeta,
  focusNodeId = "",
  focusChainId = "",
  focusRuleId = "",
}) {
  const ref = useRef(null);
  const networkRef = useRef(null);
  const [err, setErr] = useState("");
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [layoutLocked, setLayoutLocked] = useState(true);

  const fitGraph = () => {
    const net = networkRef.current;
    if (!net) return;
    net.fit({ animation: { duration: 650, easingFunction: "easeInOutQuad" } });
  };

  const zoomGraph = (factor) => {
    const net = networkRef.current;
    if (!net) return;
    const scale = net.getScale();
    const next = Math.max(0.08, Math.min(3.5, scale * factor));
    net.moveTo({ scale: next, animation: { duration: 260, easingFunction: "easeInOutQuad" } });
  };

  const freezeGraph = (net = networkRef.current) => {
    if (!net) return;
    try {
      net.stopSimulation();
      net.setOptions({ physics: { enabled: false } });
      setLayoutLocked(true);
    } catch {
      // ignore freeze errors
    }
  };

  const stabilizeGraph = () => {
    const net = networkRef.current;
    if (!net) return;
    setLoading(true);
    setLayoutLocked(false);
    net.setOptions({ physics: (isRiskGraphMode(graphMode)) ? getRiskPhysicsOptions(300, 500) : getPhysicsOptions(300, 500) });
    net.stabilize(isRiskGraphMode(graphMode) ? 260 : 180);
    setTimeout(() => {
      freezeGraph(net);
      setLoading(false);
      try {
        net.fit({ animation: { duration: 420, easingFunction: "easeInOutQuad" } });
      } catch {
        // ignore fit errors
      }
    }, 1600);
  };

  const toggleLayoutLock = () => {
    const net = networkRef.current;
    if (!net) return;

    if (layoutLocked) {
      setLayoutLocked(false);
      net.setOptions({ physics: (isRiskGraphMode(graphMode)) ? getRiskPhysicsOptions(300, 500) : getPhysicsOptions(300, 500) });
      net.startSimulation();
      return;
    }

    freezeGraph(net);
  };

  useEffect(() => {
    if ((!materialId && graphMode !== "standardRule" && graphMode !== "material" && graphMode !== "all" && graphMode !== "risk" && graphMode !== "riskSingle" && graphMode !== "materialRisk" && graphMode !== "materialRiskSingle") || !ref.current) return undefined;

    let cancelled = false;
    setErr("");
    setEmpty(false);
    setLoading(true);
    setLayoutLocked(false);

    (async () => {
      try {
        const res = await fetch(buildUrl({ graphMode, materialId, nodeLimit, edgeLimit, focusChainId, focusRuleId }));
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "graph api error");
        if (cancelled) return;

        const deduped = dedupeGraphPayload(data);
        const rawNodes = deduped.nodes;
        const rawEdges = deduped.edges;
        const isRiskGraph = isRiskGraphMode(graphMode);
        const isDemoGraph = graphMode === 'demoProfile' || graphMode === 'demoRisk';
        const showEdgeLabels = isDemoGraph ? true : (isRiskGraph ? rawEdges.length <= 180 : rawEdges.length <= 120);
        const showNodeLabels = isDemoGraph ? true : (isRiskGraph ? rawNodes.length <= 900 : rawNodes.length <= 1200);

        const degree = new Map();
        for (const e of rawEdges) {
          const from = normalizeId(e.from);
          const to = normalizeId(e.to);
          degree.set(from, (degree.get(from) || 0) + 1);
          degree.set(to, (degree.get(to) || 0) + 1);
        }

        const nodes = rawNodes.map((n) => {
          const id = normalizeId(n.id);
          const d = degree.get(id) || 1;
          const baseSize = GROUP_STYLES[n.group]?.size || GROUP_STYLES.Node.size;
          const isChainNode = n.group === 'PredictedRiskChain' || n.group === 'MaterialRiskChain';
          const degreeBoost = Math.log2(d + 1) * (isRiskGraph ? 1.25 : 2.15);
          const chainBoost = isChainNode ? 3 : 0;
          const computedSize = Math.min(baseSize + chainBoost + degreeBoost, isRiskGraph ? 30 : 38);

          return {
            id,
            label: showNodeLabels ? compactLabel(n.label) : "",
            group: n.group || "Node",
            title: `${n.group || "Node"}: ${n.label || id}\n连接数：${d}`,
            props: n.props || {},
            labels: n.labels || [],
            shape: isDemoGraph && n.group !== "Material" ? "box" : "dot",
            margin: isDemoGraph ? 10 : undefined,
            widthConstraint: isDemoGraph ? { maximum: 180 } : undefined,
            level: isDemoGraph ? Number(n.props?._demoLevel ?? 0) : undefined,
            size: isDemoGraph ? Math.max(computedSize, n.group === "Material" ? 24 : 17) : computedSize,
            // 节点小一些但质量稍高，配合 forceAtlas2Based 的 avoidOverlap 形成更明显的互斥。
            mass: isRiskGraph ? Math.max(1.4, Math.min(3.8, 1.35 + d / 10)) : Math.max(1.05, Math.min(2.8, 1 + d / 15)),
            borderWidth: isRiskGraph ? 1.6 : 2,
            chosen: {
              node(values) {
                values.borderWidth = 4;
                values.shadow = true;
              },
              label(values) {
                values.size = values.size + 1;
                values.mod = "bold";
              },
            },
          };
        });

        const edges = rawEdges.map((e, idx) => ({
          id: normalizeId(e.id || `${normalizeId(e.from)}-${normalizeId(e.to)}-${idx}`),
          from: normalizeId(e.from),
          to: normalizeId(e.to),
          label: showEdgeLabels ? compactEdgeLabel(e.type) : "",
          arrows: { to: { enabled: true, scaleFactor: isRiskGraph ? 0.42 : (rawEdges.length > 1000 ? 0.45 : 0.65) } },
          title: e.relationType ? `${e.type} (${e.relationType})` : e.type,
          props: e.props || {},
          width: isDemoGraph ? 1.8 : (isRiskGraph ? 0.72 : (rawEdges.length > 1200 ? 0.8 : 1.15)),
          selectionWidth: isDemoGraph ? 3 : (isRiskGraph ? 2.1 : 2.4),
          hoverWidth: isRiskGraph ? 1.45 : 1.8,
          dashes: Boolean(e.props?.inference),
        }));

        const meta = {
          ...(data.meta || {}),
          mode: graphMode,
          returnedNodes: rawNodes.length,
          returnedEdges: rawEdges.length,
        };
        onMeta?.(meta);
        setEmpty(nodes.length <= 1 && edges.length === 0);

        const nodesDS = new DataSet(nodes);
        const edgesDS = new DataSet(edges);

        if (networkRef.current) {
          networkRef.current.destroy();
          networkRef.current = null;
        }
        ref.current.innerHTML = "";

        const manyNodes = nodes.length > 1200;
        const options = {
          autoResize: true,
          layout: isDemoGraph || graphMode === "properties"
            ? {
                hierarchical: {
                  enabled: true,
                  direction: "LR",
                  sortMethod: "directed",
                  levelSeparation: isDemoGraph ? 250 : 190,
                  nodeSpacing: isDemoGraph ? 120 : 92,
                  treeSpacing: isDemoGraph ? 180 : 150,
                  blockShifting: true,
                  edgeMinimization: true,
                  parentCentralization: true,
                },
              }
            : { improvedLayout: nodes.length <= 2000, randomSeed: 12 },
          physics: isDemoGraph || graphMode === "properties"
            ? false
            : (isRiskGraphMode(graphMode))
              ? getRiskPhysicsOptions(nodes.length, edges.length)
              : getPhysicsOptions(nodes.length, edges.length),
          interaction: {
            hover: true,
            tooltipDelay: 80,
            navigationButtons: false,
            keyboard: true,
            multiselect: false,
            hideEdgesOnDrag: isDemoGraph ? false : nodes.length > 1200,
            hideEdgesOnZoom: isDemoGraph ? false : nodes.length > 2200,
            zoomView: true,
            dragView: true,
          },
          nodes: {
            shape: "dot",
            borderWidth: 2,
            shadow: {
              enabled: true,
              color: "rgba(15, 23, 42, 0.16)",
              size: isRiskGraph ? 5 : 8,
              x: 0,
              y: isRiskGraph ? 2 : 4,
            },
            font: {
              size: isDemoGraph ? 13 : (isRiskGraph ? 10 : (manyNodes ? 11 : 13)),
              face: 'Inter, "Microsoft YaHei", Arial, sans-serif',
              color: "#0f172a",
              strokeWidth: isRiskGraph ? 3 : 4,
              strokeColor: "rgba(255, 255, 255, 0.92)",
              vadjust: 3,
              multi: true,
            },
          },
          edges: {
            smooth: isDemoGraph
              ? { enabled: true, type: "cubicBezier", forceDirection: "horizontal", roundness: 0.25 }
              : {
                  enabled: edges.length <= 2500,
                  type: "continuous",
                  roundness: isRiskGraph ? 0.08 : 0.15,
                },
            font: {
              size: isRiskGraph ? 8 : 10,
              face: 'Inter, "Microsoft YaHei", Arial, sans-serif',
              align: "middle",
              color: "#475569",
              strokeWidth: 4,
              strokeColor: "rgba(255, 255, 255, 0.94)",
            },
            color: {
              color: isDemoGraph ? "rgba(37,99,235,.42)" : "rgba(100, 116, 139, 0.45)",
              highlight: "#2563eb",
              hover: "#3b82f6",
              opacity: 0.78,
            },
          },
          groups: GROUP_STYLES,
        };

        const net = new Network(ref.current, { nodes: nodesDS, edges: edgesDS }, options);
        networkRef.current = net;

        const focusAfterLayout = () => {
          if (!focusNodeId || !nodesDS.get(focusNodeId)) return;
          try {
            net.selectNodes([focusNodeId]);
            net.focus(focusNodeId, {
              scale: graphMode === "riskSingle" ? 1.05 : 0.86,
              animation: { duration: 620, easingFunction: "easeInOutQuad" },
            });
          } catch {
            // ignore focus errors
          }
        };

        net.once("stabilizationIterationsDone", () => {
          if (cancelled) return;
          freezeGraph(net);
          setLoading(false);
          try {
            net.fit({ animation: { duration: 520, easingFunction: "easeInOutQuad" } });
            setTimeout(focusAfterLayout, 560);
          } catch {
            // ignore fit errors
          }
        });

        net.once("stabilized", () => {
          if (cancelled) return;
          freezeGraph(net);
          setLoading(false);
        });

        net.on("click", (params) => {
          const nodeId = params.nodes?.[0];
          const edgeId = params.edges?.[0];
          if (!onSelect) return;

          if (nodeId) {
            const n = nodesDS.get(nodeId);
            onSelect({ kind: "node", id: nodeId, data: n || null });
          } else if (edgeId) {
            const e = edgesDS.get(edgeId);
            onSelect({ kind: "edge", id: edgeId, data: e || null });
          } else {
            onSelect(null);
          }
        });

        setTimeout(() => {
          if (!cancelled) {
            freezeGraph(net);
            setLoading(false);
            focusAfterLayout();
          }
        }, isDemoGraph ? 180 : (nodes.length > 2500 ? 2600 : 1800));
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setErr(String(e));
        setLoading(false);
        onMeta?.({ mode: graphMode, returnedNodes: 0, returnedEdges: 0 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [materialId, graphMode, nodeLimit, edgeLimit, focusChainId, focusRuleId, focusNodeId, onSelect, onMeta]);

  useEffect(() => {
    const net = networkRef.current;
    if (!net || !focusNodeId) return;
    try {
      net.selectNodes([focusNodeId]);
      net.focus(focusNodeId, {
        scale: graphMode === "riskSingle" ? 1.05 : 0.86,
        animation: { duration: 520, easingFunction: "easeInOutQuad" },
      });
    } catch {
      // ignore focus errors
    }
  }, [focusNodeId, graphMode]);

  return (
    <div
      style={{
        height,
        border: "1px solid rgba(148, 163, 184, 0.22)",
        borderRadius: 22,
        overflow: "hidden",
        background: GRAPH_BG,
        position: "relative",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8), 0 18px 45px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div ref={ref} style={{ height: "100%" }} />

      <div
        style={{
          position: "absolute",
          right: 14,
          top: 14,
          display: "flex",
          gap: 8,
          zIndex: 5,
        }}
      >
        <button type="button" onClick={fitGraph} style={graphButtonStyle()} title="居中适配">
          居中
        </button>
        <button type="button" onClick={() => zoomGraph(1.18)} style={graphButtonStyle()} title="放大">
          ＋
        </button>
        <button type="button" onClick={() => zoomGraph(0.84)} style={graphButtonStyle()} title="缩小">
          －
        </button>
        {graphMode === "demoProfile" || graphMode === "demoRisk" ? null : (
          <>
            <button type="button" onClick={stabilizeGraph} style={graphButtonStyle()} title="重新计算一次布局，完成后自动锁定">
              重排
            </button>
            <button
              type="button"
              onClick={toggleLayoutLock}
              style={{
                ...graphButtonStyle(),
                minWidth: 66,
                borderColor: layoutLocked ? "rgba(22, 163, 74, 0.24)" : "rgba(245, 158, 11, 0.32)",
                color: layoutLocked ? "#15803d" : "#b45309",
              }}
              title={layoutLocked ? "布局已锁定，节点不会继续抖动；点击可临时解锁拖拽重排" : "布局正在运动；点击立即锁定"}
            >
              {layoutLocked ? "已锁定" : "锁定"}
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div
          style={{
            position: "absolute",
            left: 14,
            top: 14,
            padding: "9px 12px",
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(148, 163, 184, 0.22)",
            borderRadius: 14,
            color: "#334155",
            fontSize: 12,
            fontWeight: 700,
            boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
            backdropFilter: "blur(10px)",
          }}
        >
          {graphMode === "demoProfile" || graphMode === "demoRisk" ? "正在生成业务视图..." : "图谱布局中，稳定后会自动锁定..."}
        </div>
      ) : null}
      {empty ? (
        <div
          style={{
            position: "absolute",
            left: 14,
            bottom: 14,
            padding: "9px 12px",
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(148, 163, 184, 0.22)",
            borderRadius: 14,
            color: "#475569",
            fontSize: 12,
            boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
            backdropFilter: "blur(10px)",
          }}
        >
          {isMaterialRiskGraphMode(graphMode)
            ? '当前材料没有命中可生成风险链的属性，或所选筛选条件下没有链路。'
            : isRiskGraphMode(graphMode)
              ? '产线预测链路为空，请先确认 HAZOP 推理结果已生成。'
              : graphMode === 'all'
              ? '当前全图结果为空，请确认数据库中已有节点/关系。'
              : graphMode === 'demoProfile' || graphMode === 'demoRisk'
                ? '该材料当前没有可用于当前业务视图的结构化关系。'
                : '该节点暂无直接关系，所以图中只有一个节点。'}
        </div>
      ) : null}
      {err ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: 18,
            background: "rgba(255,255,255,0.96)",
            color: "#b00020",
            whiteSpace: "pre-wrap",
            fontWeight: 700,
          }}
        >
          图谱渲染失败：{err}
        </div>
      ) : null}
    </div>
  );
}
