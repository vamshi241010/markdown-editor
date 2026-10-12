import { useState } from "react";
import { Play, Coffee,Square } from "lucide-react";

export default function PomodoroTimer({
  active,
  timeLeft,
  duration,
  isBreak,
  onStart,
  onStop,
  isHost
}) {
  const [customDuration, setCustomDuration] = useState("25");

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = duration > 0 ? (timeLeft / duration) * 100 : 0;

  const handleStartTimer = (breakMode) => {
    const mins = parseInt(customDuration, 10);
    if (!isNaN(mins) && mins > 0) {
      onStart(mins, breakMode);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center space-x-1">
          <Coffee className="w-3.5 h-3.5 text-indigo-500" />
          <span>Pomodoro Session</span>
        </h3>
        <span className={`text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded ${
          isBreak ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-700"
        }`}>
          {isBreak ? "Break" : "Study Mode"}
        </span>
      </div>

      <div className="flex items-center justify-center py-4">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="58"
              className="stroke-zinc-100"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="64"
              cy="64"
              r="58"
              className={`transition-all duration-1000 ${
                isBreak ? "stroke-green-500" : "stroke-indigo-600"
              }`}
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={364.4}
              strokeDashoffset={364.4 - (364.4 * progress) / 100}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-mono font-black text-zinc-900 tracking-tight">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
            <span className="text-[10px] text-zinc-500 font-semibold uppercase mt-0.5">
              {active ? "Focusing" : "Paused"}
            </span>
          </div>
        </div>
      </div>

      {isHost ? (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="number"
              min="1"
              max="120"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              disabled={active}
              className="w-16 text-center px-2 py-1.5 border border-zinc-200 bg-zinc-50 rounded-lg text-sm font-semibold focus:outline-none"
            />
            <span className="text-xs text-zinc-500 font-medium">Minutes</span>
          </div>
{active ? (
            <button
              onClick={onStop}
              className="w-full flex items-center justify-center space-x-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg text-xs transition shadow-sm"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop Timer</span>
            </button>
          ) : (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => handleStartTimer(false)}
              disabled={active}
              className="flex items-center justify-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg text-xs transition disabled:bg-zinc-100 disabled:text-zinc-400 shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Study</span>
            </button>
            <button
              onClick={() => handleStartTimer(true)}
              disabled={active}
              className="flex items-center justify-center space-x-1.5 bg-zinc-50 border border-green-200 text-green-700 hover:bg-green-100 font-semibold py-2 rounded-lg text-xs transition disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Start Break</span>
            </button>
          </div>
            )}
        </div>
      ) : (
        <div className="text-center p-2.5 bg-zinc-50 rounded-lg border border-zinc-100">
          <span className="text-[11px] text-zinc-500 font-medium italic">
            Wait for host to configure and trigger session.
          </span>
        </div>
      )}
    </div>
  );
}
