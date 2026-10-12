import { Pen, Highlighter, Underline, ArrowUpRight, Circle, Type, Eraser, RotateCcw, RotateCw } from "lucide-react";

export default function AnnotationToolbar({
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  lineWidth,
  setLineWidth,
  onClearAll,
  onUndo,
  onRedo,
  canAnnotate
}) {
  if (!canAnnotate) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-500">
        <span>Viewer Mode (Annotations Locked)</span>
      </div>
    );
  }

  const tools = [
    { id: "pen", label: "Pen Draw", icon: Pen },
    { id: "highlight", label: "Highlight", icon: Highlighter },
    { id: "underline", label: "Underline", icon: Underline },
    { id: "arrow", label: "Arrow", icon: ArrowUpRight },
    { id: "circle", label: "Circle", icon: Circle },
    { id: "text", label: "Text", icon: Type },
    { id: "eraser", label: "Eraser", icon: Eraser },
  ];

  const colors = [
    { value: "#4F46E5", class: "bg-[#4F46E5]" },
    { value: "#EF4444", class: "bg-[#EF4444]" },
    { value: "#10B981", class: "bg-[#10B981]" },
    { value: "#FBBF24", class: "bg-[#FBBF24]" },
    { value: "#18181B", class: "bg-[#18181B]" }, // Slate black
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 bg-white border border-zinc-200 rounded-lg p-1.5 shadow-sm max-w-full">
      {/* Tools */}
      <div className="flex items-center space-x-0.5">
        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className={`p-1.5 rounded-md transition-all ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm font-bold scale-105"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              }`}
              title={t.label}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      <div className="h-4 w-[1px] bg-zinc-200 hidden sm:block"></div>

      {/* Colors */}
      <div className="flex items-center space-x-1">
        {colors.map((c) => {
          const isActive = activeColor === c.value;
          return (
            <button
              key={c.value}
              onClick={() => setActiveColor(c.value)}
              className={`w-5 h-5 rounded-full ${c.class} transition-all border border-black/10 relative ${
                isActive ? "ring-2 ring-offset-1 ring-indigo-500 scale-110" : "hover:scale-105"
              }`}
              title="Change Color"
            >
              {isActive && (
                <span className="absolute inset-0 m-auto w-1.5 h-1.5 bg-white rounded-full"></span>
              )}
            </button>
          );
        })}
      </div>

      <div className="h-4 w-[1px] bg-zinc-200 hidden sm:block"></div>

      {/* Line Widths */}
      <div className="flex items-center space-x-1 bg-zinc-50 rounded-lg p-0.5 border border-zinc-200">
        {[
          { label: "Thin", value: 2, dotSize: "w-1 h-1" },
          { label: "Medium", value: 5, dotSize: "w-1.5 h-1.5" },
          { label: "Thick", value: 9, dotSize: "w-2.5 h-2.5" }
        ].map((size) => {
          const isActive = lineWidth === size.value;
          return (
            <button
              key={size.value}
              onClick={() => setLineWidth(size.value)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition flex items-center space-x-1 ${
                isActive ? "bg-white text-indigo-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
              title={`${size.label} Stroke`}
            >
              <span className={`rounded-full bg-current ${size.dotSize}`}></span>
              <span className="hidden md:inline">{size.label}</span>
            </button>
          );
        })}
      </div>

      <div className="h-4 w-[1px] bg-zinc-200"></div>

      {/* Undo / Redo / Clear Actions */}
      <div className="flex items-center space-x-1">
        {onUndo && (
          <button
            onClick={onUndo}
            className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
            title="Undo Last Drawing"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}

        {onRedo && (
          <button
            onClick={onRedo}
            className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
            title="Redo Last Drawing"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        )}
        
        {onClearAll && (
          <button
            onClick={onClearAll}
            className="text-[10px] text-red-500 hover:text-red-700 font-bold px-2 py-1.5 rounded-md hover:bg-red-50 transition border border-transparent hover:border-red-100"
          >
            Clear Page
          </button>
        )}
      </div>
    </div>
  );
}
