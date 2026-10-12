import React from "react";

export default function RemoteUsers({ users, currentUserId }) {
  // Sort users so that current user is first, list remaining users neatly
  const sortedUsers = [...users].sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <div className="flex items-center gap-1.5" id="remote-users-container">
      <div className="flex -space-x-2 overflow-hidden mr-2">
        {sortedUsers.map((user) => {
          const initials = user.username
            ? user.username.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
            : "U";

          const isSelf = user.userId === currentUserId;

          return (
            <div
              key={user.userId}
              className="relative group cursor-help inline-block shrink-0"
              style={{ zIndex: isSelf ? 20 : 10 }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-sans text-xs font-semibold text-white border-2 select-none shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
                style={{
                  backgroundColor: user.color,
                  borderColor: user.color,
                }}
              >
                {initials}
              </div>

              {/* Tooltip */}
              <div className="absolute right-1/2 translate-x-1/2 top-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-zinc-900 border border-zinc-800 text-white rounded-md p-1.5 px-2.5 text-[11px] font-sans font-medium flex-col flex leading-none z-50 shadow-md">
                <span>
                  {user.username} {isSelf && <span className="text-zinc-400 font-normal">(you)</span>}
                </span>
                <span className="text-[9px] text-zinc-400 mt-1">
                  {user.cursor ? `Editing Line ${user.cursor.line}` : "Idle"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      <span className="text-xs text-zinc-500 font-sans hidden md:inline select-none">
        {users.length} {users.length === 1 ? "editor" : "editors"} active
      </span>
    </div>
  );
}
