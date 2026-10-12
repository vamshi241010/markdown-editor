import { Laptop } from "lucide-react";

export default function ParticipantList({
  participants,
  currentUserId,
  isHost,
  raisedHands,
  onApproveHand,
  onDenyHand,
  onChangeRole,
  onKick
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
          Participants ({participants.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
        {participants.map((p) => {
          const isMe = p.userId === currentUserId;
          const hasHandRaised = raisedHands.includes(p.userId);

          return (
            <div key={p.userId} className="flex flex-col space-y-1.5 p-2 bg-zinc-50 border border-zinc-100 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isMe ? "bg-indigo-600" : "bg-green-500"}`} />
                  <span className={`text-sm font-semibold truncate ${isMe ? "text-indigo-700" : "text-zinc-900"}`}>
                    {p.username} {isMe && "(You)"}
                  </span>
                  
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                    p.role === "host"
                      ? "bg-amber-100 text-amber-800"
                      : p.role === "speaker"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-zinc-200 text-zinc-600"
                  }`}>
                    {p.role}
                  </span>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  {p.onWhiteboard ? (
                    <div title="Viewing Whiteboard">
                      <Laptop className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono font-bold bg-zinc-200/65 px-1 rounded text-zinc-600">
                      p. {p.currentPage}
                    </span>
                  )}
                </div>
              </div>

              {hasHandRaised && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 p-1.5 rounded-md text-xs">
                  <div className="flex items-center space-x-1 font-semibold text-amber-700">
                    <span>🖐 Hand Raised</span>
                  </div>
                  {isHost && onApproveHand && onDenyHand && (
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => onApproveHand(p.userId)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-1.5 py-0.5 rounded text-[10px] uppercase"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onDenyHand(p.userId)}
                        className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase"
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isHost && !isMe && p.role !== "host" && (
                <div className="flex items-center space-x-1.5 pt-1.5 border-t border-zinc-200/50">
                  {p.role === "listener" ? (
                    <button
                      onClick={() => onChangeRole?.(p.userId, "speaker")}
                      className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase"
                    >
                      Make Speaker
                    </button>
                  ) : (
                    <button
                      onClick={() => onChangeRole?.(p.userId, "listener")}
                      className="text-[10px] font-bold text-zinc-600 hover:bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded uppercase"
                    >
                      Revoke Speaker
                    </button>
                  )}

                  <button
                    onClick={() => onKick?.(p.userId)}
                    className="text-[10px] font-bold text-red-500 hover:bg-red-50 border border-red-100 px-1.5 py-0.5 rounded ml-auto uppercase"
                  >
                    Kick
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
