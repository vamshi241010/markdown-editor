import React, { useState, useEffect, useRef } from "react";
import { Send, Hand, Trash2 } from "lucide-react";

export default function ChatPanel({
  messages,
  onSendMessage,
  onSendReaction,
  onRaiseHand,
  userId,
  role,
  raisedHands,
  onClearChat
}) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef(null);

  const hasHandRaised = raisedHands.includes(userId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const quickReactions = ["👍", "😕", "💡", "✅"];

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
          Chat & Discussions
        </h3>
        {role === "host" && onClearChat && (
          <button
            onClick={onClearChat}
            className="flex items-center space-x-1 px-2 py-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition shadow-sm active:scale-95"
            title="Clear Chat History for everyone"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, index) => {
          const isMe = m.userId === userId;
          const isSystem = m.type === "system";

          if (isSystem) {
            return (
              <div key={m._id || index} className="flex items-center justify-center">
                <div className="px-3 py-1 bg-zinc-100 rounded-full text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center max-w-xs shadow-sm border border-zinc-200/50">
                  {m.text}
                </div>
              </div>
            );
          }

          return (
            <div
              key={m._id || index}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              <span className="text-[10px] font-bold text-zinc-400 mb-1 uppercase">
                {m.username} • {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <p
                className={`text-sm p-3 rounded-lg leading-relaxed ${
                  isMe
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-zinc-50 border border-zinc-100 text-zinc-800"
                }`}
              >
                {m.text}
              </p>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-zinc-100 space-y-3 shrink-0">
        <div className="flex items-center space-x-1.5 justify-between">
          <div className="flex space-x-1.5 flex-1">
            {quickReactions.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSendReaction(emoji)}
                className="flex-1 text-center py-1.5 bg-zinc-50 border border-zinc-200 rounded-md text-lg hover:bg-zinc-100 transition shadow-sm active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>

          {role === "listener" && (
            <button
              onClick={onRaiseHand}
              disabled={hasHandRaised}
              className={`px-3 py-1.5 border rounded-md text-sm font-semibold flex items-center space-x-1 transition shadow-sm ${
                hasHandRaised
                  ? "bg-amber-50 border-amber-200 text-amber-600 cursor-not-allowed"
                  : "border-zinc-200 hover:bg-zinc-50 text-zinc-700 hover:text-indigo-600 hover:border-indigo-100 active:scale-95"
              }`}
              title="Raise Hand"
            >
              <Hand className="w-4 h-4" />
              <span>{hasHandRaised ? "Raised" : "Raise"}</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            placeholder="Type your message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="submit"
            className="absolute right-3 top-2.5 text-indigo-600 hover:text-indigo-800 transition active:scale-90"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
