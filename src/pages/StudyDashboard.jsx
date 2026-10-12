import { useState, useEffect } from "react";
import NavBar from "./NavBar";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import RoomCard from "../components/study/RoomCard";
import { Plus, Compass, LogOut, Code, BookOpen, AlertCircle, X, Search } from "lucide-react";

export default function StudyDashboard({user,onLogout,theme,toggleTheme}) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  // Create Room fields
  const [roomName, setRoomName] = useState("");
  const [roomSubject, setRoomSubject] = useState("");
  const [roomTags, setRoomTags] = useState("");
  const [roomIsPublic, setRoomIsPublic] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);

  // Join Room fields
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  const navigate = useNavigate();

  // Get current user info safely
  const userId = user?.id || user?.userId || "";
  useEffect(() => {
//     console.log("TOKEN:", localStorage.getItem("crm_token"));
// console.log("USER:", localStorage.getItem("crm_user"));
    if (!localStorage.getItem("crm_token")) {
      navigate("/auth");
      return;
    }
    fetchRooms();
  }, [navigate]);

  const fetchRooms = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.rooms.list();
      setRooms(data);
    } catch (err) {
      setError(err.message || "Failed to load study rooms.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName || !roomSubject) return;

    setCreateLoading(true);
    try {
      const tagsArray = roomTags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      
      const newRoom = await api.rooms.create({
        name: roomName,
        subject: roomSubject,
        tags: tagsArray,
        isPublic: roomIsPublic,
      });

      setRooms((prev) => [newRoom, ...prev]);
      setShowCreateModal(false);
      // Reset fields
      setRoomName("");
      setRoomSubject("");
      setRoomTags("");
      setRoomIsPublic(true);

      // Navigate immediately to the room
      navigate(`/study/${newRoom._id}`);
    } catch (err) {
      alert(err.message || "Failed to create room.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!joinCode) return;

    setJoinLoading(true);
    try {
      const res = await api.rooms.join(joinCode);
      setShowJoinModal(false);
      setJoinCode("");
      navigate(`/study/${res.roomId}`);
    } catch (err) {
      alert(err.message || "Failed to join room.");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm("Are you sure you want to delete this study room? All data will be archived.")) return;
    try {
      await api.rooms.delete(roomId);
      setRooms((prev) => prev.filter((r) => r._id !== roomId));
    } catch (err) {
      alert(err.message || "Failed to delete room.");
    }
  };
  // Extract all unique tags
  const allTags = Array.from(
    new Set(rooms.flatMap((r) => r.tags || []))
  );

  // Filter logic
  const myRooms = rooms.filter((r) => r.hostId === userId);
  const publicRooms = rooms.filter((r) => r.isPublic && r.hostId !== userId);

  const filterRoom = (r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = !selectedTag || r.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  };

  const filteredMyRooms = myRooms.filter(filterRoom);
  const filteredPublicRooms = publicRooms.filter(filterRoom);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans text-zinc-950">
      {/* Navbar */}
     <NavBar
     user={user}
     theme="light"
     toggleTheme={()=>{}}
     onLogout={onLogout}
     />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Top Controls Bar */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Collaborative Study Spaces</h1>
            <p className="text-sm text-zinc-500">Join a room to review PDFs, draw on whiteboards, and study in real-time.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex items-center space-x-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 py-2.5 px-4 rounded-lg text-sm font-semibold transition"
            >
              <Code className="w-4 h-4" />
              <span>Join with Code</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-lg text-sm font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Study Room</span>
            </button>
          </div>
        </div>

        {/* Search & Tag Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-zinc-200 p-4 rounded-lg shadow-sm">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search rooms by name or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-zinc-200 bg-zinc-50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedTag("")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition ${
                !selectedTag
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              All Tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition ${
                  selectedTag === tag
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
            <span className="text-sm text-zinc-500 font-semibold">Loading rooms...</span>
          </div>
        ) : (
          <div className="space-y-10">
            {/* My Rooms */}
            <section className="space-y-4">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-zinc-900">My Study Rooms</h2>
              </div>
              {filteredMyRooms.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-lg p-10 text-center text-zinc-500 text-sm">
                  No spaces found. Click "Create Study Room" to start your first session!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredMyRooms.map((room) => (
                    <RoomCard
                      key={room._id}
                      room={room}
                      userId={userId}
                      onJoin={(code) => {
                        setJoinCode(code);
                        setShowJoinModal(true);
                      }}
                      onEnter={(id) => navigate(`/study/${id}`)}
                      onDelete={handleDeleteRoom}
                      isJoined={true}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Discover Public Rooms */}
            <section className="space-y-4">
              <div className="flex items-center space-x-2">
                <Compass className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-zinc-900">Discover Public Rooms</h2>
              </div>
              {filteredPublicRooms.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-lg p-10 text-center text-zinc-500 text-sm">
                  No public spaces available. Try checking back later or invite others!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredPublicRooms.map((room) => (
                    <RoomCard
                      key={room._id}
                      room={room}
                      userId={userId}
                      onJoin={(code) => {
                        setJoinCode(code);
                        setShowJoinModal(true);
                      }}
                      onEnter={(id) => navigate(`/study/${id}`)}
                      isJoined={false}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* CREATE ROOM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-md w-full shadow-xl flex flex-col overflow-hidden">
            <div className="h-14 border-b border-zinc-100 px-6 flex items-center justify-between">
              <span className="font-bold text-zinc-900">Create Study Space</span>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateRoom} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Room Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Advanced Linear Algebra"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Subject / Course</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MATH-402"
                  value={roomSubject}
                  onChange={(e) => setRoomSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. linear, matrices, matrices prep"
                  value={roomTags}
                  onChange={(e) => setRoomTags(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-zinc-900">Public Room</span>
                  <span className="text-xs text-zinc-500">Allow others to discover this room</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRoomIsPublic(!roomIsPublic)}
                  className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                    roomIsPublic ? "bg-indigo-600" : "bg-zinc-200"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                      roomIsPublic ? "transform translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:bg-zinc-300"
                >
                  {createLoading ? "Creating..." : "Create Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN ROOM MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-200 rounded-lg max-w-sm w-full shadow-xl flex flex-col overflow-hidden">
            <div className="h-14 border-b border-zinc-100 px-6 flex items-center justify-between">
              <span className="font-bold text-zinc-900">Join Study Room</span>
              <button onClick={() => setShowJoinModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleJoinRoom} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Room Code</label>
                <input
                  type="text"
                  required
                  placeholder="Enter 6-digit code (e.g. AB12XY)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm tracking-widest font-mono text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:bg-zinc-300"
                >
                  {joinLoading ? "Joining..." : "Join Space"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
