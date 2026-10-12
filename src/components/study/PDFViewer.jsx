import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Upload, AlertCircle, ChevronLeft, ChevronRight, FileText, Maximize2, Minimize2, Pen } from "lucide-react";
import AnnotationToolbar from "./AnnotationToolbar";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/api/pdf/worker/pdf.worker.min.mjs";

export default function PDFViewer({
  roomId,
  pdfUrl,
  currentPage,
  onPageChange,
  canAnnotate,
  onUploadSuccess,
  socketService,
  isHost,
}) {
  const [numPages, setNumPages] = useState(1);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [activeTool, setActiveTool] = useState("pen");
  const [activeColor, setActiveColor] = useState("#4F46E5");
  const [lineWidth, setLineWidth] = useState(5);
  const [annotations, setAnnotations] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState([]);
  const [fitWidth, setFitWidth] = useState(true);
  const [showDrawTools, setShowDrawTools] = useState(true);

  const [undoHistory, setUndoHistory] = useState([]);
  const [redoHistory, setRedoHistory] = useState([]);
  const [pageInput, setPageInput] = useState(currentPage.toString());

  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setUndoHistory([]);
    setRedoHistory([]);
  }, [currentPage]);

  const handlePageInputSubmit = (e) => {
    e.preventDefault();
    const pNum = parseInt(pageInput, 10);
    if (!isNaN(pNum) && pNum >= 1 && pNum <= numPages) {
      onPageChange(pNum);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const canvasRef = useRef(null);
  const annotationCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    if (!pdfUrl) return;

    setLoading(true);
    setError("");

    fetch(pdfUrl)
      .then((res) => {
        if (res.status === 404) {
          setPdfDoc(null);
          setLoading(false);
          return null;
        }
        if (!res.ok) {
          throw new Error("Failed to fetch PDF status");
        }
        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
        return loadingTask.promise;
      })
      .then((pdf) => {
        if (pdf) {
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("PDF loading failed:", err);
        setError("Failed to load PDF. Check file format.");
        setLoading(false);
      });
  }, [pdfUrl]);

  useEffect(() => {
    if (!pdfDoc) return;

    let active = true;
    let currentRenderTask = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (!active) return;

        // Ensure we respect page.rotate, default to 0 if not defined
        const viewport = page.getViewport({ scale: 1.5, rotation: page.rotate || 0 });

        const canvas = canvasRef.current;
        const annCanvas = annotationCanvasRef.current;

        if (canvas && annCanvas) {
          const context = canvas.getContext("2d");
          if (context) {
            // Setting dimensions clears the canvas and resets state/transforms
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            annCanvas.width = viewport.width;
            annCanvas.height = viewport.height;

            const renderContext = {
              canvasContext: context,
              viewport: viewport,
            };

            // Cancel any previously active rendering task to avoid overlapping transforms
            if (renderTaskRef.current) {
              try {
                renderTaskRef.current.cancel();
              } catch (e) {
                // Ignore cancel errors
              }
            }

            currentRenderTask = page.render(renderContext);
            renderTaskRef.current = currentRenderTask;

            await currentRenderTask.promise;

            if (active) {
              drawAnnotations();
            }
          }
        }
      } catch (err) {
        if (err.name === "RenderingCancelledException" || err.message?.includes("cancelled")) {
          // Normal cancellation, ignore error
          return;
        }
        console.error("Page render error:", err);
      }
    };

    renderPage();

    return () => {
      active = false;
      if (currentRenderTask) {
        try {
          currentRenderTask.cancel();
        } catch (e) {
          // Ignore cancel errors
        }
      }
    };
  }, [pdfDoc, currentPage]);

  useEffect(() => {
    drawAnnotations();
  }, [annotations]);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;
    const currentUserId = user?.id || user?.userId || "";

    const unsubscribe = socketService.subscribe((type, payload) => {
      if (type === "annotations-sync" && payload.pageNumber === currentPage && payload.userId !== currentUserId) {
        setAnnotations(payload.elements || []);
      }
    });

    return () => unsubscribe();
  }, [currentPage, socketService]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!canAnnotate) {
      setError("Only hosts and speakers are authorized to upload documents.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("pdf", file);

      const token = localStorage.getItem("crm_token");
      const res = await fetch(`/api/pdf/upload/${roomId}`, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload PDF");
      }

      onUploadSuccess();
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const drawSmoothLine = (ctx, points) => {
    if (points.length < 1) return;
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (points.length === 2) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    let i;
    for (i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  };

  const drawAnnotations = (tempLine) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    annotations.forEach((ann) => {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = ann.width || (ann.type === "highlight" ? 12 : 3);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (ann.points.length === 0) return;

      if (ann.type === "highlight") {
        ctx.globalAlpha = 0.35;
        drawSmoothLine(ctx, ann.points);
        ctx.globalAlpha = 1.0;
      } else if (ann.type === "pen" || ann.type === "draw") {
        drawSmoothLine(ctx, ann.points);
      } else if (ann.type === "underline") {
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        ctx.lineTo(ann.points[ann.points.length - 1].x, ann.points[0].y);
        ctx.stroke();
      } else if (ann.type === "arrow") {
        const start = ann.points[0];
        const end = ann.points[ann.points.length - 1];
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - 15 * Math.cos(angle - Math.PI / 6), end.y - 15 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(end.x - 15 * Math.cos(angle + Math.PI / 6), end.y - 15 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      } else if (ann.type === "circle") {
        const start = ann.points[0];
        const end = ann.points[ann.points.length - 1];
        const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        ctx.beginPath();
        ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (ann.type === "text" && ann.text) {
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(ann.text, ann.points[0].x, ann.points[0].y);
      }
    });

    const activePoints = tempLine || currentLine;
    if (isDrawing && activePoints.length > 0) {
      ctx.strokeStyle = activeColor;
      ctx.fillStyle = activeColor;
      const currentWidth = activeTool === "highlight" ? lineWidth * 4 : lineWidth;
      ctx.lineWidth = currentWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (activeTool === "highlight") {
        ctx.globalAlpha = 0.35;
        drawSmoothLine(ctx, activePoints);
        ctx.globalAlpha = 1.0;
      } else if (activeTool === "pen" || activeTool === "draw") {
        drawSmoothLine(ctx, activePoints);
      } else if (activeTool === "underline") {
        ctx.beginPath();
        ctx.moveTo(activePoints[0].x, activePoints[0].y);
        ctx.lineTo(activePoints[activePoints.length - 1].x, activePoints[0].y);
        ctx.stroke();
      } else if (activeTool === "arrow") {
        const start = activePoints[0];
        const end = activePoints[activePoints.length - 1];
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - 15 * Math.cos(angle - Math.PI / 6), end.y - 15 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(end.x - 15 * Math.cos(angle + Math.PI / 6), end.y - 15 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      } else if (activeTool === "circle") {
        const start = activePoints[0];
        const end = activePoints[activePoints.length - 1];
        const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        ctx.beginPath();
        ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  };

  const getCoordinates = (e) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches?.[0]?.clientX ?? 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches?.[0]?.clientY ?? 0);
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleMouseDown = (e) => {
    if (!canAnnotate || !showDrawTools) return;

    const coords = getCoordinates(e);
    setIsDrawing(true);
    setCurrentLine([coords]);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    setCurrentLine((prev) => {
      const updated = [...prev, coords];
      drawAnnotations(updated);
      return updated;
    });
  };

  const addAnnotationState = (newAnnotations) => {
    setUndoHistory((prev) => [...prev, annotations]);
    setRedoHistory([]);
    setAnnotations(newAnnotations);
    broadcastAnnotations(newAnnotations);
  };

  const handleMouseUp = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (activeTool === "eraser") {
      const coords = getCoordinates(e);
      const filtered = annotations.filter((ann) => {
        return !ann.points.some((p) => Math.sqrt(Math.pow(p.x - coords.x, 2) + Math.pow(p.y - coords.y, 2)) < 25);
      });
      addAnnotationState(filtered);
    } else if (activeTool === "text") {
      const coords = getCoordinates(e);
      const text = window.prompt("Enter your annotation text:");
      if (text) {
        const newAnn = {
          type: "text",
          color: activeColor,
          width: lineWidth,
          points: [coords, coords],
          text,
        };
        const updated = [...annotations, newAnn];
        addAnnotationState(updated);
      }
    } else {
      const coords = getCoordinates(e);
      const newAnn = {
        type: activeTool,
        color: activeColor,
        width: activeTool === "highlight" ? lineWidth * 4 : lineWidth,
        points: [...currentLine, coords],
      };
      const updated = [...annotations, newAnn];
      addAnnotationState(updated);
    }

    setCurrentLine([]);
  };

  const handleTouchStart = (e) => {
    if (!canAnnotate || !showDrawTools) return;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const coords = getCoordinates(touch);
      setIsDrawing(true);
      setCurrentLine([coords]);
    }
  };

  const handleTouchMove = (e) => {
    if (!isDrawing) return;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const coords = getCoordinates(touch);
      setCurrentLine((prev) => {
        const updated = [...prev, coords];
        drawAnnotations(updated);
        return updated;
      });
    }
  };

  const handleTouchEnd = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    let coords = currentLine[currentLine.length - 1];
    if (e.changedTouches && e.changedTouches.length > 0) {
      coords = getCoordinates(e.changedTouches[0]);
    }

    if (!coords) {
      setCurrentLine([]);
      return;
    }

    if (activeTool === "eraser") {
      const filtered = annotations.filter((ann) => {
        return !ann.points.some((p) => Math.sqrt(Math.pow(p.x - coords.x, 2) + Math.pow(p.y - coords.y, 2)) < 25);
      });
      addAnnotationState(filtered);
    } else if (activeTool === "text") {
      const text = window.prompt("Enter your annotation text:");
      if (text) {
        const newAnn = {
          type: "text",
          color: activeColor,
          width: lineWidth,
          points: [coords, coords],
          text,
        };
        const updated = [...annotations, newAnn];
        addAnnotationState(updated);
      }
    } else {
      const newAnn = {
        type: activeTool,
        color: activeColor,
        width: activeTool === "highlight" ? lineWidth * 4 : lineWidth,
        points: [...currentLine, coords],
      };
      const updated = [...annotations, newAnn];
      addAnnotationState(updated);
    }

    setCurrentLine([]);
  };

  const handleUndo = () => {
    if (annotations.length === 0 && undoHistory.length === 0) return;
    if (undoHistory.length > 0) {
      const prev = undoHistory[undoHistory.length - 1];
      setUndoHistory((p) => p.slice(0, -1));
      setRedoHistory((p) => [...p, annotations]);
      setAnnotations(prev);
      broadcastAnnotations(prev);
    } else {
      setRedoHistory((p) => [...p, annotations]);
      setAnnotations([]);
      broadcastAnnotations([]);
    }
  };

  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    const next = redoHistory[redoHistory.length - 1];
    setRedoHistory((p) => p.slice(0, -1));
    setUndoHistory((p) => [...p, annotations]);
    setAnnotations(next);
    broadcastAnnotations(next);
  };

  const broadcastAnnotations = (list) => {
    socketService.send("annotations-sync", {
      pageNumber: currentPage,
      elements: list,
    });
  };

  const handleClearPage = () => {
    addAnnotationState([]);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 border border-zinc-200 rounded-lg overflow-hidden relative shadow-sm">
      <div className="h-12 bg-white border-b border-zinc-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1 || loading}
            className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-lg disabled:opacity-45"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <form onSubmit={handlePageInputSubmit} className="flex items-center mx-1 bg-zinc-50 border border-zinc-200 rounded px-2 py-0.5 shadow-inner">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-zinc-400 mr-1.5">Page</span>
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => {
                const pNum = parseInt(pageInput, 10);
                if (!isNaN(pNum) && pNum >= 1 && pNum <= numPages) {
                  onPageChange(pNum);
                } else {
                  setPageInput(currentPage.toString());
                }
              }}
              className="w-8 text-center text-xs font-black text-indigo-700 focus:outline-none bg-transparent"
            />
            <span className="text-[10px] font-extrabold text-zinc-400 ml-1.5">/ {numPages}</span>
          </form>
          <button
            onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages || loading}
            className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-lg disabled:opacity-45"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="h-4 w-[1px] bg-zinc-200 mx-1"></span>

          <button
            onClick={() => setFitWidth(!fitWidth)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center space-x-1 border transition-all ${
              fitWidth
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 shadow-sm"
                : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            }`}
            title={fitWidth ? "Switch to Actual Size" : "Fit to Width"}
          >
            {fitWidth ? (
              <>
                <Minimize2 className="w-3 h-3" />
                <span className="hidden md:inline">Actual Size</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3" />
                <span className="hidden md:inline">Fit Width</span>
              </>
            )}
          </button>
          {canAnnotate && (
            <>
              <span className="h-4 w-[1px] bg-zinc-200 mx-1"></span>
              <button
                onClick={() => setShowDrawTools(!showDrawTools)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center space-x-1 border transition-all ${
                  showDrawTools
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm hover:bg-indigo-700"
                    : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                }`}
                title={showDrawTools ? "Hide Draw Options" : "Show Draw Options"}
              >
                <Pen className="w-3.5 h-3.5" />
                <span>{showDrawTools ? "Draw On" : "Draw Off"}</span>
              </button>
            </>
          )}
        </div>

        {canAnnotate && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="application/pdf"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="flex items-center space-x-1 px-3 py-1.5 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 rounded-lg text-xs font-bold text-zinc-700 transition"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{loading ? "Uploading..." : "Upload PDF"}</span>
            </button>
          </div>
        )}
      </div>

      {canAnnotate && showDrawTools && pdfUrl && (
        <div className="absolute top-[52px] left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-top-2 duration-200 max-w-[90%]">
          <AnnotationToolbar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            activeColor={activeColor}
            setActiveColor={setActiveColor}
            lineWidth={lineWidth}
            setLineWidth={setLineWidth}
            onClearAll={handleClearPage}
            onUndo={undoHistory.length > 0 || annotations.length > 0 ? handleUndo : null}
            onRedo={redoHistory.length > 0 ? handleRedo : null}
            canAnnotate={canAnnotate}
          />
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 flex min-h-0 relative">
        {loading && (
          <div className="m-auto flex flex-col items-center justify-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
            <span className="text-xs text-zinc-500 font-bold">Rendering Document Page...</span>
          </div>
        )}

        {error && (
          <div className="m-auto p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700 max-w-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
        )}

        {!pdfUrl && !loading && (
          <div className="m-auto text-center p-10 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
              <FileText className="w-8 h-8" />
            </div>
            <div className="space-y-3 flex flex-col items-center">
              <h3 className="font-bold text-zinc-900">No Document Shared</h3>
              {canAnnotate ? (
                <>
                  <p className="text-xs text-zinc-500 max-w-xs mb-1">
                    Upload a PDF document to begin collaborative reviewing and annotations with other participants.
                  </p>
                  <div>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      accept="application/pdf"
                      className="hidden"
                      id="empty-state-upload"
                    />
                    <label
                      htmlFor="empty-state-upload"
                      className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload PDF</span>
                    </label>
                  </div>
                </>
              ) : (
                <p className="text-xs text-zinc-500 max-w-xs mb-1">
                  Waiting for the host or approved speaker to upload and share a PDF document. Please ask the host to grant you permission if you wish to upload.
                </p>
              )}
            </div>
          </div>
        )}

        {pdfUrl && !loading && !error && (
          <div className={`relative shadow-lg border border-zinc-200 rounded overflow-hidden select-none m-auto ${
            fitWidth ? "w-full max-w-full h-auto" : ""
          }`}>
            <canvas ref={canvasRef} className={`block ${fitWidth ? "w-full h-auto" : ""}`} />
            <canvas
              ref={annotationCanvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={`absolute top-0 left-0 block z-10 ${
                fitWidth ? "w-full h-auto" : ""
              } ${
                canAnnotate && showDrawTools && activeTool !== "select" ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
              }`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
