import React, { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { ArrowLeft, Check, HelpCircle, Link, Share, Wifi, WifiOff, Laptop, Download, ChevronDown, Loader2, Sun, Moon } from "lucide-react";
import { api } from "../services/api.js";
import Editor from "../components/Editor.jsx";
import RemoteUsers from "../components/RemoteUsers.jsx";
import MarkdownHelpPanel from "../components/MarkdownHelpPanel.jsx";
import Markdown from "react-markdown";
import { useParams, useNavigate } from "react-router-dom";
// Browser-safe Base64 <-> Uint8Array utilities
// Base64 -> Uint8Array
function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function uint8ArrayToBase64(bytes) {
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}
export default function EditorPage({ user, theme, toggleTheme }) {
  const { docId } = useParams();  // Gets from URL
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [yDoc, setYDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ydocReady, setYdocReady] = useState(false);
// Add this ref at the top with other refs
const pendingUpdatesRef = useRef([]);
  // Status message
  const [statusMessage, setStatusMessage] = useState("Initializing...");
  const [isOnline, setIsOnline] = useState(true);

  // Meta controls
  const [title, setTitle] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Invite collabs fields
  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMsg, setShareMsg] = useState(null);

  // Peer collaborators list
  const [peers, setPeers] = useState([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Live Compiled Preview features
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [editorContent, setEditorContent] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [countdown, setCountdown] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const countdownTimerRef = useRef(null);
  const autoRenderTimerRef = useRef(null);

  // Document Export Features
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exportingType, setExportingType] = useState(null); // 'md' | 'pdf' | 'docx' | 'html' | null
  const [exportSuccessMessage, setExportSuccessMessage] = useState("");
  const [exportErrorMessage, setExportErrorMessage] = useState("");

  // Manual save states
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Connection and client settings
  const socketRef = useRef(null);
  const userColor = useRef("#4F46E5"); // Default fallback, updated during init
  const isJoinedRef = useRef(false);

  // Random avatar color array
  const PASTEL_COLORS = [
    "#E11D48", "#DB2777", "#C084FC", "#818CF8", "#3B82F6",
    "#06B6D4", "#059669", "#10B981", "#D97706", "#EA580C"
  ];

  // Detect internet connection status
  useEffect(() => {
  if (!yDoc) return;

  const ytext = yDoc.getText("markdown");

  const observer = () => {
    const text = ytext.toString();
    setEditorContent(text);
  };

  ytext.observe(observer);

  return () => {
    ytext.unobserve(observer);
  };
}, [yDoc]);
//   useEffect(() => {
//      console.log("Saving:", editorContent);
//       if (!yDoc) return;
//   const timer = setTimeout(async () => {
//     try {
//       await api.documents.update(docId, {
//         content: editorContent
//       });

//       console.log("Autosaved");
//     } catch (err) {
//       console.error("Autosave failed:", err);
//     }
//   }, 2000); // save 2 seconds after user stops typing

//   return () => clearTimeout(timer);
// }, [editorContent, docId,yDoc]);
// useEffect(() => {
//   console.log("editorContent changed");
// }, [editorContent]);
  useEffect(() => {
    const onlineHandler = () => {
      setIsOnline(true);
      reconnectWebSocket();
    };
    const offlineHandler = () => {
      setIsOnline(false);
      setStatusMessage("Offline. Local backups operating.");
    };

    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);

    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, [yDoc]);

  // 1. Initialise Document data from DB
//  useEffect(() => {
//   let localDoc;
//   console.log("LOAD DOC RUNNING");
//   const loadDoc = async () => {
//     setLoading(true);
//     setError(null);

//     try {
//       const fetched = await api.documents.get(docId);
//       setDoc(fetched);
//       setTitle(fetched.title);

//       userColor.current =
//         PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];

//       // Create YJS document
//      localDoc = new Y.Doc();

//       // Load content ONLY from MongoDB
//       const ytext = localDoc.getText("markdown");

// // if (fetched.content && ytext.length === 0) {
// //   ytext.insert(0, fetched.content);
// // }
// if (fetched.content && ytext.length === 0) {
//   // Insert without triggering the "update" observer broadcast
//   localDoc.transact(() => {
//     ytext.insert(0, fetched.content);
//   }, "local-seed"); // ← tag the origin as "local-seed"
// }
//       setYDoc(localDoc);
//       setEditorContent("");
//       setPreviewContent("");
//     } catch (err) {
//       setError(err.message || "Failed to load document workspace.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   loadDoc();

//   return () => {
//     disconnectWebSocket();
//     localDoc?.destroy();
//   };
// }, [docId]);

useEffect(() => {
  let localDoc;
  const seededRef = { current: false }; // track if we've seeded

  const loadDoc = async () => {
    setLoading(true);
    setError(null);

    try {
      const fetched = await api.documents.get(docId);
      setDoc(fetched);
      setTitle(fetched.title);
      userColor.current = PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];

      localDoc = new Y.Doc();
      setYDoc(localDoc);
      pendingUpdatesRef.current = [];
      setYdocReady(false); 
      setEditorContent(fetched.content || "");
      setPreviewContent(fetched.content || "");
    } catch (err) {
      setError(err.message || "Failed to load document workspace.");
    } finally {
      setLoading(false);
    }
  };

  loadDoc();

  return () => {
    disconnectWebSocket();
    localDoc?.destroy();
  };
}, [docId]);

  // 3. WebSocket Connection and Real-Time Setup
  const connectWebSocket = (currentYdoc) => {
    if (socketRef.current) return;

    setStatusMessage("Connecting to server...");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatusMessage("Synchronizing CRDT edits...");
      
      // Send join room packet
      const joinPacket = {
        type: "join",
        docId,
        userId: user.id,
        username: user.username,
        color: userColor.current
      };
      socket.send(JSON.stringify(joinPacket));
      isJoinedRef.current = true;
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        switch (msg.type) {
        case "sync-init": {
  setStatusMessage("Online (Sync Complete)");

  const serverStateBinary = base64ToUint8Array(msg.yState);
  Y.applyUpdate(currentYdoc, serverStateBinary, "remote");

  const syncedText = currentYdoc.getText("markdown").toString();
  setEditorContent(syncedText);
  setPreviewContent(syncedText);
  setYdocReady(true);
  if (pendingUpdatesRef.current.length > 0) {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      pendingUpdatesRef.current.forEach((pendingUpdate) => {
        socket.send(JSON.stringify({ type: "update", docId, update: pendingUpdate }));
      });
      pendingUpdatesRef.current = [];
    }
  }
  break;
}
          case "update": {
            // Apply delta updates from other users
            const updateBinary = base64ToUint8Array(msg.update);
            Y.applyUpdate(currentYdoc, updateBinary, "remote");
            break;
          }

          case "room-presence": {
            // Updated list of active peer collaborators
            setPeers(msg.users || []);
            break;
          }

          case "presence-update": {
            // Incremental cursor motion of a peer
            setPeers((prevPeers) => {
              const idx = prevPeers.findIndex(p => p.userId === msg.userId);
              const updated = {
                docId,
                userId: msg.userId,
                username: msg.username,
                color: msg.color,
                cursor: msg.cursor,
                lastActive: new Date().toISOString()
              };

              if (idx !== -1) {
                const list = [...prevPeers];
                list[idx] = updated;
                return list;
              } else {
                return [...prevPeers, updated];
              }
            });
            break;
          }

          case "error": {
            console.error("Server alert message:", msg.message);
            break;
          }
        }
      } catch (err) {
        console.error("Error reading socket event:", err);
      }
    };
socket.onclose = () => {
  socketRef.current = null;
  isJoinedRef.current = false;
  setStatusMessage("Reconnecting...");
  setTimeout(() => {
    if (navigator.onLine && currentYdoc) {
      connectWebSocket(currentYdoc); // ← was yDoc, now currentYdoc
    }
  }, 3000);
};

    socket.onerror = (err) => {
      console.error("WebSocket transport error:", err);
    };
  };

  const disconnectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    isJoinedRef.current = false;
  };

  const reconnectWebSocket = () => {
    disconnectWebSocket();
    if (yDoc) {
      connectWebSocket(yDoc);
    }
  };

  // Launch ws once yDoc context is initialized
  
useEffect(() => {
  if (yDoc) {
    connectWebSocket(yDoc);

    const updateHandler = (update, origin) => {
      if (origin === "remote") return;

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        // Flush pending queue first
        if (pendingUpdatesRef.current.length > 0) {
          pendingUpdatesRef.current.forEach((pendingUpdate) => {
            socketRef.current.send(JSON.stringify({ type: "update", docId, update: pendingUpdate }));
          });
          pendingUpdatesRef.current = [];
        }
        const deltaBase64 = uint8ArrayToBase64(update);
        socketRef.current.send(JSON.stringify({ type: "update", docId, update: deltaBase64 }));
      } else {
        // Socket not ready — queue the update, cap at 200
        const deltaBase64 = uint8ArrayToBase64(update);
        if (pendingUpdatesRef.current.length >= 200) {
          pendingUpdatesRef.current.shift(); // drop oldest
        }
        pendingUpdatesRef.current.push(deltaBase64);
      }
    };

    yDoc.on("update", updateHandler);

    return () => {
      yDoc.off("update", updateHandler);
      disconnectWebSocket();
    };
  }
}, [yDoc, docId]);
  // Keep alive ping interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // 4. Cursor position update dispatch to WebSocket
  const handleCursorChange = (cursor) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && isJoinedRef.current) {
      socketRef.current.send(JSON.stringify({
        type: "presence",
        docId,
        cursor
      }));
    }
  };

  // 4a. Live Compiled Preview logic & triggers
  const triggerImmediateRender = () => {
    // Show momentary compiling state for premium feedback
    setIsPreparing(true);
    setTimeout(() => {
      if (editorContent) {
        setPreviewContent(editorContent);
      } else if (yDoc) {
        const liveText = yDoc.getText("markdown").toString();
        setPreviewContent(liveText);
        setEditorContent(liveText);
      } else {
        setPreviewContent("");
      }
      setIsPreparing(false);
    }, 150);
  };

  const handleExport = async (format) => {
    setExportingType(format);
    setExportErrorMessage("");
    setExportSuccessMessage("");
    setExportDropdownOpen(false);

    try {
      // 1. Force save latest content to backend first
     const latestText =
  yDoc?.getText("markdown").toString() || "";

await api.documents.update(docId, {
  content: latestText
});
if (doc) {
  setDoc({
    ...doc,
    content: latestText
  });
}
      // 2. Fetch the file blob
      const token = localStorage.getItem("crm_token");
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/documents/${docId}/export/${format}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Server returned error status ${response.status}`);
      }

      const blob = await response.blob();
      
      // 3. Trigger download in browser
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      
      // Compute safe filename matching the document title
      const sanitizedTitle = (doc?.title || "Document").trim().replace(/[^a-zA-Z0-9_\-\s]/g, "") || "Document";
      link.download = `${sanitizedTitle}.${format}`;
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      // Show toast success
      setExportSuccessMessage(`Document successfully exported and downloaded as .${format.toUpperCase()}!`);
      setTimeout(() => setExportSuccessMessage(""), 5000);
    } catch (err) {
      console.error("Export error:", err);
      setExportErrorMessage(`Export failed: ${err.message}`);
      setTimeout(() => setExportErrorMessage(""), 6000);
    } finally {
      setExportingType(null);
    }
  };

  // 5. Title Save operation (saves title to DB and increments doc update)
  const saveTitle = async () => {
    if (!title.trim() || title.trim() === doc?.title) return;
    setTitleSaving(true);
    
    try {
      await api.documents.update(docId, { title: title.trim() });
      if (doc) setDoc({ ...doc, title: title.trim() });
    } catch (err) {
      alert("Error saving title: " + err.message);
    } finally {
      setTitleSaving(false);
    }
  };

  // 5a. Manual save operation
  const handleManualSave = async () => {
    setIsSaving(true);
    setSaveSuccessMessage("");
    setSaveErrorMessage("");
    try {
      let textToSave = editorContent;
      if (!textToSave && yDoc) {
        textToSave = yDoc.getText("markdown").toString();
      }

      await api.documents.update(docId, { content: textToSave });
      if (doc) setDoc({ ...doc, content: textToSave });

      setSaveSuccessMessage("Document saved successfully!");
      setTimeout(() => setSaveSuccessMessage(""), 4000);
    } catch (err) {
      setSaveErrorMessage(err.message || "Could not save document changes.");
      setTimeout(() => setSaveErrorMessage(""), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // 6. Copy sharing link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Share modal submission
  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (!shareEmail.trim()) return;

    setShareLoading(true);
    setShareMsg(null);

    try {
      await api.documents.share(docId, shareEmail.trim());
      setShareMsg(`Successfully added collaborator ${shareEmail}`);
      setShareEmail("");
    } catch (err) {
      setShareMsg(`Error: ${err.message}`);
    } finally {
      setShareLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center space-y-4" id="editor-loading">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <h2 className="text-sm font-semibold text-zinc-600 font-sans">Booting collaborative whiteboard...</h2>
      </div>
    );
  }

  if (error || !doc || !yDoc) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4 space-y-4" id="editor-error">
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-center text-xs font-semibold max-w-sm shadow-md">
          {error || "Document load error."}
        </div>
        <button
          onClick={()=>navigate("/")}
          className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg text-xs shadow-sm hover:bg-indigo-700 transition"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${theme === "dark" ? "bg-zinc-950 text-zinc-100" : "bg-white text-zinc-900"}`} id="editor-workspace">
      {/* Workspace Menu Bar */}
      <header className={`border-b flex items-center justify-between p-3 shrink-0 select-none ${theme === "dark" ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-zinc-50"}`}>
        {/* Left Elements: Return Back & Title inputs */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={()=>navigate("/")}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                : "border-zinc-200 bg-white text-zinc-650 hover:text-zinc-950 hover:bg-zinc-100"
            }`}
            title="Go to dashboard"
            id="back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2 max-w-xs md:max-w-md w-full">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === "Enter" && saveTitle()}
              className={`font-semibold text-sm border border-transparent rounded-md px-2 py-1 bg-transparent focus:outline-hidden transition-all truncate font-sans w-full ${
                theme === "dark"
                  ? "text-zinc-100 hover:border-zinc-800 focus:bg-zinc-950 focus:border-indigo-500"
                  : "text-zinc-900 hover:border-zinc-200 focus:bg-white focus:border-indigo-500"
              }`}
              title="Click to rename document"
              id="title-rename-input"
            />
            {titleSaving && (
              <span className="text-[10px] text-zinc-400 font-medium whitespace-nowrap animate-pulse font-sans">
                Saving...
              </span>
            )}
          </div>
        </div>

        {/* Right Elements: Online Status indicator, Peer Avatars, Shares, Help ? */}
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {/* Status badge */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-sans font-medium select-none ${
              isOnline && socketRef.current?.readyState === WebSocket.OPEN
                ? theme === "dark" ? "bg-emerald-950/45 border-emerald-900/60 text-emerald-400" : "bg-emerald-50 border-emerald-100 text-emerald-700"
                : theme === "dark" ? "bg-amber-950/45 border-amber-900/60 text-amber-400" : "bg-amber-50 border-amber-100 text-amber-700"
            }`}
            title={statusMessage}
            id="network-status-badge"
          >
            {isOnline && socketRef.current?.readyState === WebSocket.OPEN ? (
              <Wifi className="w-3.5 h-3.5 animate-pulse" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden lg:inline">
              {isOnline && socketRef.current?.readyState === WebSocket.OPEN ? "Synced Online" : "Local Backup"}
            </span>
          </div>

          {/* Active Collaborators list */}
          <RemoteUsers users={peers} currentUserId={user.id} />

          {/* Share button */}
          <button
            onClick={() => setShowShareModal(true)}
            className={`p-1.5 border rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-900 text-zinc-350 hover:bg-zinc-800 hover:text-zinc-100"
                : "border-zinc-200 bg-white text-zinc-650 hover:bg-zinc-100"
            }`}
            title="Invite collaborators"
            id="open-share-btn"
          >
            <Share className="w-4 h-4 text-zinc-500" />
            <span className="hidden md:inline">Share</span>
          </button>

          {/* Export dropdown menu */}
          <div className="relative" id="export-dropdown-container">
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className={`p-1.5 border rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer select-none ${
                theme === "dark"
                  ? "border-zinc-800 bg-zinc-900 text-zinc-350 hover:bg-zinc-800 hover:text-zinc-100"
                  : "border-zinc-200 bg-white text-zinc-650 hover:bg-zinc-100"
              }`}
              title="Export document formats"
              id="export-dropdown-btn"
            >
              <Download className="w-4 h-4 text-zinc-500" />
              <span className="hidden md:inline">Export</span>
              <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${exportDropdownOpen ? 'transform rotate-180' : ''}`} />
            </button>

            {exportDropdownOpen && (
              <>
                {/* Click outside backdrop close layer */}
                <div 
                  className="fixed inset-0 z-25 cursor-default" 
                  onClick={() => setExportDropdownOpen(false)}
                />
                <div className={`absolute right-0 mt-1.5 w-44 border rounded-lg shadow-xl py-1 z-30 font-sans text-xs animate-scale-up ${
                  theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-250"
                }`} id="export-dropdown-menu">
                  <div className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border-b select-none ${
                    theme === "dark" ? "text-zinc-500 border-zinc-800" : "text-zinc-400 border-zinc-100"
                  }`}>
                    Export Formats
                  </div>
                  <button
                    onClick={() => handleExport("md")}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                      theme === "dark" ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <span className={`font-mono px-1 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      theme === "dark" ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-650"
                    }`}>MD</span>
                    <span>Markdown (.md)</span>
                  </button>
                  <button
                    onClick={() => handleExport("pdf")}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                      theme === "dark" ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <span className={`font-mono px-1 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      theme === "dark" ? "bg-indigo-950 text-indigo-400" : "bg-indigo-50 text-indigo-600"
                    }`}>PDF</span>
                    <span>PDF Document (.pdf)</span>
                  </button>
                  <button
                    onClick={() => handleExport("docx")}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                      theme === "dark" ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <span className={`font-mono px-1 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      theme === "dark" ? "bg-blue-950 text-blue-400" : "bg-blue-50 text-blue-600"
                    }`}>DOCX</span>
                    <span>MS Word (.docx)</span>
                  </button>
                  <button
                    onClick={() => handleExport("html")}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                      theme === "dark" ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <span className={`font-mono px-1 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      theme === "dark" ? "bg-emerald-950 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                    }`}>HTML</span>
                    <span>HTML Webpage (.html)</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Clipboard Copy link */}
          <button
            onClick={handleCopyLink}
            className={`p-1.5 border rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-900 text-zinc-350 hover:bg-zinc-800 hover:text-zinc-100"
                : "border-zinc-200 bg-white text-zinc-650 hover:bg-zinc-100"
            }`}
            title="Copy document workspace link"
            id="copy-link-btn"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Link className="w-4 h-4 text-zinc-500" />}
            <span className="hidden md:inline">{copiedLink ? "Copied" : "Copy Link"}</span>
          </button>

          {/* Toggle Live HTML Preview panel */}
          <button
            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              isPreviewOpen
                ? theme === "dark" ? "bg-indigo-950/60 border-indigo-900 text-indigo-300" : "bg-indigo-50 border-indigo-150 text-indigo-750"
                : theme === "dark" ? "border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800" : "border-zinc-200 bg-white text-zinc-650 hover:bg-zinc-100"
            }`}
            title="Toggle Live HTML Preview"
            id="toggle-preview-btn"
          >
            <Laptop className="w-4 h-4 text-zinc-500" />
            <span className="hidden md:inline">Live Preview</span>
          </button>

          {/* Help button */}
          <button
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              isHelpOpen
                ? theme === "dark" ? "bg-indigo-950/60 border-indigo-900 text-indigo-300" : "bg-indigo-50 border-indigo-150 text-indigo-700"
                : theme === "dark" ? "border-zinc-800 bg-zinc-900 text-zinc-450 hover:bg-zinc-800 hover:text-zinc-105" : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
            }`}
            title="Toggle Markdown Guide"
            id="toggle-help-btn"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden md:inline">Syntax Guide</span>
          </button>

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-900 text-amber-400 hover:bg-zinc-800"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-indigo-600"
            }`}
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            id="theme-toggle-btn"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
            )}
            <span className="hidden md:inline">Theme</span>
          </button>
        </div>
      </header>

     {/* Editor (Left/Middle Pane) */}
{/* Editor Main Content split */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">

        {/* Editor (Left/Middle Pane) */}
        <div className="flex-1 h-full overflow-hidden min-w-0 flex flex-col">
          <div className="flex-1 min-h-0">
            {ydocReady && yDoc ? (
              <Editor
                yDoc={yDoc}
                users={peers}
                currentUserId={user.id}
                onCursorChange={handleCursorChange}
                onContentChange={(text) => setEditorContent(text)}
                onSave={handleManualSave}
                readOnly={false}
                theme={theme === "dark" ? "vs-dark" : "vs"}
              />
            ) : (
              <div className={`h-full flex items-center justify-center text-xs font-sans font-medium ${
                theme === "dark" ? "text-zinc-500" : "text-zinc-400"
              }`}>
                Connecting to server...
              </div>
            )}
          </div>
        </div>

        {/* Live MD HTML Compiled Preview (Right Pane) */}
        {isPreviewOpen && (
          <div className={`w-1/2 h-full flex flex-col border-l overflow-hidden shrink-0 ${
            theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-200"
          }`} id="live-compilation-preview">
            <div className={`p-3 border-b flex items-center justify-between shrink-0 font-sans select-none ${
              theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-250" : "bg-zinc-100 border-zinc-200 text-zinc-800"
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold tracking-tight flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5" />
                  Live Compiled Preview
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-sans ${
                  theme === "dark" ? "bg-zinc-800 text-zinc-400" : "bg-zinc-200 text-zinc-650"
                }`}>
                  Manual Compilation
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                {isPreparing ? (
                  <div className={`flex items-center gap-1.5 text-[11px] font-bold animate-pulse px-2 py-0.5 rounded border ${
                    theme === "dark" ? "bg-amber-950/40 border-amber-900/60 text-amber-400" : "bg-amber-50 border-amber-100 text-amber-700"
                  }`}>
                    <span className="inline-block w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                    <span>Rendering...</span>
                  </div>
                ) : (
                  <div className={`flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded border ${
                    theme === "dark" ? "bg-emerald-950/40 border-emerald-900/65 text-emerald-400" : "bg-emerald-50 border-emerald-100 text-emerald-700"
                  }`}>
                    <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span>Ready</span>
                  </div>
                )}
                <button
                  onClick={triggerImmediateRender}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                  title="Compile & Render Preview Now"
                  id="preview-force-run-btn"
                >
                  <span className="font-mono">Run ▶</span>
                </button>
              </div>
            </div>
            <div className={`flex-1 overflow-y-auto p-6 prose max-w-none prose-zinc ${
              theme === "dark" ? "bg-zinc-900" : "bg-white"
            }`} id="preview-render-pane">
              {previewContent ? (
                <div className="markdown-body">
                  <Markdown>{previewContent}</Markdown>
                </div>
              ) : (
                <div className={`h-full flex flex-col items-center justify-center text-xs py-12 ${
                  theme === "dark" ? "text-zinc-500" : "text-zinc-400"
                }`}>
                  <p className="font-sans font-semibold">Empty document.</p>
                  <p className="font-sans text-[11px] mt-1 text-center">
                    Write Markdown in the left panel, then click Run ▶ to preview.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sidebar Help drawer */}
        {isHelpOpen && (
          <div className="h-full relative shadow-lg flex-none select-none z-10 animate-slide-left">
            <MarkdownHelpPanel onClose={() => setIsHelpOpen(false)} />
          </div>
        )}

      </div> {/* ← closes "Editor Main Content split" */}
      {/* Share collaborator modal overlay */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="workspace-share-modal">
          <div className={`w-full max-w-sm border rounded-xl shadow-2xl p-6 relative ${
            theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-250"
          }`}>
            <h3 className={`text-sm font-bold font-sans tracking-tight mb-1 ${
              theme === "dark" ? "text-zinc-100" : "text-zinc-950"
            }`}>
              Invite Peer Collaborator
            </h3>
            <p className={`text-xs font-sans mb-4 ${
              theme === "dark" ? "text-zinc-450 text-zinc-400" : "text-zinc-500"
            }`}>
              Grant immediate editing permissions to collaborator for: <strong className={theme === "dark" ? "text-zinc-200" : "text-zinc-700"}>{doc.title}</strong>
            </p>

            {shareMsg && (
              <div className={`p-2.5 rounded-lg text-xs font-semibold mb-4 leading-normal ${
                shareMsg.startsWith("Error") 
                  ? theme === "dark" ? "bg-red-955/40 border border-red-900/50 text-red-400" : "bg-red-50 border border-red-100 text-red-600"
                  : theme === "dark" ? "bg-emerald-955/40 border border-emerald-900/50 text-emerald-400" : "bg-emerald-50 border border-emerald-100 text-emerald-700"
              }`}>
                {shareMsg}
              </div>
            )}

            <form onSubmit={handleShareSubmit} className="space-y-4">
              <input
                type="email"
                placeholder="collaborator@example.com"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-xs font-sans font-medium focus:outline-hidden focus:border-indigo-500 ${
                  theme === "dark" ? "bg-zinc-850 border-zinc-750 text-zinc-100 placeholder-zinc-500" : "bg-white border-zinc-250 text-zinc-900"
                }`}
                required
                id="share-email-input"
              />
              <div className="flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowShareModal(false);
                    setShareMsg(null);
                  }}
                  className={`px-3 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer select-none font-sans ${
                    theme === "dark" ? "border-zinc-800 text-zinc-400 hover:bg-zinc-800" : "border-zinc-250 text-zinc-650 hover:bg-zinc-50"
                  }`}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={shareLoading}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs font-semibold cursor-pointer flex items-center gap-1"
                  id="grant-share-btn"
                >
                  <Share className="w-3.5 h-3.5" />
                  {shareLoading ? "Adding..." : "Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Translucent full-page Loading overlay for exports */}
      {exportingType && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[100] flex flex-col items-center justify-center animate-fade-in" id="export-loading-overlay">
          <div className="bg-white border border-zinc-200/80 shadow-2xl rounded-2xl p-6 flex flex-col items-center gap-4 max-w-xs text-center mx-4 animate-scale-up">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-zinc-100 border-t-indigo-600 animate-spin" />
              <div className="absolute font-sans font-extrabold text-xs text-indigo-600 uppercase tracking-tighter">
                {exportingType}
              </div>
            </div>
            <div>
              <h4 className="font-sans font-bold text-zinc-900 text-sm">Compiling Document</h4>
              <p className="font-sans text-[11px] text-zinc-500 mt-1.5 leading-relaxed">
                Assembling your markdown structure, styles, and headers into a professional <span className="font-bold text-indigo-650 uppercase">.{exportingType}</span> format.
              </p>
            </div>
            <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden mt-1 relative">
              <div className="absolute top-0 bottom-0 left-0 bg-indigo-600 rounded-full animate-pulse w-full" />
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast notifications for Export status */}
      {(exportSuccessMessage || exportErrorMessage || exportingType || saveSuccessMessage || saveErrorMessage || isSaving) && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" id="export-toasts-portal">
          {isSaving && (
            <div className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 text-white shadow-xl px-4 py-3 rounded-xl text-xs font-semibold animate-slide-left">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
              <span>Saving changes explicitly...</span>
            </div>
          )}
          {saveSuccessMessage && (
            <div className="flex items-center gap-2.5 bg-emerald-600 border border-emerald-500 text-white shadow-xl px-4 py-3 rounded-xl text-xs font-semibold animate-slide-left">
              <Check className="w-4 h-4 shrink-0 text-emerald-100" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}
          {saveErrorMessage && (
            <div className="flex items-center gap-2.5 bg-rose-600 border border-rose-500 text-white shadow-xl px-4 py-3 rounded-xl text-xs font-semibold animate-slide-left">
              <span className="font-bold shrink-0 text-rose-100 text-sm">✕</span>
              <span>{saveErrorMessage}</span>
            </div>
          )}
          {exportingType && (
            <div className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 text-white shadow-xl px-4 py-3 rounded-xl text-xs font-semibold">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
              <span>Generating and compiling your .{exportingType.toUpperCase()} file...</span>
            </div>
          )}
          {exportSuccessMessage && (
            <div className="flex items-center gap-2.5 bg-emerald-600 border border-emerald-500 text-white shadow-xl px-4 py-3 rounded-xl text-xs font-semibold animate-slide-left">
              <Check className="w-4 h-4 shrink-0 text-emerald-100" />
              <span>{exportSuccessMessage}</span>
            </div>
          )}
          {exportErrorMessage && (
            <div className="flex items-center gap-2.5 bg-rose-600 border border-rose-500 text-white shadow-xl px-4 py-3 rounded-xl text-xs font-semibold animate-slide-left">
              <span className="font-bold shrink-0 text-rose-100 text-sm">✕</span>
              <span>{exportErrorMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
