import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";

// Mini Graph Canvas v8 — smooth grab-mode pan + wheel zoom + snap-to-grid + zoom % + full-bleed grid + drag constraints
// Tweaks: floating palette, connect auto-select, palette-driven add mode, simplified shortcuts.

const uid = (() => {
  let n = 1;
  return () => `id_${n++}`;
})();

// ----------------------------------------
// Math / helpers
// ----------------------------------------
const GRID = 24; // grid size in world units
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const BG_EXTENT = 100000; // big world rect for full-bleed grid
const WORLD = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 };
const NODE_WIDTH = 168;
const NODE_HEIGHT = 72;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const snap = (v, step = GRID) => Math.round(v / step) * step;

function nodeCenter(n) {
  return { cx: n.x + n.width / 2, cy: n.y + n.height / 2 };
}
function rectBorderAnchor(node, tx, ty) {
  const { cx, cy } = nodeCenter(node);
  const dx = tx - cx;
  const dy = ty - cy;
  const halfW = node.width / 2;
  const halfH = node.height / 2;
  const px = dx === 0 ? Number.POSITIVE_INFINITY : Math.abs(halfW / dx);
  const py = dy === 0 ? Number.POSITIVE_INFINITY : Math.abs(halfH / dy);
  const m = Math.min(px, py);
  return { x: cx + dx * m, y: cy + dy * m };
}
function normal2D(x, y) {
  return [-y, x];
}
function vecNormalize(x, y) {
  const L = Math.hypot(x, y) || 1;
  return [x / L, y / L];
}
function defaultControlPoint(p0, p2, bump = 80) {
  const mx = (p0.x + p2.x) / 2;
  const my = (p0.y + p2.y) / 2;
  const [nx, ny] = vecNormalize(...normal2D(p2.x - p0.x, p2.y - p0.y));
  return { cx: mx + nx * bump, cy: my + ny * bump };
}
function svgPoint(svgEl, clientX, clientY) {
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const mat = svgEl.getScreenCTM()?.inverse();
  return mat ? pt.matrixTransform(mat) : { x: clientX, y: clientY };
}
function qPoint(p0, p1, p2, t) {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}
function controlFromT(p0, p2, t, M) {
  const u = 1 - t;
  const denom = 2 * u * t;
  if (denom < 1e-6) {
    return { cx: 2 * M.x - 0.5 * p0.x - 0.5 * p2.x, cy: 2 * M.y - 0.5 * p0.y - 0.5 * p2.y };
  }
  return {
    cx: (M.x - u * u * p0.x - t * t * p2.x) / denom,
    cy: (M.y - u * u * p0.y - t * t * p2.y) / denom,
  };
}

// ----------------------------------------
// Icons & palette
// ----------------------------------------
const CallLLMIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 5h11a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-3.2L10 18.5V14H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" />
    <path d="M15 8h.01M12 8h.01M9 8h.01" />
  </svg>
);

const ToolCallIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 14.5a3.5 3.5 0 0 1-5-3.2L9.8 5.9a3.5 3.5 0 0 1-4.7 4.7l1.8 1.8L5 14.3l4.7 4.7 1.8-1.9 1.8 1.8a3.5 3.5 0 0 1 4.7-4.7z" />
  </svg>
);

const TaskIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5h10M9 9h10M9 13h10M5 5h.01M5 9h.01M5 13h.01" />
  </svg>
);

const VerificationIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 5 6v6c0 4 2.6 7.4 7 9 4.4-1.6 7-5 7-9V6l-7-3z" />
    <path d="m9.5 12 1.8 1.8 3.2-3.3" />
  </svg>
);

const paletteTemplates = [
  { id: "call-llm", label: "Call LLM", icon: CallLLMIcon },
  { id: "tool-call", label: "Tool call", icon: ToolCallIcon },
  { id: "task", label: "Task", icon: TaskIcon },
  { id: "verification", label: "Verification", icon: VerificationIcon },
];

const PaletteButton = ({ template, active, onSelect }) => {
  const Icon = template.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition shadow-sm ${
        active ? "bg-sky-50 border-sky-200 text-sky-700" : "bg-white/90 border-neutral-200 hover:border-neutral-300 text-neutral-700"
      }`}
    >
      <Icon className={active ? "w-4 h-4 text-sky-600" : "w-4 h-4 text-neutral-500"} />
      <span>{template.label}</span>
    </button>
  );
};

const ModeButton = ({ name, value, hotkey, current, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(value)}
    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
      current === value ? "bg-neutral-900 text-white border-neutral-900" : "bg-white/95 border-neutral-200 hover:border-neutral-300"
    }`}
    title={hotkey ? `${name} (${hotkey})` : name}
  >
    {name}
    {hotkey ? ` (${hotkey})` : ""}
  </button>
);

export default function CanvasPage() {
  const svgRef = useRef(null);

  // View (pan/zoom)
  const [view, setView] = useState({ scale: 1, panX: 0, panY: 0 });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const [mode, setMode] = useState("select"); // 'select' | 'add-node' | 'connect'
  const [pendingTemplateId, setPendingTemplateId] = useState(null);
  const [nodes, setNodes] = useState([
    { id: uid(), x: 140, y: 120, width: NODE_WIDTH, height: NODE_HEIGHT, label: "Node A" },
    { id: uid(), x: 460, y: 240, width: NODE_WIDTH, height: NODE_HEIGHT, label: "Node B" },
  ]);
  const [edges, setEdges] = useState(() => {
    const s = 0;
    const t = 1;
    const p0 = rectBorderAnchor(nodes[s], nodes[t].x, nodes[t].y);
    const p2 = rectBorderAnchor(nodes[t], nodes[s].x, nodes[s].y);
    const cp = defaultControlPoint(p0, p2, 60);
    return [{ id: uid(), sourceId: nodes[s].id, targetId: nodes[t].id, cx: cp.cx, cy: cp.cy }];
  });

  // Selection & hover
  const [selection, setSelection] = useState({ type: null, id: null }); // 'node' | 'edge' | null
  const [hover, setHover] = useState({ type: null, id: null }); // 'node' | 'edge' | null
  const [connectSourceId, setConnectSourceId] = useState(null);
  const [connectPreview, setConnectPreview] = useState(null);
  const [nodePreview, setNodePreview] = useState(null);
  const [isPointerInsideCanvas, setIsPointerInsideCanvas] = useState(false);

  // Drag state: 'node' | 'ctrl' | 'pan'
  const dragRef = useRef({ type: null, id: null, dx: 0, dy: 0, t: 0.5 });
  const [spacePressed, setSpacePressed] = useState(false);

  // rAF batching for panning
  const panDeltaRef = useRef({ dx: 0, dy: 0 });
  const panRafRef = useRef(0);
  const lastPointerWorldRef = useRef(null);

  const currentTemplate = useMemo(
    () => paletteTemplates.find((tpl) => tpl.id === pendingTemplateId) || null,
    [pendingTemplateId]
  );

  const clampPanToWorld = (panX, panY, scale) => {
    const svg = svgRef.current;
    if (!svg) return { panX, panY };
    const { width: w, height: h } = svg.getBoundingClientRect();
    const minPanX = w - WORLD.maxX * scale;
    const maxPanX = -WORLD.minX * scale;
    const minPanY = h - WORLD.maxY * scale;
    const maxPanY = -WORLD.minY * scale;

    const worldWidthPx = (WORLD.maxX - WORLD.minX) * scale;
    const worldHeightPx = (WORLD.maxY - WORLD.minY) * scale;
    let x = panX;
    let y = panY;
    if (worldWidthPx <= w) {
      const centerX = w / 2 - ((WORLD.minX + WORLD.maxX) / 2) * scale;
      x = centerX;
    } else {
      x = clamp(panX, minPanX, maxPanX);
    }
    if (worldHeightPx <= h) {
      const centerY = h / 2 - ((WORLD.minY + WORLD.maxY) / 2) * scale;
      y = centerY;
    } else {
      y = clamp(panY, minPanY, maxPanY);
    }
    return { panX: x, panY: y };
  };

  const schedulePanFrame = () => {
    if (panRafRef.current) return;
    panRafRef.current = requestAnimationFrame(() => {
      const { dx, dy } = panDeltaRef.current;
      panDeltaRef.current.dx = 0;
      panDeltaRef.current.dy = 0;
      panRafRef.current = 0;
      if (dx || dy) {
        setView((prev) => {
          const unclampedX = prev.panX + dx;
          const unclampedY = prev.panY + dy;
          const { panX, panY } = clampPanToWorld(unclampedX, unclampedY, prev.scale);
          return { ...prev, panX, panY };
        });
      }
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        setSpacePressed(true);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection.type === "node" && selection.id) {
          setNodes((prev) => prev.filter((n) => n.id !== selection.id));
          setEdges((prev) => prev.filter((ed) => ed.sourceId !== selection.id && ed.targetId !== selection.id));
          setSelection({ type: null, id: null });
        } else if (selection.type === "edge" && selection.id) {
          setEdges((prev) => prev.filter((ed) => ed.id !== selection.id));
          setSelection({ type: null, id: null });
        }
      }
      if (e.key.toLowerCase() === "c") {
        setPendingTemplateId(null);
        setMode("connect");
      }
      if (e.key === "Escape") {
        if ((mode === "add-node" && currentTemplate) || mode === "connect") {
          e.preventDefault();
          activateSelectMode();
        }
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        setSpacePressed(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selection, mode, currentTemplate]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const computeNodePreviewPosition = useCallback((point) => {
    const halfWidth = NODE_WIDTH / 2;
    const halfHeight = NODE_HEIGHT / 2;
    const x = clamp(point.x - halfWidth, WORLD.minX, WORLD.maxX - NODE_WIDTH);
    const y = clamp(point.y - halfHeight, WORLD.minY, WORLD.maxY - NODE_HEIGHT);
    return { x, y };
  }, []);

  useEffect(() => {
    if (!connectSourceId) {
      setConnectPreview(null);
    }
  }, [connectSourceId]);

  useEffect(() => {
    if (mode !== "connect") {
      setConnectPreview(null);
    }
  }, [mode]);

  useEffect(() => {
    if (spacePressed || mode !== "add-node" || !currentTemplate || !isPointerInsideCanvas) {
      setNodePreview(null);
      return;
    }
    if (lastPointerWorldRef.current) {
      setNodePreview(computeNodePreviewPosition(lastPointerWorldRef.current));
    }
  }, [spacePressed, mode, currentTemplate, isPointerInsideCanvas, computeNodePreviewPosition]);

  function getSvgPointInWorld(clientX, clientY) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    return svgPoint(svg, clientX, clientY);
  }
  function getWorldPoint(clientX, clientY) {
    const p = getSvgPointInWorld(clientX, clientY);
    const v = viewRef.current;
    return { x: (p.x - v.panX) / v.scale, y: (p.y - v.panY) / v.scale };
  }

  useEffect(() => {
    const onMove = (e) => {
      const drag = dragRef.current;
      if (!drag.type) return;

      if (drag.type === "pan") {
        const mx = e.movementX ?? 0;
        const my = e.movementY ?? 0;
        panDeltaRef.current.dx += mx;
        panDeltaRef.current.dy += my;
        schedulePanFrame();
        e.preventDefault();
        return;
      }

      const pw = getWorldPoint(e.clientX, e.clientY);
      if (drag.type === "node" && drag.id) {
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id !== drag.id) return n;
            let x = snap(pw.x - drag.dx);
            let y = snap(pw.y - drag.dy);
            x = clamp(x, WORLD.minX, WORLD.maxX - n.width);
            y = clamp(y, WORLD.minY, WORLD.maxY - n.height);
            return { ...n, x, y };
          })
        );
      } else if (drag.type === "ctrl" && drag.id) {
        setEdges((prev) =>
          prev.map((ed) => {
            if (ed.id !== drag.id) return ed;
            const s = nodeMap.get(ed.sourceId);
            const t = nodeMap.get(ed.targetId);
            if (!s || !t) return ed;
            const sC = nodeCenter(s);
            const tC = nodeCenter(t);
            const p0 = rectBorderAnchor(s, tC.cx, tC.cy);
            const p2 = rectBorderAnchor(t, sC.cx, sC.cy);
            const snapped = {
              x: clamp(snap(pw.x), WORLD.minX, WORLD.maxX),
              y: clamp(snap(pw.y), WORLD.minY, WORLD.maxY),
            };
            const cp = controlFromT(p0, p2, drag.t, snapped);
            return { ...ed, cx: cp.cx, cy: cp.cy };
          })
        );
      }
      e.preventDefault();
    };
    const onUp = (e) => {
      const svg = svgRef.current;
      if (svg && dragRef.current.type === "pan") {
        try {
          svg.releasePointerCapture(e.pointerId);
        } catch {}
      }
      dragRef.current = { type: null, id: null, dx: 0, dy: 0, t: 0.5 };
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [nodeMap]);

  const onWheel = (e) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const pSvg = svgPoint(svg, e.clientX, e.clientY);
    const factor = Math.pow(1.0015, -e.deltaY);
    setView((prev) => {
      const newScale = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE);
      const worldX = (pSvg.x - prev.panX) / prev.scale;
      const worldY = (pSvg.y - prev.panY) / prev.scale;
      let panX = pSvg.x - worldX * newScale;
      let panY = pSvg.y - worldY * newScale;
      ({ panX, panY } = clampPanToWorld(panX, panY, newScale));
      return { scale: newScale, panX, panY };
    });
  };

  const activateSelectMode = () => {
    setMode("select");
    setPendingTemplateId(null);
    setConnectSourceId(null);
    setConnectPreview(null);
    setNodePreview(null);
  };
  const activateConnectMode = () => {
    setMode("connect");
    setPendingTemplateId(null);
    setConnectSourceId(null);
    setConnectPreview(null);
    setNodePreview(null);
  };
  const activateTemplate = (templateId) => {
    if (mode === "add-node" && pendingTemplateId === templateId) {
      activateSelectMode();
      return;
    }
    setConnectSourceId(null);
    setMode("add-node");
    setPendingTemplateId(templateId);
  };

  const onSVGPointerDown = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    if (spacePressed) {
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {}
      dragRef.current = { type: "pan", id: null, dx: 0, dy: 0, t: 0.5 };
      e.preventDefault();
    }
  };
  const onSVGPointerEnter = (e) => {
    setIsPointerInsideCanvas(true);
    const pw = getWorldPoint(e.clientX, e.clientY);
    lastPointerWorldRef.current = pw;
    if (spacePressed) return;
    if (mode === "connect" && connectSourceId) {
      setConnectPreview(pw);
    } else if (mode === "add-node" && currentTemplate) {
      setNodePreview(computeNodePreviewPosition(pw));
    }
  };
  const onSVGPointerMove = (e) => {
    const pw = getWorldPoint(e.clientX, e.clientY);
    lastPointerWorldRef.current = pw;

    if (spacePressed) {
      if (nodePreview) {
        setNodePreview(null);
      }
      return;
    }

    if (mode === "connect" && connectSourceId) {
      setConnectPreview(pw);
    } else if (mode === "add-node" && currentTemplate) {
      setNodePreview(computeNodePreviewPosition(pw));
    }
  };
  const onSVGPointerUp = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    if (dragRef.current.type === "pan") {
      try {
        svg.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const onSVGPointerLeave = () => {
    setIsPointerInsideCanvas(false);
    lastPointerWorldRef.current = null;
    if (mode === "connect") {
      setConnectPreview(null);
    }
    setNodePreview(null);
  };

  const onSVGClick = (e) => {
    if (spacePressed) return;
    const pw = getWorldPoint(e.clientX, e.clientY);
    if (mode === "add-node" && currentTemplate) {
      const id = uid();
      const placement = nodePreview || computeNodePreviewPosition(pw);
      setNodes((prev) =>
        prev.concat({ id, x: placement.x, y: placement.y, width: NODE_WIDTH, height: NODE_HEIGHT, label: currentTemplate.label })
      );
      setSelection({ type: "node", id });
      if (!nodePreview) {
        setNodePreview(placement);
      }
      setPendingTemplateId(null)
      return;
    }
    setSelection({ type: null, id: null });
    setHover({ type: null, id: null });
    setConnectSourceId(null);
  };

  const onNodePointerDown = (e, id) => {
    if (spacePressed) return;
    e.stopPropagation();
    const pw = getWorldPoint(e.clientX, e.clientY);
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    dragRef.current = { type: "node", id, dx: pw.x - node.x, dy: pw.y - node.y, t: 0.5 };
    setSelection({ type: "node", id });
  };
  const onNodeClick = (e, id) => {
    if (spacePressed) return;
    e.stopPropagation();
    if (mode === "connect") {
      if (!connectSourceId) {
        setConnectSourceId(id);
        setSelection({ type: "node", id });
        const pw = getWorldPoint(e.clientX, e.clientY);
        setConnectPreview(pw);
        return;
      } else if (connectSourceId && connectSourceId !== id) {
        const sourceNode = nodes.find((n) => n.id === connectSourceId);
        const destNode = nodes.find((n) => n.id === id);
        if (sourceNode && destNode) {
          let createdEdgeId = null;
          setEdges((prev) => {
            const duplicate = prev.some(
              (ed) =>
                (ed.sourceId === sourceNode.id && ed.targetId === destNode.id) || (ed.sourceId === destNode.id && ed.targetId === sourceNode.id)
            );
            if (duplicate) {
              return prev;
            }
            const a = rectBorderAnchor(sourceNode, destNode.x + destNode.width / 2, destNode.y + destNode.height / 2);
            const b = rectBorderAnchor(destNode, sourceNode.x + sourceNode.width / 2, sourceNode.y + sourceNode.height / 2);
            const cp = defaultControlPoint(a, b, 60);
            const edgeId = uid();
            createdEdgeId = edgeId;
            return prev.concat({ id: edgeId, sourceId: sourceNode.id, targetId: destNode.id, cx: cp.cx, cy: cp.cy });
          });
          if (createdEdgeId) {
            setSelection({ type: "edge", id: createdEdgeId });
            activateSelectMode();
          } else {
            const existing = edges.find(
              (ed) =>
                (ed.sourceId === sourceNode.id && ed.targetId === destNode.id) || (ed.sourceId === destNode.id && ed.targetId === sourceNode.id)
            );
            if (existing) {
              setSelection({ type: "edge", id: existing.id });
            }
            setConnectSourceId(null);
            setConnectPreview(null);
          }
          activateSelectMode();
        }
        return;
      }
    } else {
      setSelection({ type: "node", id });
    }
  };

  const onEdgeClick = (e, id) => {
    if (spacePressed) return;
    e.stopPropagation();
    setSelection({ type: "edge", id });
  };
  const onEdgeEnter = (e, id) => {
    setHover({ type: "edge", id });
  };
  const onEdgeLeave = () => {
    setHover({ type: null, id: null });
  };
  const onNodeEnter = (id) => {
    setHover({ type: "node", id });
  };
  const onNodeLeave = () => {
    setHover({ type: null, id: null });
  };

  const onEdgeHandlePointerDown = (e, edgeId, tFixed) => {
    if (spacePressed) return;
    e.stopPropagation();
    dragRef.current = { type: "ctrl", id: edgeId, dx: 0, dy: 0, t: tFixed };
    setSelection({ type: "edge", id: edgeId });
  };

  const nodeMapRender = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const connectPreviewPath = useMemo(() => {
    if (mode !== "connect" || !connectSourceId || !connectPreview) return null;
    const source = nodeMapRender.get(connectSourceId);
    if (!source) return null;
    const start = rectBorderAnchor(source, connectPreview.x, connectPreview.y);
    const cp = defaultControlPoint(start, connectPreview, 60);
    const d = `M ${start.x} ${start.y} Q ${cp.cx} ${cp.cy} ${connectPreview.x} ${connectPreview.y}`;
    return { d };
  }, [mode, connectSourceId, connectPreview, nodeMapRender]);
  function edgeGeometry(edge) {
    const s = nodeMapRender.get(edge.sourceId);
    const t = nodeMapRender.get(edge.targetId);
    if (!s || !t) return null;
    const sC = nodeCenter(s);
    const tC = nodeCenter(t);
    const p0 = rectBorderAnchor(s, tC.cx, tC.cy);
    const p2 = rectBorderAnchor(t, sC.cx, sC.cy);
    const c = { x: edge.cx, y: edge.cy };
    const d = `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`;
    const tMid = 0.5;
    const mid = qPoint(p0, c, p2, tMid);
    return { d, p0, p2, c, tMid, mid };
  }

  const lightBlue = "#7dd3fc";
  const selectedBlue = "#0ea5e9";
  const baseStroke = "#111827";

  const { scale, panX, panY } = view;
  const humanMode = mode === "connect" ? "Connect" : mode === "add-node" && currentTemplate ? `Add ${currentTemplate.label}` : mode === "add-node" ? "Add node" : "Select/Move";

  return (
    <div className="w-full h-[100vh] bg-neutral-50 flex flex-col">
      <div className="flex-1 relative">
        <div className="absolute top-6 left-6 z-30">
          <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur">
            <ModeButton name="Select/Move" value="select" current={mode} onSelect={activateSelectMode} />
            <ModeButton name="Connect" value="connect" hotkey="C" current={mode} onSelect={activateConnectMode} />
          </div>
        </div>

        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
          <div className="flex items-center gap-2 rounded-3xl border border-neutral-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur">
            {paletteTemplates.map((template) => (
              <PaletteButton
                key={template.id}
                template={template}
                active={mode === "add-node" && pendingTemplateId === template.id}
                onSelect={activateTemplate}
              />
            ))}
          </div>
        </div>

        <svg
          ref={svgRef}
          className="w-full h-full"
          onWheel={onWheel}
          onPointerDown={onSVGPointerDown}
          onPointerEnter={onSVGPointerEnter}
          onPointerMove={onSVGPointerMove}
          onPointerUp={onSVGPointerUp}
          onPointerLeave={onSVGPointerLeave}
          onClick={onSVGClick}
          style={{
            touchAction: "none",
            userSelect: "none",
            cursor: spacePressed ? (dragRef.current.type === "pan" ? "grabbing" : "grab") : undefined,
          }}
        >
          <defs>
            <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#e5e7eb" strokeWidth="1" />
            </pattern>
          </defs>

          <g transform={`translate(${panX} ${panY}) scale(${scale})`}>
            <rect x={-BG_EXTENT} y={-BG_EXTENT} width={BG_EXTENT * 2} height={BG_EXTENT * 2} fill="url(#grid)" />

            {edges.map((edge) => {
              const g = edgeGeometry(edge);
              if (!g) return null;
              const isSelected = selection.type === "edge" && selection.id === edge.id;
              const isHovered = hover.type === "edge" && hover.id === edge.id;
              const stroke = isSelected ? selectedBlue : isHovered ? lightBlue : baseStroke;
              return (
                <g key={edge.id}>
                  <path
                    d={g.d}
                    stroke="transparent"
                    strokeWidth={16}
                    fill="none"
                    style={{ pointerEvents: "stroke", cursor: !isSelected ? (isHovered ? "pointer" : "default") : "default" }}
                    onClick={(e) => onEdgeClick(e, edge.id)}
                    onPointerEnter={(e) => onEdgeEnter(e, edge.id)}
                    onPointerLeave={onEdgeLeave}
                  />
                  <path d={g.d} stroke={stroke} strokeWidth={2} fill="none" />
                  {isSelected && (
                    <g style={{ cursor: "grab" }} onPointerDown={(e) => onEdgeHandlePointerDown(e, edge.id, 0.5)}>
                      <circle cx={g.mid.x} cy={g.mid.y} r={6} fill="#fff" stroke="#0369a1" strokeWidth={2} />
                    </g>
                  )}
                </g>
              );
            })}

            {connectPreviewPath ? (
              <path
                d={connectPreviewPath.d}
                stroke={selectedBlue}
                strokeWidth={2}
                fill="none"
                strokeDasharray="6 6"
                style={{ pointerEvents: "none" }}
              />
            ) : null}

            {nodePreview && mode === "add-node" && currentTemplate ? (
              <g style={{ pointerEvents: "none" }}>
                <rect
                  x={nodePreview.x}
                  y={nodePreview.y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={16}
                  ry={16}
                  fill="#fff"
                  fillOpacity={0.6}
                  stroke={selectedBlue}
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                />
                <text
                  x={nodePreview.x + NODE_WIDTH / 2}
                  y={nodePreview.y + NODE_HEIGHT / 2 + 4}
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                  fontSize={13}
                  fill="#0369a1"
                  fillOpacity={0.6}
                >
                  {currentTemplate.label}
                </text>
              </g>
            ) : null}

            {nodes.map((n) => {
              const isSelected = selection.type === "node" && selection.id === n.id;
              const isHovered = hover.type === "node" && hover.id === n.id;
              const stroke = isSelected ? selectedBlue : isHovered ? lightBlue : baseStroke;
              const desiredCursor = mode === "connect" ? "crosshair" : !isSelected && isHovered ? "pointer" : "grab";
              return (
                <g
                  key={n.id}
                  onPointerDown={(e) => onNodePointerDown(e, n.id)}
                  onClick={(e) => onNodeClick(e, n.id)}
                  onPointerEnter={() => onNodeEnter(n.id)}
                  onPointerLeave={onNodeLeave}
                  style={{ cursor: spacePressed ? (dragRef.current.type === "pan" ? "grabbing" : "grab") : desiredCursor }}
                >
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.width}
                    height={n.height}
                    rx={16}
                    ry={16}
                    fill="#fff"
                    stroke={stroke}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  <text
                    x={n.x + n.width / 2}
                    y={n.y + n.height / 2 + 4}
                    textAnchor="middle"
                    fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                    fontSize={13}
                    fill="#111827"
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="absolute bottom-2 left-2 text-[11px] bg-white/80 backdrop-blur px-2 py-1 rounded-md border text-neutral-600">
          Mode: <span className="font-semibold">{humanMode}</span>
          {mode === "connect" && connectSourceId ? <span className="ml-2">(pick a target)</span> : null}
        </div>
        <div className="absolute bottom-2 right-2 text-[11px] bg-white/80 backdrop-blur px-2 py-1 rounded-md border text-neutral-800">
          {Math.round(scale * 100)}%
        </div>
      </div>
    </div>
  );
}
