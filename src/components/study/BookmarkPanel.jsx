import React, { useState } from "react";
import { Bookmark, Plus } from "lucide-react";

export default function BookmarkPanel({ bookmarks, currentPage, onAddBookmark }) {
  const [noteText, setNoteText] = useState("");

  const handleAdd = (e) => {
    e.preventDefault();
    onAddBookmark(currentPage, noteText.trim());
    setNoteText("");
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm flex flex-col h-full overflow-hidden">
      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 pb-3 border-b border-zinc-100 shrink-0">
        Bookmarks & Notes (Page {currentPage})
      </h3>

      <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
        {bookmarks.length === 0 ? (
          <div className="text-center py-6 text-zinc-400 text-xs italic">
            No bookmarks added yet for this PDF.
          </div>
        ) : (
          bookmarks.map((b, i) => (
            <div key={b._id || i} className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded flex items-center space-x-1 shrink-0">
                  <Bookmark className="w-3 h-3 fill-indigo-600" />
                  <span>Page {b.pageNumber}</span>
                </span>
                <span className="text-[9px] text-zinc-400 font-medium">
                  {new Date(b.createdAt).toLocaleDateString()}
                </span>
              </div>
              {b.note && <p className="text-xs text-zinc-700 leading-snug">{b.note}</p>}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleAdd} className="pt-3 border-t border-zinc-100 space-y-2 shrink-0">
        <textarea
          rows={2}
          placeholder={`Add a quick study note for Page ${currentPage}...`}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          className="w-full px-3 py-2 border border-zinc-200 bg-zinc-50 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
        />
        <button
          type="submit"
          className="w-full flex items-center justify-center space-x-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 rounded-lg text-xs transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Note to Page {currentPage}</span>
        </button>
      </form>
    </div>
  );
}
