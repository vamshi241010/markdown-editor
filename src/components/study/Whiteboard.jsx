import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Pen, 
  Highlighter, 
  Eraser, 
  Square, 
  Circle, 
  Type, 
  Undo, 
  Redo, 
  Trash2, 
  Grid, 
  Download, 
  ArrowUpRight, 
  Palette, 
  Check, 
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Slash
} from "lucide-react";

const COLORS = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Emerald", value: "#10b981" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Slate", value: "#1e293b" },
  { name: "White/Light", value: "#f8fafc" },
];

export default function Whiteboard({ roomId, socketService, role, initialState, onStateChange, onViewChange, panOffset:externalPanOffset, zoom:externalZoom }) {
  const isReadOnly = role === "listener";
  
  // Whiteboard configuration states
  const [tool, setTool] = useState("pen"); // pen, highlighter, line, arrow, rect, circle, text, eraser, hand
  const [color, setColor] = useState("#6366f1");
  const [width, setWidth] = useState(4);
  const [filled, setFilled] = useState(false);
  const [gridType, setGridType] = useState("dots"); // dots, lines, solid
  const [theme, setTheme] = useState("light"); // light (paper) or dark (chalkboard)

  // Canvas infinite viewport coordinates
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);

   const lastBroadcastTimeRef = useRef(0);

  // Broadcast helper for pan and zoom view updates
  const broadcastView = (pan, z, force = false) => {
    if (isReadOnly || !onViewChange) return;
    const now = Date.now();
    if (force || now - lastBroadcastTimeRef.current > 40) { // broadcast at most once every 40ms (~25fps)
      onViewChange(pan, z);
      lastBroadcastTimeRef.current = now;
    }
  };

  // Sync view coordinates (pan and zoom) when they change externally
  useEffect(() => {
    if (externalPanOffset) {
      setPanOffset(externalPanOffset);
    }
  }, [externalPanOffset]);

  useEffect(() => {
    if (externalZoom !== undefined) {
      setZoom(externalZoom);
    }
  }, [externalZoom]);

  // Canvas shapes state
  const [shapes, setShapes] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Active drawing & panning states
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [activePoints, setActivePoints] = useState([]);
  const [textInput, setTextInput] = useState(null); // { x, y, vx, vy } for inline text editor

  // Pinch-to-zoom multi-touch tracking
  const lastTouchDistanceRef = useRef(null);

  // Refs for rendering and panning
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const textInputRef = useRef(null);

  // Helper: Calculate point-to-line distance
  const getDistanceToSegment = (x, y, x1, y1, x2, y2) => {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Safe serialization/deserialization for real-time payloads
  const serializeState = (shapesList) => {
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(shapesList))));
    } catch (e) {
      console.error("Serialization error:", e);
      return "";
    }
  };

  const deserializeState = (encodedStr) => {
    try {
      return JSON.parse(decodeURIComponent(escape(atob(encodedStr))));
    } catch (e) {
      console.error("Deserialization error:", e);
      return [];
    }
  };

  // Sync state from Parent/Server when it changes from external users
  useEffect(() => {
    if (initialState) {
      const parsedShapes = deserializeState(initialState);
      if (JSON.stringify(parsedShapes) !== JSON.stringify(shapes)) {
        setShapes(parsedShapes);
      }
    } else {
      setShapes([]);
    }
  }, [initialState]);

  // Broadcast helper
  const broadcastShapes = (newShapes) => {
    if (isReadOnly) return;
    const base64 = serializeState(newShapes);
    onStateChange(base64);
    socketService.send("whiteboard-sync", {
      docState: base64
    });
  };

  // Convert screen coordinate to infinite world coordinates
  const getWorldCoords = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Position relative to canvas
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    // Map through pan translation and zoom scale factor
    const x = (screenX - panOffset.x) / zoom;
    const y = (screenY - panOffset.y) / zoom;
    return { x, y };
  };

  // Get screen coordinate from infinite world coordinates
  const getScreenCoords = (worldX, worldY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    const screenX = worldX * zoom + panOffset.x;
    const screenY = worldY * zoom + panOffset.y;

    return {
      x: rect.left + screenX,
      y: rect.top + screenY
    };
  };

  // Redraw complete canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isDark = theme === "dark";
    
    // Draw viewport backdrop
    ctx.fillStyle = isDark ? "#0f172a" : "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save context state for transformations
    ctx.save();
    
    // Apply pan and zoom transforms
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // 1. Calculate and render infinite grids in world coordinates
    const gridSpacing = 40;
    const left = -panOffset.x / zoom;
    const top = -panOffset.y / zoom;
    const right = (canvas.width - panOffset.x) / zoom;
    const bottom = (canvas.height - panOffset.y) / zoom;

    const startX = Math.floor(left / gridSpacing) * gridSpacing;
    const startY = Math.floor(top / gridSpacing) * gridSpacing;

    if (gridType === "dots") {
      ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)";
      for (let x = startX; x <= right + gridSpacing; x += gridSpacing) {
        for (let y = startY; y <= bottom + gridSpacing; y += gridSpacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (gridType === "lines") {
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
      ctx.lineWidth = 1 / zoom; // Maintain constant width on screen

      // Draw vertical grid lines
      for (let x = startX; x <= right + gridSpacing; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
      }

      // Draw horizontal grid lines
      for (let y = startY; y <= bottom + gridSpacing; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
      }
    }

    // 2. Render all panned vector shapes
    const renderShape = (shape) => {
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = shape.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (shape.type === "pen" || shape.type === "highlighter") {
        if (!shape.points || shape.points.length === 0) return;
        
        ctx.save();
        if (shape.type === "highlighter") {
          ctx.globalAlpha = 0.45;
          ctx.lineCap = "square";
        }
        
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        
        // Quad curve smoothing for professional lines
        if (shape.points.length > 1) {
          for (let i = 1; i < shape.points.length - 1; i++) {
            const xc = (shape.points[i].x + shape.points[i + 1].x) / 2;
            const yc = (shape.points[i].y + shape.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(shape.points[i].x, shape.points[i].y, xc, yc);
          }
          ctx.lineTo(shape.points[shape.points.length - 1].x, shape.points[shape.points.length - 1].y);
        } else {
          ctx.lineTo(shape.points[0].x, shape.points[0].y);
        }
        ctx.stroke();
        ctx.restore();
      } 
      else if (shape.type === "line") {
        if (shape.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        ctx.lineTo(shape.points[1].x, shape.points[1].y);
        ctx.stroke();
      } 
      else if (shape.type === "arrow") {
        if (shape.points.length < 2) return;
        const p1 = shape.points[0];
        const p2 = shape.points[1];
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Draw arrow head
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const headLength = Math.max(15, shape.width * 3.5);
        
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(
          p2.x - headLength * Math.cos(angle - Math.PI / 6),
          p2.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          p2.x - headLength * Math.cos(angle + Math.PI / 6),
          p2.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      } 
      else if (shape.type === "rect") {
        if (shape.points.length < 2) return;
        const p1 = shape.points[0];
        const p2 = shape.points[1];
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p1.x - p2.x);
        const h = Math.abs(p1.y - p2.y);

        if (shape.filled) {
          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.fillRect(x, y, w, h);
          ctx.restore();
          ctx.strokeRect(x, y, w, h);
        } else {
          ctx.strokeRect(x, y, w, h);
        }
      } 
      else if (shape.type === "circle") {
        if (shape.points.length < 2) return;
        const p1 = shape.points[0];
        const p2 = shape.points[1];
        const radius = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

        ctx.beginPath();
        ctx.arc(p1.x, p1.y, radius, 0, 2 * Math.PI);
        if (shape.filled) {
          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.fill();
          ctx.restore();
          ctx.stroke();
        } else {
          ctx.stroke();
        }
      } 
      else if (shape.type === "text") {
        if (!shape.text) return;
        const p = shape.points[0];
        ctx.font = `600 ${Math.max(16, shape.width * 4.5)}px system-ui, sans-serif`;
        ctx.fillText(shape.text, p.x, p.y);
      }
    };

    // Render historical shapes
    shapes.forEach(renderShape);

    // Render active temporary shape
    if (isDrawing && activePoints.length > 0) {
      renderShape({
        type: tool,
        points: activePoints,
        color,
        width,
        filled
      });
    }

    ctx.restore();
  }, [shapes, activePoints, isDrawing, tool, color, width, filled, gridType, theme, panOffset, zoom]);

  // Handle Resize using dynamic ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: containerWidth, height: containerHeight } = entry.contentRect;
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = containerWidth;
          canvas.height = containerHeight;
          drawCanvas();
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [drawCanvas]);

  // Redraw whenever canvas rendering states change
  useEffect(() => {
    drawCanvas();
  }, [shapes, activePoints, isDrawing, gridType, theme, panOffset, zoom, drawCanvas]);

  // Wheel zoom around cursor
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomIntensity = 0.08;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoomFactor = Math.exp(wheel * zoomIntensity);

    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.15), 5.0);

    // Zoom pivot adjustment
  
   const newPan = {
      x: mouseX - (mouseX - panOffset.x) * (newZoom / zoom),
      y: mouseY - (mouseY - panOffset.y) * (newZoom / zoom),
    };
    setPanOffset(newPan);
    setZoom(newZoom);
    broadcastView(newPan, newZoom);
  };

  // Add passive scroll wheel listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [zoom, panOffset]);

  // Erase Shape at world coordinate
  const eraseShapeAt = (vx, vy) => {
    const threshold = 18 / zoom; // Adjust selection hit area based on zoom level
    
    const matchedIndex = shapes.findIndex((shape) => {
      if (shape.type === "pen" || shape.type === "highlighter") {
        for (let i = 0; i < shape.points.length - 1; i++) {
          const dist = getDistanceToSegment(
            vx, vy, 
            shape.points[i].x, shape.points[i].y, 
            shape.points[i + 1].x, shape.points[i + 1].y
          );
          if (dist < threshold) return true;
        }
      } 
      else if (shape.type === "line" || shape.type === "arrow") {
        if (shape.points.length < 2) return false;
        const dist = getDistanceToSegment(
          vx, vy, 
          shape.points[0].x, shape.points[0].y, 
          shape.points[1].x, shape.points[1].y
        );
        if (dist < threshold) return true;
      } 
      else if (shape.type === "rect") {
        if (shape.points.length < 2) return false;
        const p1 = shape.points[0];
        const p2 = shape.points[1];
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        if (shape.filled) {
          if (vx >= minX && vx <= maxX && vy >= minY && vy <= maxY) return true;
        }
        
        const d1 = getDistanceToSegment(vx, vy, minX, minY, maxX, minY);
        const d2 = getDistanceToSegment(vx, vy, maxX, minY, maxX, maxY);
        const d3 = getDistanceToSegment(vx, vy, maxX, maxY, minX, maxY);
        const d4 = getDistanceToSegment(vx, vy, minX, maxY, minX, minY);
        if (d1 < threshold || d2 < threshold || d3 < threshold || d4 < threshold) return true;
      } 
      else if (shape.type === "circle") {
        if (shape.points.length < 2) return false;
        const p1 = shape.points[0];
        const p2 = shape.points[1];
        const radius = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const distToCenter = Math.sqrt(Math.pow(vx - p1.x, 2) + Math.pow(vy - p1.y, 2));

        if (shape.filled) {
          if (distToCenter <= radius) return true;
        } else {
          if (Math.abs(distToCenter - radius) < threshold) return true;
        }
      } 
      else if (shape.type === "text") {
        if (shape.points.length === 0) return false;
        const p = shape.points[0];
        const dist = Math.sqrt(Math.pow(vx - p.x, 2) + Math.pow(vy - p.y, 2));
        if (dist < threshold * 2) return true;
      }
      return false;
    });

    if (matchedIndex !== -1) {
      const newShapes = shapes.filter((_, idx) => idx !== matchedIndex);
      setUndoStack([...undoStack, shapes]);
      setRedoStack([]);
      setShapes(newShapes);
      broadcastShapes(newShapes);
    }
  };

  // Draw interactions: Mouse/Touch Down
  const handleStartDrawing = (clientX, clientY) => {
    const { x, y } = getWorldCoords(clientX, clientY);

    if (tool === "hand" || isReadOnly) {
      setIsPanning(true);
      setPanStart({ x: clientX - panOffset.x, y: clientY - panOffset.y });
      return;
    }

    if (tool === "text") {
      const screenPos = getScreenCoords(x, y);
      setTextInput({
        x: screenPos.x,
        y: screenPos.y,
        vx: x,
        vy: y,
        text: ""
      });
      return;
    }

    if (tool === "eraser") {
      eraseShapeAt(x, y);
      setIsDrawing(true);
      return;
    }

    setIsDrawing(true);
    setActivePoints([{ x, y }]);
  };

  // Draw interactions: Mouse/Touch Move
  const handleDrawingMove = (clientX, clientY) => {
    if (isPanning) {
     const newPan = {
        x: clientX - panStart.x,
        y: clientY - panStart.y
      };
       setPanOffset(newPan);
      broadcastView(newPan, zoom);
      return;
    }

    if (!isDrawing) return;
    const { x, y } = getWorldCoords(clientX, clientY);

    if (tool === "eraser") {
      eraseShapeAt(x, y);
      return;
    }

    if (tool === "pen" || tool === "highlighter") {
      setActivePoints((prev) => [...prev, { x, y }]);
    } else {
      if (activePoints.length > 0) {
        setActivePoints([activePoints[0], { x, y }]);
      }
    }
  };

  // Draw interactions: Mouse/Touch End
  const handleStopDrawingAction = () => {
    if (isPanning) {
      setIsPanning(false);
      broadcastView(panOffset, zoom, true);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === "eraser") return;

    if (activePoints.length > 0) {
      if ((tool === "pen" || tool === "highlighter") && activePoints.length < 2) {
        setActivePoints([]);
        return;
      }

      const newShape = {
        id: `shape_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: tool,
        points: activePoints,
        color,
        width,
        filled
      };

      const updatedShapes = [...shapes, newShape];
      setUndoStack([...undoStack, shapes]);
      setRedoStack([]);
      setShapes(updatedShapes);
      broadcastShapes(updatedShapes);
    }

    setActivePoints([]);
  };

  // Multi-touch tracking for panning & pinch zooming
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      setIsDrawing(false);
      setIsPanning(false);
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.sqrt(
        Math.pow(touch1.clientX - touch2.clientX, 2) + 
        Math.pow(touch1.clientY - touch2.clientY, 2)
      );
      lastTouchDistanceRef.current = dist;
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      handleStartDrawing(touch.clientX, touch.clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && lastTouchDistanceRef.current !== null) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const dist = Math.sqrt(
        Math.pow(touch1.clientX - touch2.clientX, 2) + 
        Math.pow(touch1.clientY - touch2.clientY, 2)
      );

      const midX = (touch1.clientX + touch2.clientX) / 2;
      const midY = (touch1.clientY + touch2.clientY) / 2;
      
      const zoomFactor = dist / lastTouchDistanceRef.current;
      const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.15), 5.0);

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const pivotX = midX - rect.left;
        const pivotY = midY - rect.top;

        const newPan = {
          x: pivotX - (pivotX - panOffset.x) * (newZoom / zoom),
          y: pivotY - (pivotY - panOffset.y) * (newZoom / zoom),
        };
        setPanOffset(newPan);
        setZoom(newZoom);
        broadcastView(newPan, newZoom);
      }

      lastTouchDistanceRef.current = dist;
    } else if (e.touches.length === 1 && !isPanning) {
      const touch = e.touches[0];
      handleDrawingMove(touch.clientX, touch.clientY);
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistanceRef.current = null;
    handleStopDrawingAction();
  };

  // Commit Inline Text Creation
  const handleCommitText = () => {
    if (!textInput || !textInput.text.trim()) {
      setTextInput(null);
      return;
    }

    const newShape = {
      id: `text_${Date.now()}`,
      type: "text",
      points: [{ x: textInput.vx, y: textInput.vy }],
      color,
      width,
      text: textInput.text,
      filled: false
    };

    const updatedShapes = [...shapes, newShape];
    setUndoStack([...undoStack, shapes]);
    setRedoStack([]);
    setShapes(updatedShapes);
    broadcastShapes(updatedShapes);
    setTextInput(null);
  };

  // Focus effect for text inputs
  useEffect(() => {
    if (textInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textInput]);

  // Undo / Redo Actions
  const handleUndo = () => {
    if (isReadOnly || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack([...redoStack, shapes]);
    setUndoStack(undoStack.slice(0, -1));
    setShapes(previous);
    broadcastShapes(previous);
  };

  const handleRedo = () => {
    if (isReadOnly || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack([...undoStack, shapes]);
    setRedoStack(redoStack.slice(0, -1));
    setShapes(next);
    broadcastShapes(next);
  };

  const handleClearBoard = () => {
    if (isReadOnly) return;
    if (window.confirm("Are you sure you want to clear the entire whiteboard?")) {
      setUndoStack([...undoStack, shapes]);
      setRedoStack([]);
      setShapes([]);
      broadcastShapes([]);
    }
  };

  // Zoom Operations
  const handleZoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const midX = canvas.width / 2;
    const midY = canvas.height / 2;
    const newZoom = Math.min(zoom + 0.15, 5.0);
    
     const newPan = {
      x: midX - (midX - panOffset.x) * (newZoom / zoom),
      y: midY - (midY - panOffset.y) * (newZoom / zoom),
    };
    setPanOffset(newPan);
    setZoom(newZoom);
    broadcastView(newPan, newZoom, true);
  };

  const handleZoomOut = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const midX = canvas.width / 2;
    const midY = canvas.height / 2;
    const newZoom = Math.max(zoom - 0.15, 0.15);
     const newPan = {
      x: midX - (midX - panOffset.x) * (newZoom / zoom),
      y: midY - (midY - panOffset.y) * (newZoom / zoom),
    };
    setPanOffset(newPan);
    setZoom(newZoom);
    broadcastView(newPan, newZoom, true);
  };

  const handleResetView = () => {
     const newPan = { x: 0, y: 0 };
    const newZoom = 1.0;
    setPanOffset(newPan);
    setZoom(newZoom);
    broadcastView(newPan, newZoom, true);
  };

  // Advanced Bounding Box Export to PNG
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (shapes.length === 0) {
      alert("There are no drawings on the whiteboard to export.");
      return;
    }

    // Determine absolute boundaries of drawn world shapes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    shapes.forEach((shape) => {
      shape.points.forEach((p) => {
        // Expand bounding bounds
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });

      // Handle custom text box padding dimensions
      if (shape.type === "text" && shape.text) {
        const textHeight = Math.max(16, shape.width * 4.5);
        const guessedWidth = shape.text.length * textHeight * 0.6;
        if (shape.points[0].x + guessedWidth > maxX) maxX = shape.points[0].x + guessedWidth;
        if (shape.points[0].y + textHeight > maxY) maxY = shape.points[0].y + textHeight;
      }
    });

    // Padding safety margin around bounding box (minimum 80px)
    const padding = 80;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const widthExport = maxX - minX;
    const heightExport = maxY - minY;

    // Create custom offscreen canvas fitting drawing coordinates bounding box
    const offscreen = document.createElement("canvas");
    offscreen.width = widthExport;
    offscreen.height = heightExport;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    // Background fill matching theme
    const isDark = theme === "dark";
    ctx.fillStyle = isDark ? "#0f172a" : "#ffffff";
    ctx.fillRect(0, 0, widthExport, heightExport);

    // Apply translation to draw everything starting from (minX, minY)
    ctx.save();
    ctx.translate(-minX, -minY);

    // Draw full grid backdrop inside the bounded region
    const gridSpacing = 40;
    const gridStartX = Math.floor(minX / gridSpacing) * gridSpacing;
    const gridStartY = Math.floor(minY / gridSpacing) * gridSpacing;

    if (gridType === "dots") {
      ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)";
      for (let gx = gridStartX; gx <= maxX + gridSpacing; gx += gridSpacing) {
        for (let gy = gridStartY; gy <= maxY + gridSpacing; gy += gridSpacing) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (gridType === "lines") {
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
      ctx.lineWidth = 1;

      for (let gx = gridStartX; gx <= maxX + gridSpacing; gx += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(gx, minY);
        ctx.lineTo(gx, maxY);
        ctx.stroke();
      }

      for (let gy = gridStartY; gy <= maxY + gridSpacing; gy += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(minX, gy);
        ctx.lineTo(maxX, gy);
        ctx.stroke();
      }
    }

    // Render shapes offscreen
    shapes.forEach((shape) => {
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = shape.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (shape.type === "pen" || shape.type === "highlighter") {
        if (!shape.points || shape.points.length === 0) return;
        ctx.save();
        if (shape.type === "highlighter") {
          ctx.globalAlpha = 0.45;
          ctx.lineCap = "square";
        }
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        if (shape.points.length > 1) {
          for (let i = 1; i < shape.points.length - 1; i++) {
            const xc = (shape.points[i].x + shape.points[i + 1].x) / 2;
            const yc = (shape.points[i].y + shape.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(shape.points[i].x, shape.points[i].y, xc, yc);
          }
          ctx.lineTo(shape.points[shape.points.length - 1].x, shape.points[shape.points.length - 1].y);
        } else {
          ctx.lineTo(shape.points[0].x, shape.points[0].y);
        }
        ctx.stroke();
        ctx.restore();
      } 
      else if (shape.type === "line") {
        if (shape.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        ctx.lineTo(shape.points[1].x, shape.points[1].y);
        ctx.stroke();
      } 
      else if (shape.type === "arrow") {
        if (shape.points.length < 2) return;
        const p1 = shape.points[0];
        const p2 = shape.points[1];
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const headLength = Math.max(15, shape.width * 3.5);
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(
          p2.x - headLength * Math.cos(angle - Math.PI / 6),
          p2.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          p2.x - headLength * Math.cos(angle + Math.PI / 6),
          p2.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      } 
      else if (shape.type === "rect") {
        if (shape.points.length < 2) return;
        const p1 = shape.points[0];
        const p2 = shape.points[1];
        const rx = Math.min(p1.x, p2.x);
        const ry = Math.min(p1.y, p2.y);
        const rw = Math.abs(p1.x - p2.x);
        const rh = Math.abs(p1.y - p2.y);

        if (shape.filled) {
          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.fillRect(rx, ry, rw, rh);
          ctx.restore();
          ctx.strokeRect(rx, ry, rw, rh);
        } else {
          ctx.strokeRect(rx, ry, rw, rh);
        }
      } 
      else if (shape.type === "circle") {
        if (shape.points.length < 2) return;
        const p1 = shape.points[0];
        const p2 = shape.points[1];
        const radius = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

        ctx.beginPath();
        ctx.arc(p1.x, p1.y, radius, 0, 2 * Math.PI);
        if (shape.filled) {
          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.fill();
          ctx.restore();
          ctx.stroke();
        } else {
          ctx.stroke();
        }
      } 
      else if (shape.type === "text") {
        if (!shape.text) return;
        const p = shape.points[0];
        ctx.font = `600 ${Math.max(16, shape.width * 4.5)}px system-ui, sans-serif`;
        ctx.fillText(shape.text, p.x, p.y);
      }
    });

    ctx.restore();

    // Trigger PNG file download
    const dataUrl = offscreen.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `study_whiteboard_${roomId || "session"}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div 
      ref={containerRef}
      id="whiteboard-viewport-container"
      className="w-full h-full bg-zinc-950 flex flex-col relative select-none rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-inner overflow-hidden"
    >
      {/* 1. Header Navigation Toolbar */}
      <div 
        id="whiteboard-header-bar"
        className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-lg flex items-center justify-between gap-5 max-w-[95%] sm:max-w-max transition-all"
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 hidden sm:inline-block">
            Infinite Workspace
          </span>
        </div>

        {/* Undo, Redo, Download, Trash */}
        <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-800 pl-4">
          <button
            onClick={handleUndo}
            disabled={isReadOnly || undoStack.length === 0}
            className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-35 disabled:hover:bg-transparent transition"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={isReadOnly || redoStack.length === 0}
            className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-35 disabled:hover:bg-transparent transition"
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleExportPNG}
            className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition pl-3 ml-1 border-l border-zinc-200 dark:border-zinc-800"
            title="Export Bounded Drawing (PNG)"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleClearBoard}
            disabled={isReadOnly || shapes.length === 0}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-30 disabled:hover:bg-transparent transition"
            title="Clear Board Canvas"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Zoom Controls */}
        <div className="flex items-center gap-1.5 border-l border-zinc-200 dark:border-zinc-800 pl-4">
          <button
            onClick={handleZoomOut}
            className="p-1 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-300 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetView}
            className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ml-0.5"
            title="Reset Infinite Camera"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Canvas Theme Toggle */}
        <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-800 pl-4">
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:opacity-90 transition"
          >
            {theme === "light" ? "Chalkboard" : "Paper Mode"}
          </button>
        </div>

        {isReadOnly && (
          <div className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full dark:bg-amber-950/40 dark:text-amber-300">
            Read Only
          </div>
        )}
      </div>

      {/* 2. Left Floating Tool Picker */}
      <div 
        id="whiteboard-toolbox"
        className="absolute left-3 top-24 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col gap-1 transition-all"
      >
        <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 text-center uppercase py-0.5 border-b border-zinc-100 dark:border-zinc-800/80 mb-1">
          Tool
        </span>
        {[
          { id: "hand", icon: Hand, label: "Pan Hand Tool (Drag Space)" },
          { id: "pen", icon: Pen, label: "Ink Pen" },
          { id: "highlighter", icon: Highlighter, label: "Marker Highlighter" },
          { id: "line", icon: Slash, label: "Straight Line" },
          { id: "arrow", icon: ArrowUpRight, label: "Connector Arrow" },
          { id: "rect", icon: Square, label: "Rectangle Box" },
          { id: "circle", icon: Circle, label: "Perfect Circle" },
          { id: "text", icon: Type, label: "Inline Text Note" },
          { id: "eraser", icon: Eraser, label: "Stroke Eraser" }
        ].map((item) => {
          const Icon = item.icon;
          const isActive = tool === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setTool(item.id);
                if (item.id === "eraser") {
                  setActivePoints([]);
                }
              }}
              className={`p-2.5 rounded-xl transition flex items-center justify-center relative group ${
                isActive 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" 
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
              {/* Tooltip */}
              <div className="absolute left-14 bg-zinc-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-50">
                {item.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Right Floating Customizer Styles Panel */}
      <div 
        id="whiteboard-customizer"
        className="absolute right-3 top-24 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col gap-4 max-w-[200px] transition-all"
      >
        {/* Color Picker */}
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block mb-2 flex items-center gap-1">
            <Palette className="w-3 h-3 text-indigo-500" /> Color Accent
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {COLORS.map((col) => {
              let finalValue = col.value;
              if (col.name === "Slate" && theme === "dark") {
                finalValue = "#1e293b";
              } else if (col.name === "White/Light" && theme === "dark") {
                finalValue = "#ffffff";
              } else if (col.name === "White/Light" && theme === "light") {
                finalValue = "#e2e8f0";
              }

              const isSelected = color.toLowerCase() === col.value.toLowerCase() || color.toLowerCase() === finalValue.toLowerCase();
              return (
                <button
                  key={col.name}
                  onClick={() => setColor(finalValue)}
                  className="w-6 h-6 rounded-full border border-zinc-300 dark:border-zinc-700 relative flex items-center justify-center transition hover:scale-110"
                  style={{ backgroundColor: finalValue }}
                  title={col.name}
                >
                  {isSelected && (
                    <Check 
                      className={`w-3 h-3 ${
                        col.name === "White/Light" ? "text-zinc-900" : "text-white"
                      }`} 
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Hex Picker */}
          <div className="mt-2.5 flex items-center gap-2">
            <input 
              type="color" 
              value={color} 
              onChange={(e) => setColor(e.target.value)}
              className="w-5 h-5 p-0 border-0 rounded cursor-pointer bg-transparent"
              title="Custom Hex Selector"
            />
            <span className="text-[9px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase">
              {color}
            </span>
          </div>
        </div>

        {/* Width Selector */}
        <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-3">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block mb-1">
            Line Width ({width}px)
          </span>
          <input
            type="range"
            min="2"
            max="25"
            value={width}
            onChange={(e) => setWidth(parseInt(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer"
          />
        </div>

        {/* Fill Shapes Selector */}
        {(tool === "rect" || tool === "circle") && (
          <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-3 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Fill Shape
            </span>
            <button
              onClick={() => setFilled(!filled)}
              className={`w-10 h-6 rounded-full p-1 transition-colors ${
                filled ? "bg-indigo-600" : "bg-zinc-200 dark:bg-zinc-800"
              }`}
            >
              <div 
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  filled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}

        {/* Grid Backdrop Options */}
        <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-3">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block mb-2 flex items-center gap-1">
            <Grid className="w-3 h-3 text-indigo-500" /> Grid Pattern
          </span>
          <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            {[
              { id: "dots", label: "Dots" },
              { id: "lines", label: "Graph" },
              { id: "solid", label: "None" }
            ].map((g) => (
              <button
                key={g.id}
                onClick={() => setGridType(g.id)}
                className={`text-[9px] font-bold py-1 rounded-lg transition text-center ${
                  gridType === g.id 
                    ? "bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Main HTML5 Interactive Canvas */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-zinc-900">
        <canvas
          ref={canvasRef}
          onMouseDown={(e) => handleStartDrawing(e.clientX, e.clientY)}
          onMouseMove={(e) => handleDrawingMove(e.clientX, e.clientY)}
          onMouseUp={handleStopDrawingAction}
          onMouseLeave={handleStopDrawingAction}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`w-full h-full block touch-none ${
            tool === "hand" 
              ? isPanning ? "cursor-grabbing" : "cursor-grab" 
              : "cursor-crosshair"
          }`}
        />

        {/* 5. Inline Text Annotation Editor */}
        {textInput && (
          <div 
            className="absolute z-40 bg-white/95 dark:bg-zinc-900 p-2 rounded-lg border border-indigo-500 shadow-xl flex items-center gap-2"
            style={{
              left: `${textInput.x}px`,
              top: `${textInput.y - 45}px`,
            }}
          >
            <input
              ref={textInputRef}
              type="text"
              value={textInput.text}
              onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCommitText();
                } else if (e.key === "Escape") {
                  setTextInput(null);
                }
              }}
              placeholder="Type text note and press Enter..."
              className="px-2.5 py-1 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-800 dark:text-white min-w-[180px]"
            />
            <button
              onClick={handleCommitText}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold transition"
            >
              Add
            </button>
            <button
              onClick={() => setTextInput(null)}
              className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-md text-xs transition"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
