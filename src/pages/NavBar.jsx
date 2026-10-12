// import React from 'react'
// import { FileText,Moon,LogOut,Sun } from 'lucide-react'
// const NavBar = ({user,theme,togglePage,toggleTheme,onLogout}) => {
//   return (
//     <div>
//          <header className={`border-b sticky top-0 z-10 shadow-xs transition-colors ${theme === "dark" ? "border-zinc-850 bg-zinc-900" : "border-zinc-200 bg-white"}`}>
//         <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
//           <div className="flex items-center gap-3">
//             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
//               <FileText className="w-5 h-5" />
//             </div>
//             <div>
//               <h1 className={`text-lg font-bold font-sans tracking-tight ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>SyncMD Dashboard</h1>
//               <p className={`text-xs font-sans ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}>Welcome back, <span className={`font-semibold ${theme === "dark" ? "text-zinc-200" : "text-zinc-700"}`}>{user.username}</span></p>
//             </div>
//           </div>
//           <div className="flex items-center gap-3">
//             {/* Theme switcher */}
//            {/* hey i am here */}
//            <button
//   onClick={togglePage}
//   className={`p-2 border transition-colors rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer select-none font-sans ${
//     theme === "dark"
//       ? "border-zinc-800 bg-zinc-900 text-emerald-400 hover:bg-zinc-800"
//       : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-emerald-600"
//   }`}
//   title="Open PDF Collaborator"
//   id="pdf-collaborator-btn"
// >
//   <FileText className="w-4 h-4" />
//   <span className="hidden sm:inline">StudySync</span>
// </button>
//             <button
//               onClick={toggleTheme}
//               className={`p-2 border transition-colors rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer select-none font-sans ${
//                 theme === "dark"
//                   ? "border-zinc-800 bg-zinc-900 text-amber-400 hover:bg-zinc-800"
//                   : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-indigo-600"
//               }`}
//               title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
//               id="theme-toggle-btn"
//             >
//               {theme === "dark" ? (
//                 <Sun className="w-4 h-4 text-amber-400" />
//               ) : (
//                 <Moon className="w-4 h-4 text-indigo-600" />
//               )}
//               <span className="hidden sm:inline">Theme</span>
//             </button>

//             <button
//               onClick={onLogout}
//               className={`p-2 border rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer select-none font-sans ${
//                 theme === "dark"
//                   ? "border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 hover:border-red-900/50"
//                   : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-red-650 hover:border-red-100"
//               }`}
//               id="logout-btn"
//             >
//               <LogOut className="w-4 h-4" />
//               <span className="hidden sm:inline">Logout</span>
//             </button>
//           </div>
//         </div>
//       </header>
//     </div>
//   )
// }

// export default NavBar


import React from 'react'
import { FileText, Moon, LogOut, Sun } from 'lucide-react'
import { useNavigate,useLocation } from 'react-router-dom'

const NavBar = ({ user, theme, toggleTheme, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    onLogout();
    navigate("/auth");
  };

  return (
    <div>
      <header className={`border-b sticky top-0 z-10 shadow-xs transition-colors ${theme === "dark" ? "border-zinc-850 bg-zinc-900" : "border-zinc-200 bg-white"}`}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className={`text-lg font-bold font-sans tracking-tight ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>Study Sync</h1>
              <p className={`text-xs font-sans ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"}`}>Welcome back, <span className={`font-semibold ${theme === "dark" ? "text-zinc-200" : "text-zinc-700"}`}>{user?.username}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Study Rooms button */}
            <button
              onClick={()=>{
                if(location.pathname === "/study"){
                  navigate("/");
                }
                else if(location.pathname === "/"){
                  navigate("/study")
                }
              }}
              className={`p-2 border transition-colors rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer select-none font-sans ${
                theme === "dark"
                  ? "border-zinc-800 bg-zinc-900 text-emerald-400 hover:bg-zinc-800"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-emerald-600"
              }`}
              title="Open Study Rooms"
              id="study-rooms-btn"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">StudySync</span>
            </button>

            {/* Theme switcher */}
            <button
              onClick={toggleTheme}
              className={`p-2 border transition-colors rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer select-none font-sans ${
                theme === "dark"
                  ? "border-zinc-800 bg-zinc-900 text-amber-400 hover:bg-zinc-800"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-indigo-600"
              }`}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              id="theme-toggle-btn"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
              <span className="hidden sm:inline">Theme</span>
            </button>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className={`p-2 border rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer select-none font-sans ${
                theme === "dark"
                  ? "border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 hover:border-red-900/50"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-red-650 hover:border-red-100"
              }`}
              id="logout-btn"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>
    </div>
  )
}

export default NavBar