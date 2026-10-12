// import React, { useEffect, useState } from "react";
// import AuthPage from "./pages/AuthPage.jsx";
// import HomePage from "./pages/HomePage.jsx";
// import EditorPage from "./pages/EditorPage.jsx";

// export default function App() {
//   const [user, setUser] = useState(null);
//   const [selectedDocId, setSelectedDocId] = useState(null);
//   const [appInitializing, setAppInitializing] = useState(true);
//   const [theme, setTheme] = useState(() => localStorage.getItem("crm_theme") || "light");
//   const [currentPage, setCurrentPage] = useState("home");
//   // Sync theme changes with document root
//   useEffect(() => {
//     if (theme === "dark") {
//       document.documentElement.classList.add("dark");
//     } else {
//       document.documentElement.classList.remove("dark");
//     }
//     localStorage.setItem("crm_theme", theme);
//   }, [theme]);

//   const toggleTheme = () => {
//     setTheme((prev) => (prev === "dark" ? "light" : "dark"));
//   };

//   // 1. Session check & URL Query parsing on load
//   useEffect(() => {
//     // Check saved user session
//     const stored = localStorage.getItem("crm_user");
//     if (stored) {
//       try {
//         setUser(JSON.parse(stored));
//       } catch (err) {
//         localStorage.removeItem("crm_user");
//         localStorage.removeItem("token");
//       }
//     }

//     // Parse deep-linked document URL queries
//     const params = new URLSearchParams(window.location.search);
//     const docId = params.get("docId");
//     if (docId) {
//       setSelectedDocId(docId);
//     }

//     setAppInitializing(false);

//     // Live sync browser history popstate (handles back/forward browser navigation)
//     const handlePopState = () => {
//       const liveParams = new URLSearchParams(window.location.search);
//       setSelectedDocId(liveParams.get("docId"));
//     };

//     window.addEventListener("popstate", handlePopState);
//     return () => {
//       window.removeEventListener("popstate", handlePopState);
//     };
//   }, []);

//   // Update browser URL query string on document navigation
//   const navigateToDocument = (docId) => {
//     setSelectedDocId(docId);
//     const url = new URL(window.location.href);
//     if (docId) {
//       url.searchParams.set("docId", docId);
//     } else {
//       url.searchParams.delete("docId");
//     }
//     window.history.pushState({}, "", url.toString());
//   };

//   const handleAuthSuccess = (authenticatedUser) => {
//     setUser(authenticatedUser);
//     setCurrentPage("home");
//   };

//   const handleLogout = () => {
//     localStorage.removeItem("crm_user");
//     localStorage.removeItem("token");
//     setUser(null);
//     navigateToDocument(null);
//   };

//   if (appInitializing) {
//     return (
//       <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center space-y-4">
//         <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
//         <span className="text-sm text-zinc-500 font-sans font-medium">Syncing profile...</span>
//       </div>
//     );
//   }

//   // Not signed in
//   if (!user) {
//     return <AuthPage onAuthSuccess={handleAuthSuccess} theme={theme} toggleTheme={toggleTheme} />;
//   }

//   // Signed in, document selected (workspace view)
//   if (selectedDocId) {
//     return (
//       <EditorPage
//         user={user}
//         docId={selectedDocId}
//         onBack={() => navigateToDocument(null)}
//         theme={theme}
//         toggleTheme={toggleTheme}
//       />
//     );
//   }

//   // Signed in, list view (homepage dashboard)
  
//   return (
//     <HomePage
//       user={user}
//       onLogout={handleLogout}
//       onSelectDocument={(docId) => navigateToDocument(docId)}
//       theme={theme}
//       toggleTheme={toggleTheme}
//     />
//   );
// }


import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./pages/AuthPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import EditorPage from "./pages/EditorPage.jsx";
import StudyDashboard from "./pages/StudyDashboard.jsx";
import StudyRoom from "./pages/StudyRoom.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [appInitializing, setAppInitializing] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  // Sync theme changes with document root
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Session check on load
  useEffect(() => {
    const stored = localStorage.getItem("crm_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (err) {
        localStorage.removeItem("crm_user");
        localStorage.removeItem("crm_token");
      }
    }
    setAppInitializing(false);
  }, []);

  const handleAuthSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("crm_user");
    localStorage.removeItem("crm_token");
    setUser(null);
  };

  if (appInitializing) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <span className="text-sm text-zinc-500 font-sans font-medium">Syncing profile...</span>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route
          path="/auth"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <AuthPage onAuthSuccess={handleAuthSuccess} theme={theme} toggleTheme={toggleTheme} />
            )
          }
        />

        {/* Markdown Editor Routes */}
        <Route
          path="/"
          element={
            user ? (
              <HomePage
                user={user}
                onLogout={handleLogout}
                theme={theme}
                toggleTheme={toggleTheme}
              />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />

        <Route
          path="/editor/:docId"
          element={
            user ? (
              <EditorPage user={user} theme={theme} toggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />

        {/* Study Room Routes */}
        <Route
          path="/study"
          element={
            user ? (
              <StudyDashboard user={user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />

        <Route
          path="/study/:roomId"
          element={
            user ? (
              <StudyRoom user={user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}