import React, { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { useNavigate } from "react-router-dom";
import { 
  FilePlus, 
  FileText,
  Search, 
  Trash2, 
  UserPlus, 
  Users, 
  Calendar, 
  ArrowRight, 
  BookOpen,
  Code,
  Sparkles
} from "lucide-react";
import NavBar from "./NavBar.jsx";
import ShowStudySync from "./ShowStudySync.jsx";

const MARKDOWN_TEMPLATES = [
  {
    id: "blank",
    name: "Blank Document",
    description: "Start fresh with generic header structure",
    icon: FileText,
    content: (title) => `# ${title}\n\nStart typing your collaborative markdown text here...\n\n- [ ] Task 1\n- [ ] Task 2`
  },
  {
    id: "meeting_notes",
    name: "Meeting Notes",
    description: "Agenda, participant checklist & actions",
    icon: Users,
    content: (title, username) => `# 📅 Meeting Notes: ${title}
    
## Details
- **Date:** ${new Date().toLocaleDateString()}
- **Facilitator:** ${username || "Collaborator"}
- **Participants:**
  - [x] ${username || "Owner"}
  - [ ] 

## Agenda
1. Goal reviews
2. Status checkpoints & Milestones
3. Next steps & Impediments

## Discussion & Crucial Notes
- Write custom summary points here...
- Use bullet points for active decisions.

## Action Items
- [ ] **@owner** - Design and test key architectural paths
- [ ] **@collaborator** - Finish component structure reviews
- [ ] **@QA** - Run comprehensive end-to-end regression validation`
  },
  {
    id: "blog_post",
    name: "Blog Post Outline",
    description: "Hooks, headers, insights & call-to-actions",
    icon: BookOpen,
    content: (title, username) => `# 📝 Blog Post: ${title}

*Published on: ${new Date().toLocaleDateString()} • Written by: ${username || "Author"}*

## Catchy Introduction Headline / Hook
> Place a deep or engaging hook quotation here to captivate readers from page 1.

---

## The Core Problem
Explain what struggles or hurdles readers usually face. Define the exact paradigm shift this article offers.

## Advanced Strategies & Techniques
Here you list the structural solutions or core advice:
1. **First Strategy**: Detail the core explanation.
2. **Second Strategy**: Support it with deep, factual metadata.

## Key Takeaways
- Always prioritize structural readability.
- Keep sentences punchy, dynamic, and clean.

## Epilogue / Call To Action (CTA)
What should readers do next? Subscribe, share with peers, or trial the code? Let them know!`
  },
  {
    id: "project_roadmap",
    name: "Project Roadmap",
    description: "Milestones planner & timelines tracker",
    icon: Calendar,
    content: (title) => `# 🚀 Project Roadmap: ${title}

## Executive Summary
A precise high-level description of what we are building, who our key client persona is, and how we deliver strategic value.

---

## 🎯 Milestones & Timeline
- [ ] **Phase 1: Foundation & Specs** (Due: Next week)
  - [x] Gather user experience mockups
  - [ ] Complete database schema design
- [ ] **Phase 2: Alpha Prototyping** (Due: End of month)
  - [ ] Integrate local sync storage engines
  - [ ] Build functional mockup frames
- [ ] **Phase 3: Beta testing & Harden** (Due: Next quarter)
  - [ ] Release public share credentials
  - [ ] Final performance audits

## 🛠️ Architecture & Tech Stack
- **Frontend Engine**: React 18, Tailwind CSS, Monaco Editor
- **Real-time Sync**: Yjs CRDTs over Secure WebSockets
- **Backend Service**: Express client routing & ephemeral room manager`
  },
  {
    id: "api_spec",
    name: "API Specification",
    description: "Sample REST resource requests & response examples",
    icon: Code,
    content: (title) => `# 🔌 API Specification: ${title}

## Base Server URL
\`https://api.collabdocs.local/v1\`

---

### 1. Get All Records
- **Endpoint**: \`GET /records\`
- **Access Control**: Bearer Web Token required
- **Response Shape (200 OK)**:
\`\`\`json
{
  "status": "success",
  "data": [
    {
      "id": "rec_98218a",
      "title": "Initial Draft Record",
      "created_at": "${new Date().toISOString()}"
    }
  ]
}
\`\`\`

### 2. Update Spec Sheet
- **Endpoint**: \`POST /records/:docId\`
- **Payload Schema**:
\`\`\`json
{
  "title": "Updated custom identifier string",
  "content": "Fully-formed dynamic Markdown text or JSON payload"
}
\`\`\`
- **Response Shape (250 Accepted)**:
\`\`\`json
{
  "updated": true,
  "transaction": "txn_8192a"
}
\`\`\``
  },
  {
    id: "daily_standup",
    name: "Daily Standup Log",
    description: "Task statuses & alignment checklists",
    icon: Sparkles,
    content: (title, username) => `# 🏃 Daily Standup: ${title}

**Team Member:** ${username || "Collaborator"}  
**Date:** ${new Date().toLocaleDateString()}

---

### ⏪ What I Did Yesterday
- Refactored Monaco state management hooks in \`Editor.jsx\`
- Resolved key duplication issue in document deletion triggers
- Styled modal confirmation dialogs in dark/light modes

### ⏩ What I Am Doing Today
- Implement template selector system into New Document card
- Style custom badge selectors with fluid Tailwind classes
- Add user-friendly templates for blog outlines, specs, and roadmap builders

### 🛑 Any Impediments / Blockers?
- *None currently.* Ready to deploy to production staging environment!`
  }
];

export default function HomePage({ user, onLogout, theme, toggleTheme }) {
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  // Create document triggers
  const [newTitle, setNewTitle] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  const [isCreating, setIsCreating] = useState(false);

  // Share triggers
  const [shareDocId, setShareDocId] = useState(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState(null);

  // Delete triggers
  const [deleteConfirmDocId, setDeleteConfirmDocId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);


  //StudySync
  const [currentPage,setCurrentPage] = useState("home");

  const fetchDocs = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.documents.list();
      setDocs(list || []);
    } catch (err) {
      setError(err.message || "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleCreateDoc = async (e) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const title = newTitle.trim() || "Untitled Markdown Sheet";
      const tmpl = MARKDOWN_TEMPLATES.find(t => t.id === selectedTemplate) || MARKDOWN_TEMPLATES[0];
      const initialTemplate = tmpl.content(title, user?.username);
      
      const doc = await api.documents.create(title, initialTemplate);
      if (doc && doc.docId) {
        navigate(`/editor/${doc.docId}`)
      } else {
        throw new Error("Invalid response received from creation API.");
      }
    } catch (err) {
      setError(err.message || "Could not spawn new document.");
      setIsCreating(false);
    }
  };
  const togglePage = ()=>{
    if(currentPage==="home"){
      setCurrentPage("pdf");
    }
    else if(currentPage==="pdf"){
      setCurrentPage("home");
    }
  }
  const handleDelete = async () => {
    if (!deleteConfirmDocId) return;
    setIsDeleting(true);
    setError(null);
    try {
      await api.documents.delete(deleteConfirmDocId);
      setDocs(docs.filter(d => d.docId !== deleteConfirmDocId));
      setDeleteConfirmDocId(null);
    } catch (err) {
      setError(err.message || "Could not delete document.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (!shareDocId || !shareEmail.trim()) return;

    setShareLoading(true);
    setShareMessage(null);

    try {
      await api.documents.share(shareDocId, shareEmail.trim());
      setShareMessage(`Successfully granted access to ${shareEmail}`);
      setShareEmail("");
      
      // Update local collaborators display representation if matching doc
      const updatedList = docs.map(d => {
        if (d.docId === shareDocId) {
          const lower = shareEmail.toLowerCase().trim();
          if (!d.collaborators.includes(lower)) {
            return { ...d, collaborators: [...d.collaborators, lower] };
          }
        }
        return d;
      });
      setDocs(updatedList);
    } catch (err) {
      setShareMessage(`Error: ${err.message}`);
    } finally {
      setShareLoading(false);
    }
  };

  // Filter documents
  const filteredDocs = docs.filter(doc => {
    const term = search.toLowerCase();
    return (
      doc.title.toLowerCase().includes(term) ||
      (doc.content && doc.content.toLowerCase().includes(term))
    );
  });

  const ownedCount = docs.filter(d => d.userId === user.id).length;
  const sharedCount = docs.length - ownedCount;

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-150 ${theme === "dark" ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"}`} id="home-dashboard">
      {/* Header */}
   <NavBar theme={theme}
   togglePage = {togglePage}
   toggleTheme = {toggleTheme}
   user={user}
   onLogout = {onLogout}
   />

      {/* Main Panel */}
      {currentPage==="home"?<div>
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 py-8 space-y-6">
        {error && (
          <div className={`p-4 rounded-xl text-xs font-semibold shadow-xs animate-fade-in ${
            theme === "dark" ? "bg-red-955/40 border border-red-900/60 text-red-400" : "bg-red-50 border border-red-100 text-red-600"
          }`}>
            {error}
          </div>
        )}

        {/* Info stats Cockpit */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="stats-dock">
          {/* Stats card 1 */}
          <div className={`border p-5 rounded-2xl flex items-center justify-between shadow-xs transition-colors ${
            theme === "dark" ? "bg-zinc-900 border-zinc-850 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
          }`}>
            <div className="space-y-1">
              <span className={`text-xs font-semibold uppercase tracking-wider font-sans ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`}>Total Markdown Documents</span>
              <p className={`text-3xl font-extrabold font-sans ${theme === "dark" ? "text-white" : "text-zinc-950"}`}>{docs.length}</p>
            </div>
            <div className={`w-12 h-12 border rounded-xl flex items-center justify-center ${
              theme === "dark" ? "bg-indigo-950/40 border-indigo-900/65 text-indigo-400" : "bg-indigo-50 border-indigo-100 text-indigo-600"
            }`}>
              <FileText className="w-6 h-6" />
            </div>
          </div>

          {/* Stats card 2 */}
          <div className={`border p-5 rounded-2xl flex items-center justify-between shadow-xs transition-colors ${
            theme === "dark" ? "bg-zinc-900 border-zinc-850 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
          }`}>
            <div className="space-y-1">
              <span className={`text-xs font-semibold uppercase tracking-wider font-sans ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`}>Created By You</span>
              <p className={`text-3xl font-extrabold font-sans ${theme === "dark" ? "text-indigo-400" : "text-indigo-600"}`}>{ownedCount}</p>
            </div>
            <div className={`w-12 h-12 border rounded-xl flex items-center justify-center ${
              theme === "dark" ? "bg-emerald-955/40 border-emerald-900/65 text-emerald-400" : "bg-emerald-50 border-emerald-100 text-emerald-600"
            }`}>
              <FileText className="w-6 h-6" />
            </div>
          </div>

          {/* Stats card 3 */}
          <div className={`border p-5 rounded-2xl flex items-center justify-between shadow-xs transition-colors ${
            theme === "dark" ? "bg-zinc-900 border-zinc-850 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
          }`}>
            <div className="space-y-1">
              <span className={`text-xs font-semibold uppercase tracking-wider font-sans ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`}>Shared Worksheets</span>
              <p className={`text-3xl font-extrabold font-sans ${theme === "dark" ? "text-amber-400" : "text-amber-500"}`}>{sharedCount}</p>
            </div>
            <div className={`w-12 h-12 border rounded-xl flex items-center justify-center ${
              theme === "dark" ? "bg-amber-955/40 border-amber-900/65 text-amber-400" : "bg-amber-50 border-amber-100 text-amber-600"
            }`}>
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Search and Core creation */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Create Document Box */}
          <div className={`md:col-span-4 border p-6 rounded-2xl shadow-sm space-y-4 ${
            theme === "dark" ? "bg-zinc-900 border-zinc-850" : "bg-white border-zinc-200"
          }`}>
            <div className="space-y-1">
              <h3 className={`text-base font-bold tracking-tight font-sans ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>New Document</h3>
              <p className={`text-xs font-sans ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}>Launch an instant real-time synchronized markdown pad.</p>
            </div>
            <form onSubmit={handleCreateDoc} className="space-y-3">
              <input
                type="text"
                placeholder="Document Title (e.g. Project Plan)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={60}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans ${
                  theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-500" : "bg-white border-zinc-250 text-zinc-900 placeholder-zinc-400 hover:border-zinc-300"
                }`}
                id="new-document-title-input"
              />

              {/* Advanced Markdown Templates Selector */}
              <div className="space-y-1.5 pt-1">
                <label className={`text-[11px] font-bold font-sans tracking-wide uppercase ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}>
                  Choose a Starting Template
                </label>
                <div className="grid grid-cols-1 gap-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                  {MARKDOWN_TEMPLATES.map((tmpl) => {
                    const IconComponent = tmpl.icon;
                    const isSelected = selectedTemplate === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => setSelectedTemplate(tmpl.id)}
                        className={`w-full text-left p-2 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer group ${
                          isSelected
                            ? "bg-indigo-600/10 border-indigo-500 text-indigo-400"
                            : theme === "dark"
                            ? "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-750 hover:bg-zinc-950/80"
                            : "border-zinc-200 bg-zinc-50/60 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                        }`}
                        id={`template-${tmpl.id}`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 transition-colors ${
                          isSelected
                            ? "bg-indigo-605 text-white"
                            : theme === "dark"
                            ? "bg-zinc-800/80 text-zinc-400 group-hover:text-zinc-200"
                            : "bg-zinc-200 text-zinc-650 group-hover:text-zinc-900"
                        }`}>
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold font-sans leading-tight ${
                            isSelected 
                              ? theme === "dark" ? "text-indigo-300" : "text-indigo-700" 
                              : theme === "dark" ? "text-zinc-200" : "text-zinc-800"
                          }`}>
                            {tmpl.name}
                          </p>
                          <p className={`text-[10px] font-sans truncate leading-normal ${
                            isSelected
                              ? theme === "dark" ? "text-indigo-400/80" : "text-indigo-600/85"
                              : theme === "dark" ? "text-zinc-500" : "text-zinc-450"
                          }`}>
                            {tmpl.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                id="create-document-btn"
              >
                <FilePlus className="w-4 h-4" />
                {isCreating ? "Creating Document..." : "Create Document"}
              </button>
            </form>
          </div>

          {/* List panel */}
          <div className={`border rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px] md:col-span-8 ${
            theme === "dark" ? "bg-zinc-900 border-zinc-850" : "bg-white border-zinc-200"
          }`}>
            {/* Search/Tool Bar */}
            <div className={`p-4 border-b flex flex-col sm:flex-row gap-3 items-center justify-between ${
              theme === "dark" ? "bg-zinc-900/60 border-zinc-850" : "bg-zinc-50/50 border-zinc-200"
            }`}>
              <div className="relative w-full sm:max-w-xs">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400 pointer-events-none">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Query documents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`w-full pl-9 pr-3 py-1.5 border rounded-lg text-xs focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans ${
                    theme === "dark" ? "bg-zinc-950 border-zinc-805 text-zinc-100 placeholder-zinc-505 focus:border-indigo-505" : "bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400"
                  }`}
                  id="search-documents-input"
                />
              </div>
              <span className={`text-xs font-sans hidden sm:inline select-none ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`}>
                Showing {filteredDocs.length} of {docs.length} documents
              </span>
            </div>

            {/* Document List rows */}
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-2 select-none" id="loading-spinner">
                <div className={`w-8 h-8 border-4 rounded-full animate-spin ${theme === "dark" ? "border-zinc-800 border-t-indigo-500" : "border-indigo-200 border-t-indigo-600"}`}></div>
                <span className={`text-sm font-medium ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`}>Scanning folders...</span>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3" id="empty-state">
                <FileText className={`w-12 h-12 ${theme === "dark" ? "text-zinc-800" : "text-zinc-300"}`} />
                <div className="text-center space-y-1">
                  <p className={`text-sm font-semibold font-sans ${theme === "dark" ? "text-zinc-350" : "text-zinc-800"}`}>No Documents Found</p>
                  <p className={`text-xs font-sans ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`}>Create a new markdown page or update search query.</p>
                </div>
              </div>
            ) : (
              <div className={`divide-y max-h-[500px] overflow-y-auto ${theme === "dark" ? "divide-zinc-850" : "divide-zinc-200"}`} id="document-rows-container">
                {filteredDocs.map((doc) => {
                  const isOwner = doc.userId === user.id;
                  const docDate = new Date(doc.updated).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  });

                  return (
                    <div
                      key={doc.docId}
                      onClick={() => navigate(`/editor/${doc.docId}`)}
                      className={`p-4 flex items-center justify-between transition-colors cursor-pointer group ${
                        theme === "dark" ? "hover:bg-zinc-950/60" : "hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 pr-4 min-w-0">
                        <div className={`w-9 h-9 border rounded-lg flex items-center justify-center transition-all shadow-2xs ${
                          theme === "dark" 
                            ? "border-zinc-805 bg-zinc-950 text-zinc-500 group-hover:border-indigo-900 group-hover:bg-indigo-950/40 group-hover:text-indigo-400" 
                            : "border-zinc-150 bg-zinc-50 text-zinc-500 group-hover:border-indigo-150 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                        }`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <h4 className={`text-sm font-semibold font-sans truncate pr-2 ${theme === "dark" ? "text-zinc-100" : "text-zinc-900"}`}>
                            {doc.title}
                          </h4>
                          <div className={`flex items-center gap-2.5 text-xs font-sans ${theme === "dark" ? "text-zinc-500" : "text-zinc-400"}`}>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {docDate}
                            </span>
                            <span>•</span>
                            {isOwner ? (
                              <span className={`rounded-sm px-1.5 py-0.2 text-[9px] font-bold border ${
                                theme === "dark" ? "text-emerald-400 bg-emerald-955/40 border-emerald-900/60" : "text-emerald-600 bg-emerald-50 border-emerald-100"
                              }`}>
                                OWNED
                              </span>
                            ) : (
                              <span className={`rounded-sm px-1.5 py-0.2 text-[9px] font-bold border ${
                                theme === "dark" ? "text-amber-400 bg-amber-955/40 border-amber-905/60" : "text-amber-600 bg-amber-50 border-amber-100"
                              }`}>
                                SHARED COLAB
                              </span>
                            )}
                            {doc.collaborators.length > 0 && (
                              <span className={`flex items-center gap-1 text-[11px] ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}>
                                <Users className="w-3 h-3" />
                                {doc.collaborators.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Item Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isOwner && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShareDocId(doc.docId);
                              setShareMessage(null);
                            }}
                            className={`p-1.5 border rounded-lg transition-colors cursor-pointer ${
                              theme === "dark" 
                                ? "border-zinc-800 text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 hover:border-indigo-900" 
                                : "border-zinc-200 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-155"
                            }`}
                            title="Share with collaborator"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        )}
                        {isOwner && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmDocId(doc.docId);
                            }}
                            className={`p-1.5 border rounded-lg transition-colors cursor-pointer ${
                              theme === "dark" 
                                ? "border-zinc-800 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 hover:border-red-900" 
                                : "border-zinc-200 text-zinc-400 hover:text-red-650 hover:bg-red-50 hover:border-red-155"
                            }`}
                            title="Delete Document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <span className={`p-1.5 transition-colors group-hover:text-indigo-500 text-zinc-400`}>
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Share Modalless Overlay Box */}
      {shareDocId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-40 animate-fade-in" id="share-modal">
          <div className={`w-full max-w-sm border rounded-xl shadow-2xl p-6 relative ${
            theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-250"
          }`}>
            <h3 className={`text-sm font-bold font-sans tracking-tight mb-1 ${
              theme === "dark" ? "text-zinc-100" : "text-zinc-950"
            }`}>
              Invite Collaborator
            </h3>
            <p className={`text-xs font-sans mb-4 ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-500"
            }`}>
              Enter user email to share document: <strong className={theme === "dark" ? "text-zinc-200" : "text-zinc-700"}> {docs.find(d => d.docId === shareDocId)?.title}</strong>
            </p>

            {shareMessage && (
              <div className={`p-2 rounded-lg text-xs font-semibold mb-4 leading-normal ${
                shareMessage.startsWith("Error") 
                  ? theme === "dark" ? "bg-red-955/40 border border-red-900/50 text-red-450" : "bg-red-50 border border-red-100 text-red-600"
                  : theme === "dark" ? "bg-emerald-955/40 border border-emerald-900/50 text-emerald-400" : "bg-emerald-50 border border-emerald-100 text-emerald-700"
              }`}>
                {shareMessage}
              </div>
            )}

            <form onSubmit={handleShareSubmit} className="space-y-4">
              <input
                type="email"
                placeholder="collaborator@example.com"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-xs font-sans ${
                  theme === "dark" ? "bg-zinc-850 border-zinc-750 text-zinc-100 placeholder-zinc-500 focus:border-indigo-505 focus:outline-hidden" : "bg-white border-zinc-250 text-zinc-900"
                }`}
                required
                id="share-email-input"
              />
              <div className="flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShareDocId(null);
                    setShareMessage(null);
                  }}
                  className={`px-3 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer select-none font-sans ${
                    theme === "dark" ? "border-zinc-800 text-zinc-400 hover:bg-zinc-800" : "border-zinc-250 text-zinc-650 hover:bg-zinc-50"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={shareLoading}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs font-semibold cursor-pointer flex items-center gap-1"
                  id="share-submit-btn"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {shareLoading ? "Sharing..." : "Grant Access"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Overlay Box */}
      {deleteConfirmDocId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-40 animate-fade-in" id="delete-modal">
          <div className={`w-full max-w-sm border rounded-xl shadow-2xl p-6 relative ${
            theme === "dark" ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-250 text-zinc-900"
          }`}>
            <h3 className={`text-sm font-bold font-sans tracking-tight mb-1 ${
              theme === "dark" ? "text-red-400" : "text-red-600"
            }`}>
              Delete Document
            </h3>
            <p className={`text-xs font-sans mb-5 leading-relaxed ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-500"
            }`}>
              Are you sure you want to permanently delete <strong className={theme === "dark" ? "text-zinc-200" : "text-zinc-850"}>"{docs.find(d => d.docId === deleteConfirmDocId)?.title}"</strong>? This will remove all collaboration history and sync states forever. This action cannot be undone.
            </p>

            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmDocId(null)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer select-none font-sans ${
                  theme === "dark" ? "border-zinc-800 text-zinc-400 hover:bg-zinc-800" : "border-zinc-250 text-zinc-650 hover:bg-zinc-50"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-semibold cursor-pointer flex items-center gap-1 active:scale-98 transition-all disabled:opacity-50"
                id="delete-confirm-btn"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>:<div>
        <ShowStudySync/>
        </div>}
    </div>
  );
}
