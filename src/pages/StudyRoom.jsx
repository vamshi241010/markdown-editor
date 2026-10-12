import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { socketService } from "../services/socket";
import PDFViewer from "../components/study/PDFViewer";
import Whiteboard from "../components/study/Whiteboard";
import ChatPanel from "../components/study/ChatPanel";
import ParticipantList from "../components/study/ParticipantList";
import BookmarkPanel from "../components/study/BookmarkPanel";
import PomodoroTimer from "../components/study/PomodoroTimer";
import { ArrowLeft, Download, LogOut, MessageSquare, Users, Bookmark, AlertCircle, ChevronLeft, ChevronRight, MoreVertical, X } from "lucide-react";

export default function StudyRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [participants, setParticipants] = useState([]);
  const [raisedHands, setRaisedHands] = useState([]);
  const [currentRole, setCurrentRole] = useState("listener");

  const [viewMode, setViewMode] = useState("pdf");

  const [presenterMode, setPresenterMode] = useState(false);
  const [freeScroll, setFreeScroll] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const [pomodoro, setPomodoro] = useState({
    active: false,
    timeLeft: 1500,
    duration: 1500,
    isBreak: false
  });

  const [messages, setMessages] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [whiteboardState, setWhiteboardState] = useState("");
  const [whiteboardPanOffset, setWhiteboardPanOffset] = useState({ x: 0, y: 0 });
  const [whiteboardZoom, setWhiteboardZoom] = useState(1.0);
  const [rightTab, setRightTab] = useState("chat");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [showMobileOptions, setShowMobileOptions] = useState(false);

  const userStr = localStorage.getItem("crm_user");
  const user = userStr ? JSON.parse(userStr) : null;
  const currentUserId = user?.id || user?.userId || "";
  const username = user?.username || "Anonymous";

  useEffect(() => {
    if (!roomId) return;
    loadRoomData();

    return () => {
      socketService.disconnect();
    };
  }, [roomId]);

  const loadRoomData = async () => {
    setLoading(true);
    setError("");
    try {
      if (!roomId) return;
      const roomData = await api.rooms.get(roomId);
      setRoom(roomData);

      const initialRole = roomData.hostId === currentUserId ? "host" : "listener";
      setCurrentRole(initialRole);

      socketService.connect(roomId, currentUserId, username, initialRole);

      const [msgs, bmks] = await Promise.all([
        api.rooms.getMessages(roomId),
        api.rooms.getBookmarks(roomId)
      ]);
      setMessages(msgs);
      setBookmarks(bmks);

      setPdfUrl(`/api/pdf/${roomId}?t=${Date.now()}`);
    } catch (err) {
      setError(err.message || "Failed to load study room details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = socketService.subscribe((type, payload) => {
      switch (type) {
        case "study-join":
          if (payload.presenceList) setParticipants(payload.presenceList);
          if (payload.roomConfig) {
            setPresenterMode(payload.roomConfig.presenterMode);
            setFreeScroll(payload.roomConfig.freeScroll);
            if (payload.roomConfig.presenterMode) {
              setCurrentPage(payload.roomConfig.currentPage);
            }
            setViewMode(payload.roomConfig.onWhiteboard ? "whiteboard" : "pdf");
            setPomodoro(payload.roomConfig.pomodoro);
            if (payload.roomConfig.whiteboardState) {
              setWhiteboardState(payload.roomConfig.whiteboardState);
            }
            if (payload.roomConfig.whiteboardPanOffset) {
              setWhiteboardPanOffset(payload.roomConfig.whiteboardPanOffset);
            }
            if (payload.roomConfig.whiteboardZoom) {
              setWhiteboardZoom(payload.roomConfig.whiteboardZoom);
            }
          }
          break;

        case "study-leave":
          if (payload.presenceList) setParticipants(payload.presenceList);
          if (payload.systemMessage) setMessages((prev) => [...prev, payload.systemMessage]);
          break;

        case "presence-update":
          if (payload.presenceList) setParticipants(payload.presenceList);
          break;

        case "whiteboard-sync":
          if (payload.userId !== currentUserId && payload.docState) {
            setWhiteboardState(payload.docState);
          }
          break;
        case "whiteboard-view-sync":
          if (payload.userId !== currentUserId) {
            if (payload.panOffset) {
              setWhiteboardPanOffset(payload.panOffset);
            }
            if (payload.zoom !== undefined) {
              setWhiteboardZoom(payload.zoom);
            }
          }
          break;
        case "chat-message":
          setMessages((prev) => [...prev, payload]);
          break;

        case "chat-clear":
          setMessages([]);
          break;

        case "page-change":
          if (presenterMode || !freeScroll) {
            setCurrentPage(payload.page);
          }
          if (payload.presenceList) setParticipants(payload.presenceList);
          break;

        case "presenter-mode":
          setPresenterMode(payload.presenterMode);
          if (payload.presenterMode) {
            setCurrentPage(payload.currentPage);
          }
          break;

        case "free-scroll":
          setFreeScroll(payload.freeScroll);
          break;

        case "role-change":
          if (payload.presenceList) setParticipants(payload.presenceList);
          if (payload.targetUserId === currentUserId) {
            setCurrentRole(payload.newRole);
            alert(`Your role has been updated to: ${payload.newRole}`);
          }
          break;

        case "kicked":
          alert("You have been kicked from this study room by the host.");
          navigate("/study");
          break;

        case "room-deleted":
          alert("This study room has been ended by the host.");
          navigate("/study");
          break;

        case "raise-hand":
          if (payload.raisedHands) setRaisedHands(payload.raisedHands);
          break;

        case "hand-approved":
          if (payload.presenceList) setParticipants(payload.presenceList);
          if (payload.raisedHands) setRaisedHands(payload.raisedHands);
          if (payload.targetUserId === currentUserId) {
            setCurrentRole("speaker");
            alert("Your hand raise was approved! You are now a Speaker.");
          }
          break;

        case "hand-denied":
          if (payload.raisedHands) setRaisedHands(payload.raisedHands);
          if (payload.targetUserId === currentUserId) {
            alert("Your request to speak was declined by the host.");
          }
          break;

        case "reaction":
          triggerReactionDisplay(payload.username, payload.reaction);
          break;

        case "pomodoro-start":
          setPomodoro({
            active: true,
            duration: payload.duration,
            timeLeft: payload.timeLeft,
            isBreak: payload.isBreak
          });
          break;

        case "pomodoro-sync":
          setPomodoro({
            active: payload.active,
            duration: payload.duration,
            timeLeft: payload.timeLeft,
            isBreak: payload.isBreak
          });
          break;

        case "pomodoro-end":
          setPomodoro((prev) => ({ ...prev, active: false, timeLeft: 0 }));
          try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const osc = context.createOscillator();
            osc.connect(context.destination);
            osc.start();
            osc.stop(context.currentTime + 0.5);
          } catch (e) {}
          alert(payload.isBreak ? "Break is over! Time to focus." : "Focus session completed! Take a quick break.");
          break;
            case "pomodoro-stop":
          setPomodoro((prev) => ({ ...prev, active: false, timeLeft: 0 }));
          break;
            case "pdf-uploaded":
          setPdfUrl(`/api/pdf/${roomId}?t=${Date.now()}`);
          setCurrentPage(1);
          break;
      }
    });

    return () => unsubscribe();
  }, [presenterMode, freeScroll, currentUserId, navigate]);

  const handlePDFUploadSuccess = () => {
    setPdfUrl(`/api/pdf/${roomId}?t=${Date.now()}`);
    handlePageChange(1);
    socketService.send("pdf-uploaded", {});

  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    socketService.send("page-change", { page });
  };

  const handleTogglePresenterMode = () => {
    const nextVal = !presenterMode;
    setPresenterMode(nextVal);
    socketService.send("presenter-mode", { presenterMode: nextVal });
  };

  const handleToggleFreeScroll = () => {
    const nextVal = !freeScroll;
    setFreeScroll(nextVal);
    socketService.send("free-scroll", { freeScroll: nextVal });
  };

  const handleStartPomodoro = (durationMinutes, isBreak) => {
    socketService.send("pomodoro-start", { duration: durationMinutes, isBreak });
  };
  const handleStopPomodoro = () => {
    socketService.send("pomodoro-stop", {});
  };
  const handleSendMessage = (text) => {
    socketService.send("chat-message", { text });
  };

  const handleClearChat = () => {
    socketService.send("chat-clear", {});
    setMessages([]);
  };

  const handleSendReaction = (reaction) => {
    socketService.send("reaction", { reaction });
  };

  const handleRaiseHand = () => {
    socketService.send("raise-hand", {});
  };

  const handleApproveHand = (targetId) => {
    socketService.send("hand-approved", { targetUserId: targetId });
  };

  const handleDenyHand = (targetId) => {
    socketService.send("hand-denied", { targetUserId: targetId });
  };

  const handleChangeRole = (targetId, roleVal) => {
    socketService.send("role-change", { targetUserId: targetId, newRole: roleVal });
  };

  const handleKickUser = (targetId) => {
    socketService.send("kick-user", { targetUserId: targetId });
  };

  const handleAddBookmark = async (pageNum, note) => {
    try {
      if (!roomId) return;
      const bmk = await api.rooms.addBookmark(roomId, { pageNumber: pageNum, note });
      setBookmarks((prev) => [bmk, ...prev]);
    } catch (e) {
      alert("Failed to save bookmark note.");
    }
  };

  const triggerReactionDisplay = (uname, emoji) => {
    const toast = document.createElement("div");
    toast.className = "fixed bottom-5 right-5 bg-white border border-zinc-200 p-3 rounded-lg shadow-md z-50 flex items-center space-x-2 animate-bounce";
    toast.innerHTML = `<span class="text-xl">${emoji}</span> <span class="text-xs font-bold text-zinc-700">${uname} reacted</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2500);
  };

  const handleExportSession = () => {
    const chatLogs = messages.map((m) => `[${new Date(m.createdAt).toLocaleTimeString()}] ${m.username}: ${m.text}`).join("\r\n");
    const bmkLogs = bookmarks.map((b) => `Page ${b.pageNumber}: ${b.note}`).join("\r\n");
    const exportText = `StudySync Session Export\r\nRoom: ${room?.name}\r\nSubject: ${room?.subject}\r\nCode: ${room?.code}\r\n\r\n--- CHAT DISCUSSION LOGS ---\r\n${chatLogs}\r\n\r\n--- STUDY NOTES & BOOKMARKS ---\r\n${bmkLogs}`;

    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${room?.name.replace(/\s+/g, "_")}_session_export.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleViewMode = (mode) => {
    setViewMode(mode);
    socketService.send("view-mode-change", { onWhiteboard: mode === "whiteboard" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center space-y-3 font-sans">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
        <span className="text-sm font-semibold text-zinc-600">Setting up study room session...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="p-6 bg-white border border-zinc-200 rounded-lg max-w-sm text-center shadow-md space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-zinc-950">Connection Error</h2>
          <p className="text-sm text-zinc-500">{error}</p>
          <button
            onClick={() => navigate("/study")}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition shadow-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white text-zinc-900 font-sans overflow-hidden">
      <header className="h-16 border-b border-zinc-200 flex items-center justify-between px-4 sm:px-6 shrink-0 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-3 sm:space-x-6 min-w-0">
          <button
            onClick={() => navigate("/study")}
            className="p-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 text-zinc-600 transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0 hidden sm:flex">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold truncate text-zinc-900">{room?.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-indigo-700 font-extrabold truncate">
                {room?.subject} <span className="hidden sm:inline">• Code: {room?.code}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-4 shrink-0 relative">
          {pomodoro.active && (
            <div className="flex items-center bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5 sm:px-3 sm:py-1 text-indigo-700 space-x-1 sm:space-x-1.5 animate-pulse">
              <span className="text-[9px] uppercase font-bold hidden md:inline">Focus:</span>
              <span className="text-xs sm:text-sm font-mono font-bold">
                {Math.floor(pomodoro.timeLeft / 60)}:{String(pomodoro.timeLeft % 60).padStart(2, "0")}
              </span>
            </div>
          )}

          {currentRole === "host" && (
            <div className="hidden lg:flex items-center space-x-4 border-l border-zinc-200 pl-4 text-xs font-semibold text-zinc-500">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <span>Presenter Mode</span>
                <input
                  type="checkbox"
                  checked={presenterMode}
                  onChange={handleTogglePresenterMode}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                />
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <span>Free Scroll</span>
                <input
                  type="checkbox"
                  checked={freeScroll}
                  onChange={handleToggleFreeScroll}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                />
              </label>
            </div>
          )}

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 sm:px-3 sm:py-2 border rounded-lg text-sm font-semibold flex items-center space-x-1.5 shadow-sm transition ${
              isSidebarOpen
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            }`}
            title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isSidebarOpen ? (
              <>
                <ChevronRight className="w-4 h-4" />
                <span className="hidden sm:inline">Hide Sidebar</span>
              </>
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Show Sidebar</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportSession}
            className="hidden lg:flex bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 px-3 py-2 rounded-lg text-sm font-semibold items-center space-x-1.5 shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>Export Log</span>
          </button>

          {/* More Options dropdown button for mobile */}
          <div className="lg:hidden relative">
            <button
              onClick={() => setShowMobileOptions(!showMobileOptions)}
              className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 p-2 rounded-lg text-sm font-semibold flex items-center shadow-sm transition"
              title="More Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {showMobileOptions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMobileOptions(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white border border-zinc-200 rounded-xl shadow-xl p-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2 px-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Session Controls</span>
                    <button onClick={() => setShowMobileOptions(false)} className="text-zinc-400 hover:text-zinc-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  {currentRole === "host" && (
                    <div className="flex flex-col gap-3 pb-2 px-1 border-b border-zinc-100">
                      <label className="flex items-center justify-between text-xs font-semibold text-zinc-700 cursor-pointer">
                        <span>Presenter Mode</span>
                        <input
                          type="checkbox"
                          checked={presenterMode}
                          onChange={(e) => {
                            handleTogglePresenterMode(e);
                          }}
                          className="w-4.5 h-4.5 accent-indigo-600 cursor-pointer"
                        />
                      </label>
                      <label className="flex items-center justify-between text-xs font-semibold text-zinc-700 cursor-pointer">
                        <span>Free Scroll</span>
                        <input
                          type="checkbox"
                          checked={freeScroll}
                          onChange={(e) => {
                            handleToggleFreeScroll(e);
                          }}
                          className="w-4.5 h-4.5 accent-indigo-600 cursor-pointer"
                        />
                      </label>
                    </div>
                  )}
                  
                  <button
                    onClick={() => {
                      handleExportSession();
                      setShowMobileOptions(false);
                    }}
                    className="w-full text-left flex items-center space-x-2 px-2 py-1.5 hover:bg-zinc-50 rounded-lg text-xs font-semibold text-zinc-700 transition"
                  >
                    <Download className="w-4 h-4 text-zinc-500" />
                    <span>Export Room Log</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => navigate("/study")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-semibold shadow-sm transition flex items-center space-x-1.5"
            title="Leave Study Room"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </header>

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 md:hidden" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      <main className="flex-1 flex overflow-hidden relative">
        <section className="flex-1 flex flex-col bg-zinc-50 p-4 overflow-hidden relative">
          <div className="absolute top-6 left-6 z-20 flex items-center space-x-1 bg-white p-1 rounded-lg border border-zinc-200 shadow-sm">
            <button
              onClick={() => handleToggleViewMode("pdf")}
              className={`p-1.5 px-3 rounded-md text-xs font-bold transition ${
                viewMode === "pdf" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              PDF
            </button>
            <button
              onClick={() => handleToggleViewMode("whiteboard")}
              className={`p-1.5 px-3 rounded-md text-xs font-bold transition ${
                viewMode === "whiteboard" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              Whiteboard
            </button>
          </div>

          <div className="flex-1 w-full h-full min-h-0 min-w-0 pt-10">
            {viewMode === "pdf" ? (
              <PDFViewer
                roomId={roomId || ""}
                pdfUrl={pdfUrl}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                canAnnotate={currentRole === "host" || currentRole === "speaker"}
                onUploadSuccess={handlePDFUploadSuccess}
                socketService={socketService}
                isHost={currentRole === "host"}
              />
            ) : (
              <Whiteboard 
                roomId={roomId || ""} 
                socketService={socketService} 
                role={currentRole} 
                initialState={whiteboardState}
                onStateChange={setWhiteboardState}
                panOffset={whiteboardPanOffset}
                zoom={whiteboardZoom}
                onViewChange={(pan, z) => {
                  setWhiteboardPanOffset(pan);
                  setWhiteboardZoom(z);
                  socketService.send("whiteboard-view-sync", {
                    panOffset: pan,
                    zoom: z
                  });
                }}
              />
            )}
          </div>

          {/* Floating tab button when sidebar is closed */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-white border-l border-y border-zinc-200 hover:bg-zinc-50 text-zinc-500 hover:text-zinc-700 p-2 py-4 rounded-l-xl shadow-md z-30 transition-all flex items-center justify-center group"
              title="Open Sidebar"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            </button>
          )}
        </section>

        {isSidebarOpen && (
          <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 md:relative md:flex md:w-80 border-l border-zinc-200 flex flex-col bg-white shrink-0 shadow-2xl md:shadow-none animate-in slide-in-from-right duration-200">
          <div className="flex border-b border-zinc-200 bg-zinc-50/50 items-center">
            <button
              onClick={() => setRightTab("chat")}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
                rightTab === "chat" ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <MessageSquare className="w-4 h-4 mx-auto mb-1" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setRightTab("participants")}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
                rightTab === "participants" ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <Users className="w-4 h-4 mx-auto mb-1" />
              <span>Users</span>
            </button>
            <button
              onClick={() => setRightTab("bookmarks")}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
                rightTab === "bookmarks" ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <Bookmark className="w-4 h-4 mx-auto mb-1" />
              <span>Notes</span>
            </button>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-3 border-l border-zinc-200 text-zinc-400 hover:text-zinc-600 shrink-0 self-stretch flex items-center justify-center transition"
              title="Close Sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden p-3 bg-white">
            {rightTab === "chat" && (
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                onSendReaction={handleSendReaction}
                onRaiseHand={handleRaiseHand}
                userId={currentUserId}
                role={currentRole}
                raisedHands={raisedHands}
                onClearChat={handleClearChat}
              />
            )}

            {rightTab === "participants" && (
              <div className="flex flex-col h-full space-y-4">
                <div className="flex-1 overflow-hidden">
                  <ParticipantList
                    participants={participants}
                    currentUserId={currentUserId}
                    isHost={currentRole === "host"}
                    raisedHands={raisedHands}
                    onApproveHand={handleApproveHand}
                    onDenyHand={handleDenyHand}
                    onChangeRole={handleChangeRole}
                    onKick={handleKickUser}
                  />
                </div>
                <div className="shrink-0">
                  <PomodoroTimer
                    active={pomodoro.active}
                    timeLeft={pomodoro.timeLeft}
                    duration={pomodoro.duration}
                    isBreak={pomodoro.isBreak}
                    onStart={handleStartPomodoro}
                    onStop={handleStopPomodoro}
                    isHost={currentRole === "host"}
                  />
                </div>
              </div>
            )}

            {rightTab === "bookmarks" && (
              <BookmarkPanel
                bookmarks={bookmarks}
                currentPage={currentPage}
                onAddBookmark={handleAddBookmark}
              />
            )}
          </div>
        </aside>
        )}
      </main>
    </div>
  );
}
