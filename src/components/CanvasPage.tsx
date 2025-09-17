import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type {ReactElement} from 'react';

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
const START_NODE_ID = "agent-start-node";
const FINISH_NODE_ID = "agent-finish-node";

type Point = { x: number; y: number };
type PortType = "String" | "ToolCall" | "ToolResult";

type NodeData = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  inputType: PortType | null;
  outputTypes: Array<PortType>;
};
type EdgeData = { id: string; sourceId: string; sourcePort: number; targetId: string; cx: number; cy: number };
type ViewState = { scale: number; panX: number; panY: number };
type Mode = "select" | "add-node" | "connect";
type Selection = { type: "node"; id: string } | { type: "edge"; id: string } | { type: null; id: null };
type HoverState = { type: "node"; id: string } | { type: "edge"; id: string } | { type: null; id: null };
type DragState =
  | { type: "node"; id: string; dx: number; dy: number; t: number }
  | { type: "ctrl"; id: string; dx: number; dy: number; t: number }
  | { type: "pan"; id: null; dx: number; dy: number; t: number }
  | { type: null; id: null; dx: number; dy: number; t: number };

type PanDelta = { dx: number; dy: number };
type NodeConnection = { source: NodeData; target: NodeData };

type PaletteTemplate = {
  id: string;
  label: string;
  icon: (props: IconProps) => ReactElement;
  inputType: PortType | null;
  outputTypes: Array<PortType>;
};

type IconProps = {
  className?: string;
};

type EdgeGeometry = {
  d: string;
  p0: Point;
  p2: Point;
  c: Point;
  tMid: number;
  mid: Point;
  arrowPath: string;
};

type EdgeWithGeometry = {
  edge: EdgeData;
  geometry: EdgeGeometry;
  gradientId: string;
};

type PathData = { d: string };
type ConnectorHighlight = {
  input: boolean;
  outputs: Set<number>;
};

type ConnectSourceState = {
  nodeId: string;
  port: number;
};

type GraphNodeSnapshot = {
  id: string;
  label: string;
  position: Point;
  size: { width: number; height: number };
  inputType: PortType | null;
  outputTypes: Array<PortType>;
};

type GraphEdgeSnapshot = {
  id: string;
  sourceId: string;
  sourcePort: number;
  targetId: string;
  control: Point;
  outputType: PortType | null;
};

type GraphSnapshot = {
  nodes: Array<GraphNodeSnapshot>;
  edges: Array<GraphEdgeSnapshot>;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const snap = (v: number, step = GRID) => Math.round(v / step) * step;

function nodeCenter(n: NodeData) {
  return { cx: n.x + n.width / 2, cy: n.y + n.height / 2 };
}

function outputAnchors(node: NodeData): Array<Point> {
  const count = Math.max(0, node.outputTypes.length);
  if (count === 0) return [];
  const anchors: Array<Point> = [];
  const x = node.x + node.width;
  if (count === 1) {
    anchors.push({ x, y: node.y + node.height / 2 });
    return anchors;
  }
  const margin = Math.min(node.height / 4, 22);
  const usable = Math.max(node.height - margin * 2, 0);
  const step = count > 1 ? usable / (count - 1 || 1) : 0;
  for (let i = 0; i < count; i += 1) {
    anchors.push({ x, y: node.y + margin + step * i });
  }
  return anchors;
}

function fixedOutputAnchor(node: NodeData, portIndex = 0): Point {
  const all = outputAnchors(node);
  if (!all.length) {
    const { cx, cy } = nodeCenter(node);
    return { x: cx + node.width / 2, y: cy };
  }
  const idx = clamp(portIndex, 0, all.length - 1);
  return all[idx];
}

function closestOutputPort(node: NodeData, point: Point | null): number {
  const anchors = outputAnchors(node);
  if (!anchors.length || !point) {
    return 0;
  }
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < anchors.length; i += 1) {
    const anchor = anchors[i];
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function closestOutputPortOfType(node: NodeData, portType: PortType | null, point: Point | null): number {
  const anchors = outputAnchors(node);
  if (!anchors.length) return -1;
  if (!portType) {
    return closestOutputPort(node, point);
  }
  let bestIndex = -1;
  let bestDist = Infinity;
  if (point) {
    for (let i = 0; i < anchors.length; i += 1) {
      if (node.outputTypes[i] !== portType) continue;
      const anchor = anchors[i];
      const dx = point.x - anchor.x;
      const dy = point.y - anchor.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
  }
  if (bestIndex === -1) {
    bestIndex = node.outputTypes.findIndex((type) => type === portType);
  }
  return bestIndex;
}

function fixedInputAnchor(node: NodeData): Point {
  const { cx, cy } = nodeCenter(node);
  return { x: cx - node.width / 2, y: cy };
}

function normal2D(x: number, y: number): [number, number] {
  return [-y, x];
}

function vecNormalize(x: number, y: number): [number, number] {
  const L = Math.hypot(x, y) || 1;
  return [x / L, y / L];
}

function defaultControlPoint(p0: Point, p2: Point, bump = 80): Point {
  const mx = (p0.x + p2.x) / 2;
  const my = (p0.y + p2.y) / 2;
  const [nx, ny] = vecNormalize(...normal2D(p2.x - p0.x, p2.y - p0.y));
  return { x: mx + nx * bump, y: my + ny * bump };
}

function svgPoint(svgEl: SVGSVGElement, clientX: number, clientY: number): Point {
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const mat = svgEl.getScreenCTM()?.inverse();
  if (!mat) {
    return { x: clientX, y: clientY };
  }
  const { x, y } = pt.matrixTransform(mat);
  return { x, y };
}

function qPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}

function controlFromT(p0: Point, p2: Point, t: number, M: Point): Point {
  const u = 1 - t;
  const denom = 2 * u * t;
  if (denom < 1e-6) {
    return { x: 2 * M.x - 0.5 * p0.x - 0.5 * p2.x, y: 2 * M.y - 0.5 * p0.y - 0.5 * p2.y };
  }
  return {
    x: (M.x - u * u * p0.x - t * t * p2.x) / denom,
    y: (M.y - u * u * p0.y - t * t * p2.y) / denom,
  };
}

// ----------------------------------------
// Icons & palette
// ----------------------------------------
const CallLLMIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 5h11a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-3.2L10 18.5V14H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" />
    <path d="M15 8h.01M12 8h.01M9 8h.01" />
  </svg>
);

const ToolCallIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 14.5a3.5 3.5 0 0 1-5-3.2L9.8 5.9a3.5 3.5 0 0 1-4.7 4.7l1.8 1.8L5 14.3l4.7 4.7 1.8-1.9 1.8 1.8a3.5 3.5 0 0 1 4.7-4.7z" />
  </svg>
);

const TaskIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5h10M9 9h10M9 13h10M5 5h.01M5 9h.01M5 13h.01" />
  </svg>
);

const VerificationIcon = ({ className = "w-4 h-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 5 6v6c0 4 2.6 7.4 7 9 4.4-1.6 7-5 7-9V6l-7-3z" />
    <path d="m9.5 12 1.8 1.8 3.2-3.3" />
  </svg>
);

const paletteTemplates: Array<PaletteTemplate> = [
  { id: "ask-llm", label: "Ask LLM", icon: CallLLMIcon, inputType: "String", outputTypes: ["String", "ToolCall"] },
  { id: "tool-call", label: "Tool call", icon: ToolCallIcon, inputType: "ToolCall", outputTypes: ["ToolResult"] },
  { id: "task", label: "Task", icon: TaskIcon, inputType: "String", outputTypes: ["String"] },
  { id: "llm-judge", label: "LLM Judge", icon: VerificationIcon, inputType: "String", outputTypes: ["String", "String"] },
];

type PaletteButtonProps = {
  template: PaletteTemplate;
  active: boolean;
  onSelect: (templateId: string) => void;
};

const PaletteButton = ({ template, active, onSelect }: PaletteButtonProps) => {
  const Icon = template.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition shadow-sm ${
        active
          ? "bg-sky-900/30 border-sky-500 text-sky-200"
          : "bg-neutral-800 border-neutral-700 hover:border-neutral-500 text-neutral-200"
      }`}
    >
      <Icon className={active ? "w-4 h-4 text-sky-300" : "w-4 h-4 text-neutral-400"} />
      <span>{template.label}</span>
    </button>
  );
};

type ModeButtonProps = {
  name: string;
  value: Mode;
  hotkey?: string;
  current: Mode;
  onSelect: (mode: Mode) => void;
};

const ModeButton = ({ name, value, hotkey, current, onSelect }: ModeButtonProps) => (
  <button
    type="button"
    onClick={() => onSelect(value)}
    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
      current === value
        ? "bg-sky-600/80 text-white border-sky-500"
        : "bg-neutral-800 text-neutral-200 border-neutral-700 hover:border-neutral-500"
    }`}
    title={hotkey ? `${name} (${hotkey})` : name}
  >
    {name}
    {hotkey ? ` (${hotkey})` : ""}
  </button>
);

export default function CanvasPage() {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // View (pan/zoom)
  const [view, setView] = useState<ViewState>({ scale: 1, panX: 0, panY: 0 });
  const viewRef = useRef<ViewState>(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const [mode, setMode] = useState<Mode>("select");
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Array<NodeData>>([
    {
      id: START_NODE_ID,
      x: 140,
      y: 240,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      label: "Start",
      inputType: null,
      outputTypes: ["String"],
    },
    {
      id: FINISH_NODE_ID,
      x: 480,
      y: 240,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      label: "Finish",
      inputType: "String",
      outputTypes: [],
    },
  ]);
  const [edges, setEdges] = useState<Array<EdgeData>>([]);

  // Selection & hover
  const [selection, setSelection] = useState<Selection>({ type: null, id: null });
  const [hover, setHover] = useState<HoverState>({ type: null, id: null });
  const [connectSource, setConnectSource] = useState<ConnectSourceState | null>(null);
  const [connectPreview, setConnectPreview] = useState<Point | null>(null);
  const [nodePreview, setNodePreview] = useState<Point | null>(null);
  const [isPointerInsideCanvas, setIsPointerInsideCanvas] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");

  // Drag state: 'node' | 'ctrl' | 'pan'
  const dragRef = useRef<DragState>({ type: null, id: null, dx: 0, dy: 0, t: 0.5 });
  const [spacePressed, setSpacePressed] = useState(false);

  // rAF batching for panning
  const panDeltaRef = useRef<PanDelta>({ dx: 0, dy: 0 });
  const panRafRef = useRef<number>(0);
  const lastPointerWorldRef = useRef<Point | null>(null);
  const [pointerWorld, setPointerWorld] = useState<Point | null>(null);
  const editingInputRef = useRef<HTMLInputElement | null>(null);

  const commitLabelEdit = useCallback(
    (commit = true) => {
      setEditingLabelId((currentId) => {
        if (!currentId) return null;
        if (commit) {
          const value = editingLabelValue.trim();
          const nextLabel = value.length ? value : "Untitled";
          setNodes((prev) => prev.map((n) => (n.id === currentId ? { ...n, label: nextLabel } : n)));
        }
        setEditingLabelValue("");
        return null;
      });
    },
    [editingLabelValue, setNodes]
  );

  const currentTemplate = useMemo<PaletteTemplate | null>(() => {
    if (!pendingTemplateId) {
      return null;
    }
    return paletteTemplates.find((tpl) => tpl.id === pendingTemplateId) ?? null;
  }, [pendingTemplateId]);

  const clampPanToWorld = useCallback((panX: number, panY: number, scale: number): { panX: number; panY: number } => {
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
  }, []);

  const schedulePanFrame = useCallback(() => {
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
  }, [clampPanToWorld]);

  const activateSelectMode = useCallback(() => {
    setMode("select");
    setPendingTemplateId(null);
    setConnectSource(null);
    setConnectPreview(null);
    setNodePreview(null);
  }, []);
  const activateConnectMode = useCallback(() => {
    if (mode === "connect") {
      activateSelectMode();
      return;
    }
    setMode("connect");
    setPendingTemplateId(null);
    setConnectSource(null);
    setConnectPreview(null);
    setNodePreview(null);
  }, [mode, activateSelectMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const editingActive = Boolean(editingLabelId) && editingInputRef.current === document.activeElement;
      if (editingActive && e.key !== "Escape") {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        setSpacePressed(true);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection.type === "node") {
          const { id } = selection;
          setNodes((prev) => prev.filter((n) => n.id !== id));
          setEdges((prev) => prev.filter((ed) => ed.sourceId !== id && ed.targetId !== id));
          setSelection({ type: null, id: null });
        } else if (selection.type === "edge") {
          const { id } = selection;
          setEdges((prev) => prev.filter((ed) => ed.id !== id));
          setSelection({ type: null, id: null });
        }
      }
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        setPendingTemplateId(null);
        activateConnectMode();
      }
      if (e.key === "Escape") {
        if ((mode === "add-node" && currentTemplate) || mode === "connect") {
          e.preventDefault();
          activateSelectMode();
        }
        if (editingLabelId) {
          e.preventDefault();
          commitLabelEdit(false);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
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
  }, [selection, mode, currentTemplate, editingLabelId, commitLabelEdit, activateConnectMode, activateSelectMode]);

  const nodeMap = useMemo(() => new Map<string, NodeData>(nodes.map((n) => [n.id, n])), [nodes]);
  const resolveConnection = useCallback(
    (firstId: string | null, secondId: string | null): NodeConnection | null => {
      if (!firstId || !secondId || firstId === secondId) return null;
      const first = nodeMap.get(firstId);
      const second = nodeMap.get(secondId);
      if (!first || !second) return null;

      const firstIsStart = first.id === START_NODE_ID;
      const secondIsStart = second.id === START_NODE_ID;
      if (firstIsStart && secondIsStart) return null;

      const firstIsFinish = first.id === FINISH_NODE_ID;
      const secondIsFinish = second.id === FINISH_NODE_ID;
      if (firstIsFinish && secondIsFinish) return null;

      let source = first;
      let target = second;

      if (firstIsStart || secondIsStart) {
        source = firstIsStart ? first : second;
        target = firstIsStart ? second : first;
      }

      if (firstIsFinish || secondIsFinish) {
        target = firstIsFinish ? first : second;
        source = firstIsFinish ? second : first;
      }

      if (source.id === target.id) {
        return null;
      }

      return { source, target };
    },
    [nodeMap]
  );

  const computeNodePreviewPosition = useCallback((point: Point): Point => {
    const halfWidth = NODE_WIDTH / 2;
    const halfHeight = NODE_HEIGHT / 2;
    const x = clamp(point.x - halfWidth, WORLD.minX, WORLD.maxX - NODE_WIDTH);
    const y = clamp(point.y - halfHeight, WORLD.minY, WORLD.maxY - NODE_HEIGHT);
    return { x, y };
  }, []);

  const startEditingLabel = useCallback(
    (nodeId: string) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      const label = (node.label || "").trim();
      const lower = label.toLowerCase();
      if (!label || lower === "start" || lower === "finish") {
        return;
      }
      setEditingLabelId(nodeId);
      setEditingLabelValue(label);
      setSelection({ type: "node", id: nodeId });
    },
    [nodeMap]
  );

  useEffect(() => {
    if (!connectSource) {
      setConnectPreview(null);
    }
  }, [connectSource]);

  useEffect(() => {
    if (mode !== "connect") {
      setConnectSource(null);
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

  useEffect(() => {
    if (editingLabelId && editingInputRef.current) {
      const handle = requestAnimationFrame(() => {
        editingInputRef.current?.focus();
        editingInputRef.current?.select();
      });
      return () => cancelAnimationFrame(handle);
    }
  }, [editingLabelId]);

  function getSvgPointInWorld(clientX: number, clientY: number): Point {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    return svgPoint(svg, clientX, clientY);
  }
  function getWorldPoint(clientX: number, clientY: number): Point {
    const p = getSvgPointInWorld(clientX, clientY);
    const v = viewRef.current;
    return { x: (p.x - v.panX) / v.scale, y: (p.y - v.panY) / v.scale };
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag.type === null) return;

      if (drag.type === "pan") {
        const mx = e.movementX;
        const my = e.movementY;
        panDeltaRef.current.dx += mx;
        panDeltaRef.current.dy += my;
        schedulePanFrame();
        e.preventDefault();
        return;
      }

      const pw = getWorldPoint(e.clientX, e.clientY);
      if (drag.type === "node") {
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id !== drag.id) return n;
            const x = clamp(snap(pw.x - drag.dx), WORLD.minX, WORLD.maxX - n.width);
            const y = clamp(snap(pw.y - drag.dy), WORLD.minY, WORLD.maxY - n.height);
            return { ...n, x, y };
          })
        );
      } else {
        setEdges((prev) =>
          prev.map((ed) => {
            if (ed.id !== drag.id) return ed;
            const s = nodeMap.get(ed.sourceId);
            const t = nodeMap.get(ed.targetId);
            if (!s || !t) return ed;
            const portIndex = clamp(ed.sourcePort, 0, Math.max(0, s.outputTypes.length - 1));
            const p0 = fixedOutputAnchor(s, portIndex);
            const p2 = fixedInputAnchor(t);
            const snapped: Point = {
              x: clamp(snap(pw.x), WORLD.minX, WORLD.maxX),
              y: clamp(snap(pw.y), WORLD.minY, WORLD.maxY),
            };
            const cp = controlFromT(p0, p2, drag.t, snapped);
            return { ...ed, cx: cp.x, cy: cp.y };
          })
        );
      }
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
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
  }, [nodeMap, schedulePanFrame]);

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
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

  const activateTemplate = (templateId: string) => {
    if (mode === "add-node" && pendingTemplateId === templateId) {
      activateSelectMode();
      return;
    }
    setConnectSource(null);
    setMode("add-node");
    setPendingTemplateId(templateId);
  };

  const onSVGPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
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
  const onSVGPointerEnter = (e: React.PointerEvent<SVGSVGElement>) => {
    setIsPointerInsideCanvas(true);
    const pw = getWorldPoint(e.clientX, e.clientY);
    lastPointerWorldRef.current = pw;
    setPointerWorld(pw);
    if (spacePressed) return;
    if (mode === "connect" && connectSource) {
      setConnectPreview(pw);
    } else if (mode === "add-node" && currentTemplate) {
      setNodePreview(computeNodePreviewPosition(pw));
    }
  };
  const onSVGPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const pw = getWorldPoint(e.clientX, e.clientY);
    lastPointerWorldRef.current = pw;

    if (spacePressed) {
      setPointerWorld(null);
      if (nodePreview) {
        setNodePreview(null);
      }
      return;
    }

    setPointerWorld(pw);

    if (mode === "connect" && connectSource) {
      setConnectPreview(pw);
    } else if (mode === "add-node" && currentTemplate) {
      setNodePreview(computeNodePreviewPosition(pw));
    }
  };
  const onSVGPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
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
    setPointerWorld(null);
  };

  const onSVGClick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (spacePressed) return;
    const pw = getWorldPoint(e.clientX, e.clientY);
    if (mode === "add-node" && currentTemplate) {
      const id = uid();
      const placement = nodePreview || computeNodePreviewPosition(pw);
      const outputTypes = [...currentTemplate.outputTypes];
      setNodes((prev) =>
        prev.concat({
          id,
          x: placement.x,
          y: placement.y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          label: currentTemplate.label,
          inputType: currentTemplate.inputType,
          outputTypes,
        })
      );
      setSelection({ type: "node", id });
      if (!nodePreview) {
        setNodePreview(placement);
      }
      setPendingTemplateId(null);
      return;
    }
    setSelection({ type: null, id: null });
    setHover({ type: null, id: null });
    setConnectSource(null);
  };

  const onNodePointerDown = (e: React.PointerEvent<SVGGElement>, id: string) => {
    if (spacePressed) return;
    e.stopPropagation();
    if (editingLabelId) {
      commitLabelEdit();
    }
    const pw = getWorldPoint(e.clientX, e.clientY);
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    dragRef.current = { type: "node", id, dx: pw.x - node.x, dy: pw.y - node.y, t: 0.5 };
    setSelection({ type: "node", id });
  };
  const onNodeClick = (e: React.MouseEvent<SVGGElement>, id: string) => {
    if (spacePressed) return;
    e.stopPropagation();

    const pointer = getWorldPoint(e.clientX, e.clientY);
    setPointerWorld(pointer);

    if (mode === "connect") {
      const node = nodeMap.get(id);
      if (!node) return;
      if (!connectSource && node.outputTypes.length === 0) {
        setSelection({ type: "node", id });
        return;
      }
      const port = closestOutputPort(node, pointer);

      if (!connectSource) {
        setConnectSource({ nodeId: id, port });
        setSelection({ type: "node", id });
        setConnectPreview(pointer);
        return;
      }

      if (connectSource.nodeId === id) {
        setConnectSource({ nodeId: id, port });
        setSelection({ type: "node", id });
        setConnectPreview(pointer);
        return;
      }

      const connection = resolveConnection(connectSource.nodeId, id);
      if (connection) {
        const { source, target } = connection;
        const existing = edges.find(
          (ed) => (ed.sourceId === source.id && ed.targetId === target.id) || (ed.sourceId === target.id && ed.targetId === source.id)
        );
        if (existing) {
          setSelection({ type: "edge", id: existing.id });
          activateSelectMode();
          return;
        }

        if (source.outputTypes.length === 0) {
          return;
        }

        let sourcePort: number;
        if (source.id === connectSource.nodeId) {
          sourcePort = clamp(connectSource.port, 0, Math.max(0, source.outputTypes.length - 1));
        } else if (source.id === id) {
          sourcePort = clamp(port, 0, Math.max(0, source.outputTypes.length - 1));
        } else {
          const initialPort = target.inputType
            ? closestOutputPortOfType(source, target.inputType, pointer)
            : closestOutputPort(source, pointer);
          if (initialPort === -1) {
            return;
          }
          sourcePort = clamp(initialPort, 0, Math.max(0, source.outputTypes.length - 1));
        }

        const targetInputType = target.inputType;
        if (targetInputType && source.outputTypes[sourcePort] !== targetInputType) {
          return;
        }

        if (sourcePort < 0 || sourcePort >= source.outputTypes.length) {
          return;
        }

        const a = fixedOutputAnchor(source, sourcePort);
        const b = fixedInputAnchor(target);
        const cp = defaultControlPoint(a, b, 60);
        const edgeId = uid();
        setEdges((prev) => prev.concat({ id: edgeId, sourceId: source.id, sourcePort, targetId: target.id, cx: cp.x, cy: cp.y }));
        setSelection({ type: "edge", id: edgeId });
        activateSelectMode();
        return;
      }

      setConnectSource(null);
      setConnectPreview(null);
      return;
    }

    setSelection({ type: "node", id });
  };

  const onEdgeClick = (e: React.MouseEvent<SVGPathElement>, id: string) => {
    if (spacePressed) return;
    e.stopPropagation();
    setSelection({ type: "edge", id });
  };
  const onEdgeEnter = (id: string) => {
    setHover({ type: "edge", id });
  };
  const onEdgeLeave = () => {
    setHover({ type: null, id: null });
  };
  const onNodeEnter = (id: string) => {
    setHover({ type: "node", id });
  };
  const onNodeLeave = () => {
    setHover({ type: null, id: null });
  };

  const onEdgeHandlePointerDown = (e: React.PointerEvent<SVGGElement>, edgeId: string, tFixed: number) => {
    if (spacePressed) return;
    e.stopPropagation();
    dragRef.current = { type: "ctrl", id: edgeId, dx: 0, dy: 0, t: tFixed };
    setSelection({ type: "edge", id: edgeId });
  };

  const nodeMapRender = useMemo(() => new Map<string, NodeData>(nodes.map((n) => [n.id, n])), [nodes]);
  const connectPreviewPath = useMemo<PathData | null>(() => {
    if (mode !== "connect" || !connectSource || !connectPreview) return null;
    let activeSourceId = connectSource.nodeId;
    let portIndex = connectSource.port;
    const hoveredNodeId = hover.type === "node" ? hover.id : null;
    if (hoveredNodeId && hoveredNodeId !== connectSource.nodeId) {
      const connection = resolveConnection(connectSource.nodeId, hoveredNodeId);
      if (connection) {
        activeSourceId = connection.source.id;
        const sourceNodeCandidate = nodeMapRender.get(connection.source.id);
        const targetNodeCandidate = nodeMapRender.get(connection.target.id);
        if (sourceNodeCandidate) {
          if (sourceNodeCandidate.outputTypes.length > 0) {
            if (connection.source.id === connectSource.nodeId) {
              portIndex = clamp(connectSource.port, 0, sourceNodeCandidate.outputTypes.length - 1);
            } else {
              const targetInputType = targetNodeCandidate?.inputType ?? null;
              if (targetInputType) {
                const compatible = closestOutputPortOfType(sourceNodeCandidate, targetInputType, connectPreview);
                if (compatible !== -1) {
                  portIndex = compatible;
                } else {
                  portIndex = closestOutputPort(sourceNodeCandidate, connectPreview);
                }
              } else {
                portIndex = closestOutputPort(sourceNodeCandidate, connectPreview);
              }
            }
          }
        }
      }
    }
    const sourceNode = nodeMapRender.get(activeSourceId);
    if (!sourceNode || sourceNode.outputTypes.length === 0) return null;
    const clampedPort = clamp(portIndex, 0, sourceNode.outputTypes.length - 1);
    const start = fixedOutputAnchor(sourceNode, clampedPort);
    const cp = defaultControlPoint(start, connectPreview, 60);
    const d = `M ${start.x} ${start.y} Q ${cp.x} ${cp.y} ${connectPreview.x} ${connectPreview.y}`;
    return { d };
  }, [mode, connectSource, connectPreview, nodeMapRender, hover, resolveConnection]);

  const graphSnapshot = useMemo<GraphSnapshot>(() => {
    const nodeSnapshots: Array<GraphNodeSnapshot> = nodes.map((node) => ({
      id: node.id,
      label: node.label,
      position: { x: node.x, y: node.y },
      size: { width: node.width, height: node.height },
      inputType: node.inputType,
      outputTypes: [...node.outputTypes],
    }));
    const nodeLookup = new Map(nodes.map((node) => [node.id, node] as const));
    const edgeSnapshots: Array<GraphEdgeSnapshot> = edges.map((edge) => {
      const sourceNode = nodeLookup.get(edge.sourceId);
      const outputType = sourceNode?.outputTypes[edge.sourcePort] ?? null;
      return {
        id: edge.id,
        sourceId: edge.sourceId,
        sourcePort: edge.sourcePort,
        targetId: edge.targetId,
        control: { x: edge.cx, y: edge.cy },
        outputType,
      };
    });
    return { nodes: nodeSnapshots, edges: edgeSnapshots };
  }, [nodes, edges]);

  const graphSnapshotRef = useRef<GraphSnapshot>(graphSnapshot);
  useEffect(() => {
    graphSnapshotRef.current = graphSnapshot;
  }, [graphSnapshot]);

  const connectorHighlights = useMemo(() => {
    const highlights = new Map<string, ConnectorHighlight>();
    if (mode !== "connect") {
      return highlights;
    }

    const ensure = (id: string) => {
      if (!highlights.has(id)) {
        highlights.set(id, { input: false, outputs: new Set<number>() });
      }
      return highlights.get(id)!;
    };
    const markInput = (id: string) => {
      ensure(id).input = true;
    };
    const markOutput = (id: string, portIndex = 0) => {
      ensure(id).outputs.add(portIndex);
    };
    const hoveredNodeId = hover.type === "node" ? hover.id : null;

    if (connectSource) {
      const selectedSourceNode = nodeMapRender.get(connectSource.nodeId);
      let connectionHighlighted = false;
      if (hoveredNodeId && hoveredNodeId !== connectSource.nodeId) {
        const connection = resolveConnection(connectSource.nodeId, hoveredNodeId);
        if (connection) {
          const { source, target } = connection;
          const sourceNode = nodeMapRender.get(source.id);
          const targetNode = nodeMapRender.get(target.id);
          if (sourceNode && targetNode) {
            const targetInputType = targetNode.inputType;
            let highlightPort = -1;
            if (sourceNode.outputTypes.length > 0) {
              if (source.id === connectSource.nodeId) {
                const desired = clamp(connectSource.port, 0, sourceNode.outputTypes.length - 1);
                if (!targetInputType || sourceNode.outputTypes[desired] === targetInputType) {
                  highlightPort = desired;
                }
              } else {
                const preferred = closestOutputPort(sourceNode, pointerWorld);
                if (!targetInputType || sourceNode.outputTypes[preferred] === targetInputType) {
                  highlightPort = preferred;
                } else {
                  highlightPort = closestOutputPortOfType(sourceNode, targetInputType, pointerWorld);
                }
              }
            }

            if (highlightPort !== -1 && highlightPort < sourceNode.outputTypes.length) {
              markOutput(source.id, highlightPort);
              if (!targetInputType || sourceNode.outputTypes[highlightPort] === targetInputType) {
                markInput(targetNode.id);
                connectionHighlighted = true;
              }
            }
          }
        }
      }
      if (!connectionHighlighted && selectedSourceNode) {
        if (selectedSourceNode.outputTypes.length > 0) {
          const clamped = clamp(connectSource.port, 0, selectedSourceNode.outputTypes.length - 1);
          markOutput(selectedSourceNode.id, clamped);
        } else {
          markInput(selectedSourceNode.id);
        }
      }
      return highlights;
    }

    if (hoveredNodeId != null) {
      const hoveredNode = nodeMapRender.get(hoveredNodeId);
      if (hoveredNode) {
        if (hoveredNode.outputTypes.length > 0) {
          const portIndex = closestOutputPort(hoveredNode, pointerWorld);
          markOutput(hoveredNode.id, portIndex);
        } else {
          markInput(hoveredNode.id);
        }
      }
    }

    return highlights;
  }, [mode, connectSource, hover, nodeMapRender, pointerWorld, resolveConnection]);
  function edgeGeometry(edge: EdgeData): EdgeGeometry | null {
    const s = nodeMapRender.get(edge.sourceId);
    const t = nodeMapRender.get(edge.targetId);
    if (!s || !t) return null;
    const maxPort = Math.max(0, s.outputTypes.length - 1);
    const portIndex = clamp(edge.sourcePort, 0, maxPort);
    const p0 = fixedOutputAnchor(s, portIndex);
    const p2 = fixedInputAnchor(t);
    const c: Point = { x: edge.cx, y: edge.cy };
    const d = `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`;
    const tMid = 0.5;
    const mid = qPoint(p0, c, p2, tMid);
    const [dirX, dirY] = vecNormalize(p2.x - c.x, p2.y - c.y);
    const arrowLength = 10;
    const arrowWidth = 7;
    const baseX = p2.x - dirX * arrowLength;
    const baseY = p2.y - dirY * arrowLength;
    const [perpX, perpY] = vecNormalize(...normal2D(dirX, dirY));
    const halfWidth = arrowWidth / 2;
    const leftX = baseX + perpX * halfWidth;
    const leftY = baseY + perpY * halfWidth;
    const rightX = baseX - perpX * halfWidth;
    const rightY = baseY - perpY * halfWidth;
    const arrowPath = `M ${p2.x} ${p2.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`;
    return { d, p0, p2, c, tMid, mid, arrowPath };
  }

  const edgesWithGeometry = useMemo(() => {
    const acc: Array<EdgeWithGeometry> = [];
    edges.forEach((edge) => {
      const geometry = edgeGeometry(edge);
      if (!geometry) return;
      acc.push({ edge, geometry, gradientId: `edge-gradient-${edge.id}` });
    });
    return acc;
  }, [edges, nodeMapRender]);

  const lightBlue = "#38bdf8";
  const selectedBlue = "#0ea5e9";
  const baseStroke = "#94a3b8";
  const outputColor = "#FF3B70";
  const inputColor = "#B191FF";
  const nodeFill = "#1e293b";
  const nodeText = "#e2e8f0";

  const { scale, panX, panY } = view;
  const humanMode = mode === "connect" ? "Connect" : mode === "add-node" && currentTemplate ? `Add ${currentTemplate.label}` : mode === "add-node" ? "Add node" : "Select/Move";

  return (
    <div className="w-full h-[100vh] bg-neutral-950 flex flex-col text-neutral-100">
      <div className="flex-1 relative">
        <div className="absolute top-6 left-6 z-30">
          <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/90 px-3 py-2 shadow-lg backdrop-blur">
            <ModeButton name="Connect" value="connect" hotkey="C" current={mode} onSelect={activateConnectMode} />
          </div>
        </div>

        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
          <div className="flex items-center gap-2 rounded-3xl border border-neutral-800 bg-neutral-900/95 px-4 py-2 shadow-xl backdrop-blur">
            {paletteTemplates.map((template) => (
              <PaletteButton
                key={template.id}
                template={template}
                active={mode === "add-node" && pendingTemplateId === template.id}
                onSelect={activateTemplate}
              />
            ))}
          </div>
          {mode !== "select" ? (
            <div className="mt-2 text-[12px] text-neutral-400 text-center">Press Esc to stop action.</div>
          ) : null}
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
              <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#1f2937" strokeWidth="1" />
            </pattern>
            {edgesWithGeometry.map(({ gradientId, geometry }) => (
              <linearGradient
                key={gradientId}
                id={gradientId}
                x1={geometry.p0.x}
                y1={geometry.p0.y}
                x2={geometry.p2.x}
                y2={geometry.p2.y}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={outputColor} />
                <stop offset="100%" stopColor={inputColor} />
              </linearGradient>
            ))}
          </defs>

          <g transform={`translate(${panX} ${panY}) scale(${scale})`}>
            <rect x={-BG_EXTENT} y={-BG_EXTENT} width={BG_EXTENT * 2} height={BG_EXTENT * 2} fill="url(#grid)" />

            {edgesWithGeometry.map(({ edge, geometry: g, gradientId }) => {
              const isSelected = selection.type === "edge" && selection.id === edge.id;
              const isHovered = hover.type === "edge" && hover.id === edge.id;
              const gradientStroke = `url(#${gradientId})`;
              const highlightStroke = isSelected ? selectedBlue : lightBlue;
              const highlightOpacity = isSelected ? 0.55 : 0.35;
              const labelWidth = 44;
              const labelHeight = 16;
              const labelOffset = 20;
              return (
                <g key={edge.id}>
                  <path
                    d={g.d}
                    stroke="transparent"
                    strokeWidth={24}
                    fill="none"
                    style={{ pointerEvents: "stroke", cursor: !isSelected ? (isHovered ? "pointer" : "default") : "default" }}
                    onClick={(e) => onEdgeClick(e, edge.id)}
                    onPointerEnter={() => onEdgeEnter(edge.id)}
                    onPointerLeave={onEdgeLeave}
                  />
                  <path
                    d={g.d}
                    stroke={gradientStroke}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    style={{ pointerEvents: "none" }}
                  />
                  {(isHovered || isSelected) && (
                    <path
                      d={g.d}
                      stroke={highlightStroke}
                      strokeWidth={4}
                      fill="none"
                      strokeOpacity={highlightOpacity}
                      strokeLinecap="round"
                      style={{ pointerEvents: "none" }}
                    />
                  )}
                  <path
                    d={g.arrowPath}
                    fill={gradientStroke}
                    stroke={nodeFill}
                    strokeWidth={0.8}
                    style={{ pointerEvents: "none" }}
                  />
                  {(isHovered || isSelected) && (
                    <path
                      d={g.arrowPath}
                      fill={highlightStroke}
                      fillOpacity={highlightOpacity}
                      stroke="none"
                      style={{ pointerEvents: "none" }}
                    />
                  )}
                  <circle
                    cx={g.p0.x}
                    cy={g.p0.y}
                    r={4.5}
                    fill={outputColor}
                    stroke={nodeFill}
                    strokeWidth={1.5}
                    style={{ pointerEvents: "none" }}
                  />
                  <circle
                    cx={g.p2.x}
                    cy={g.p2.y}
                    r={4.5}
                    fill={inputColor}
                    stroke={nodeFill}
                    strokeWidth={1.5}
                    style={{ pointerEvents: "none" }}
                  />
                  {isSelected && (
                    <g style={{ cursor: "grab" }} onPointerDown={(e) => onEdgeHandlePointerDown(e, edge.id, 0.5)}>
                      <circle cx={g.mid.x} cy={g.mid.y} r={10} fill={nodeFill} stroke={gradientStroke} strokeWidth={2} />
                      <g transform={`translate(${g.mid.x} ${g.mid.y - labelOffset})`}>
                        <rect
                          x={-labelWidth / 2}
                          y={-labelHeight / 2}
                          width={labelWidth}
                          height={labelHeight}
                          rx={labelHeight / 2}
                          fill={nodeFill}
                          fillOpacity={0.92}
                          stroke={gradientStroke}
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={0}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                          fontSize={9}
                          fontWeight={600}
                          fill={gradientStroke}
                        >
                          Adjust
                        </text>
                      </g>
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
                  fill={nodeFill}
                  fillOpacity={0.4}
                  stroke={selectedBlue}
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />
                <text
                  x={nodePreview.x + NODE_WIDTH / 2}
                  y={nodePreview.y + NODE_HEIGHT / 2 + 4}
                  textAnchor="middle"
                  fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                  fontSize={13}
                  fill="#bae6fd"
                  fillOpacity={0.7}
                >
                  {currentTemplate.label}
                </text>
              </g>
            ) : null}

            {nodes.map((n) => {
              const isSelected = selection.type === "node" && selection.id === n.id;
              const isHovered = hover.type === "node" && hover.id === n.id;
              const stroke = isSelected ? selectedBlue : isHovered ? lightBlue : baseStroke;
              const labelId = n.id.trim();
              const labelLower = labelId.toLowerCase();
              const isPredefinedNode = labelLower === START_NODE_ID || labelLower === FINISH_NODE_ID;
              const canEditLabel = Boolean(labelId) && !isPredefinedNode;
              const isEditingLabel = canEditLabel && editingLabelId === n.id;
              const displayLabel = n.label;
              const desiredCursor = mode === "connect" ? "crosshair" : !isSelected && isHovered ? "pointer" : "grab";
              const inputAnchor = fixedInputAnchor(n);
              const connectorHighlight = connectorHighlights.get(n.id);
              const highlightInput = Boolean(connectorHighlight?.input);
              const highlightedOutputs = connectorHighlight?.outputs;
              const outputPoints = outputAnchors(n);
              return (
                <g
                  key={n.id}
                  onPointerDown={(e) => onNodePointerDown(e, n.id)}
                  onClick={(e) => onNodeClick(e, n.id)}
                  onPointerEnter={() => onNodeEnter(n.id)}
                  onPointerLeave={onNodeLeave}
                  style={{ cursor: spacePressed ? (dragRef.current.type === "pan" ? "grabbing" : "grab") : desiredCursor }}
                >
                  {canEditLabel ? (
                    isEditingLabel ? (
                      <foreignObject x={n.x} y={n.y - 28} width={n.width} height={24} style={{ overflow: "visible" }}>
                        <input
                          ref={editingInputRef}
                          value={editingLabelValue}
                          onChange={(e) => setEditingLabelValue(e.target.value.replace(/\n/g, ""))}
                          onBlur={() => commitLabelEdit()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitLabelEdit();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              commitLabelEdit(false);
                            }
                          }}
                          className="w-full text-center text-[11px] font-medium rounded-full bg-neutral-800 text-neutral-200 border border-neutral-700 px-2 py-1 outline-none focus:ring-1 focus:ring-sky-500"
                          style={{ lineHeight: "1.2", height: "20px" }}
                        />
                      </foreignObject>
                    ) : (
                      <text
                        x={n.x + n.width / 2}
                        y={n.y - 8}
                        textAnchor="middle"
                        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                        fontSize={15}
                        fill="#94a3b8"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startEditingLabel(n.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{
                          userSelect: mode === "select" ? "none" : "auto",
                          cursor: mode === "select" ? "text" : "default",
                        }}
                      >
                        {displayLabel}
                      </text>
                    )
                  ) : null}
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.width}
                    height={n.height}
                    rx={16}
                    ry={16}
                    fill={nodeFill}
                    stroke={stroke}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  {isPredefinedNode ? (
                    <text
                      x={n.x + n.width / 2}
                      y={n.y + n.height / 2 + 4}
                      textAnchor="middle"
                      fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                      fontSize={18}
                      fill={nodeText}
                    >
                      {displayLabel}
                    </text>
                  ) : null}
                  <g style={{ pointerEvents: "none" }}>
                    {n.id !== START_NODE_ID && (
                      <>
                        <circle
                          cx={inputAnchor.x}
                          cy={inputAnchor.y}
                          r={5.5}
                          fill={inputColor}
                          stroke={highlightInput ? selectedBlue : nodeFill}
                          strokeWidth={highlightInput ? 2.2 : 1.5}
                        />
                        {highlightInput ? (
                          <circle
                            cx={inputAnchor.x}
                            cy={inputAnchor.y}
                            r={8}
                            fill="none"
                            stroke={selectedBlue}
                            strokeWidth={1.2}
                            strokeOpacity={0.6}
                          />
                        ) : null}
                        {n.inputType ? (
                          <g transform={`translate(${inputAnchor.x - 58} ${inputAnchor.y - 22})`}>
                            <rect
                              x={0}
                              y={0}
                              width={56}
                              height={18}
                              rx={6}
                              ry={6}
                              fill="#0f172a"
                              fillOpacity={0.85}
                              stroke={highlightInput ? selectedBlue : nodeFill}
                              strokeWidth={0.8}
                            />
                            <text
                              x={28}
                              y={12}
                              textAnchor="middle"
                              fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                              fontSize={9}
                              fill={highlightInput ? selectedBlue : "#cbd5f5"}
                              fillOpacity={highlightInput ? 0.95 : 0.75}
                            >
                              {n.inputType}
                            </text>
                          </g>
                        ) : null}
                      </>
                    )}
                    {outputPoints.map((anchor, index) => {
                      const isHighlighted = Boolean(highlightedOutputs?.has(index));
                      const typeLabel = n.outputTypes[index];
                      return (
                        <g key={`output-${index}`}>
                          <circle
                            cx={anchor.x}
                            cy={anchor.y}
                            r={5.5}
                            fill={outputColor}
                            stroke={isHighlighted ? selectedBlue : nodeFill}
                            strokeWidth={isHighlighted ? 2.2 : 1.5}
                          />
                          {isHighlighted ? (
                            <circle
                              cx={anchor.x}
                              cy={anchor.y}
                              r={8}
                              fill="none"
                              stroke={selectedBlue}
                              strokeWidth={1.2}
                              strokeOpacity={0.6}
                            />
                          ) : null}
                          <g transform={`translate(${anchor.x + 8} ${anchor.y - 16})`}>
                            <rect
                              x={0}
                              y={0}
                              width={56}
                              height={16}
                              rx={6}
                              ry={6}
                              fill="#0f172a"
                              fillOpacity={0.85}
                              stroke={isHighlighted ? selectedBlue : nodeFill}
                              strokeWidth={0.8}
                            />
                            <text
                              x={28}
                              y={11}
                              textAnchor="middle"
                              fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI"
                              fontSize={9}
                              fill={isHighlighted ? selectedBlue : "#cbd5f5"}
                              fillOpacity={isHighlighted ? 0.95 : 0.75}
                            >
                              {typeLabel}
                            </text>
                          </g>
                        </g>
                      );
                    })}
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="absolute bottom-2 left-2 text-[11px] bg-neutral-900/80 backdrop-blur px-2 py-1 rounded-md border border-neutral-700 text-neutral-300">
          Mode: <span className="font-semibold">{humanMode}</span>
          {mode === "connect" && connectSource ? <span className="ml-2">(pick a target)</span> : null}
        </div>
        <div className="absolute bottom-2 right-2 text-[11px] bg-neutral-900/80 backdrop-blur px-2 py-1 rounded-md border border-neutral-700 text-neutral-200">
          {Math.round(scale * 100)}%
        </div>
      </div>
    </div>
  );
}
