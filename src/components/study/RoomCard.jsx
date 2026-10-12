import { Trash2, LogIn, Star, ExternalLink } from "lucide-react";

export default function RoomCard({ room, userId, onJoin, onEnter, onDelete, isJoined }) {
  const isHost = room.hostId === userId;

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm hover:border-indigo-500 hover:shadow-md transition duration-200 flex flex-col justify-between space-y-4">
      {/* Top tag & room code */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider bg-zinc-100 text-zinc-600 px-2.5 py-0.5 rounded">
            {room.subject}
          </span>
          <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded">
            {room.code}
          </span>
        </div>

        <h3 className="font-bold text-lg text-zinc-900 truncate tracking-tight pt-1">
          {room.name}
        </h3>
      </div>

      {/* Tag badges list */}
      {room.tags && room.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {room.tags.map((tag, i) => (
            <span
              key={i}
              className="text-[10px] font-semibold text-zinc-500 bg-zinc-50 border border-zinc-100 px-2 py-0.5 rounded"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Bottom controls */}
      <div className="pt-3 border-t border-zinc-100/80 flex items-center justify-between">
        <div className="flex items-center space-x-1">
          {isHost ? (
            <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded flex items-center space-x-1">
              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
              <span>Host</span>
            </span>
          ) : (
            <span className="text-[10px] uppercase font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
              {room.isPublic ? "Public" : "Private"}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {isHost && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(room._id);
              }}
              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Delete Study Space"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {isJoined ? (
            <button
              onClick={() => onEnter(room._id)}
              className="flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 px-3.5 rounded-lg text-xs transition shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Enter</span>
            </button>
          ) : (
            onJoin && (
              <button
                onClick={() => onJoin(room.code)}
                className="flex items-center space-x-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 font-semibold py-1.5 px-3.5 rounded-lg text-xs transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Join</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
