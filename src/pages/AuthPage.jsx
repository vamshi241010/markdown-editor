import React, { useState } from "react";
import { api } from "../services/api.js";
import { FileText, Lock, Mail, Sparkles, User as UserIcon, Sun, Moon } from "lucide-react";

export default function AuthPage({ onAuthSuccess, theme, toggleTheme }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error("Please fill in email and password fields.");
      }
      if (isRegister && !username.trim()) {
        throw new Error("Please specify a display name.");
      }

      let res;
      if (isRegister) {
        res = await api.auth.register( username.trim(),email.trim(), password);
      } else {
        res = await api.auth.login(email.trim(), password);
      }

      if (res && res.token && res.user) {
        localStorage.setItem("crm_token", res.token);
        localStorage.setItem("crm_user", JSON.stringify(res.user));
        onAuthSuccess(res.user);
      } else {
        throw new Error("Authentication failed due to an unexpected server response.");
      }
    } catch (err) {
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    // Generate an automatic dummy guest profile
    const randomSeed = Math.floor(Math.random() * 1000);
    const guestUser = {
      id: `guest-${randomSeed}`,
      email: `guest-${randomSeed}@crm-local.com`,
      username: `Guest Editor ${randomSeed}`
    };
    
    // Simple encoding
    const payload = {
      id: guestUser.id,
      email: guestUser.email,
      username: guestUser.username,
      exp: Date.now() + 24 * 60 * 60 * 1000
    };
    const dummyToken = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    localStorage.setItem("crm_token", dummyToken);
    localStorage.setItem("crm_user", JSON.stringify(guestUser));
    onAuthSuccess(guestUser);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-150 relative ${
      theme === "dark" ? "bg-zinc-955 bg-zinc-950" : "bg-zinc-50"
    }`} id="auth-page">
      {/* Floating Theme toggle */}
      <div className="absolute top-4 right-4 animate-fade-in">
        <button
          onClick={toggleTheme}
          type="button"
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
      </div>

      <div className={`w-full max-w-md border rounded-2xl shadow-xl overflow-hidden p-8 flex flex-col gap-6 relative transition-all ${
        theme === "dark" ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
      }`}>
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600"></div>

        {/* Logo and Greeting */}
        <div className="text-center space-y-2">
          <div className={`w-12 h-12 border rounded-xl flex items-center justify-center mx-auto shadow-sm ${
            theme === "dark" ? "bg-indigo-950/40 border-indigo-900 text-indigo-400" : "bg-indigo-50 border-indigo-100 text-indigo-500"
          }`}>
            <FileText className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className={`text-2xl font-bold font-sans tracking-tight ${
            theme === "dark" ? "text-white" : "text-zinc-950"
          }`}>
            SyncMD Collaborative
          </h1>
          <p className={`text-sm font-sans ${
            theme === "dark" ? "text-zinc-400" : "text-zinc-500"
          }`}>
            Collaborative Markdown documents updated in real-time.
          </p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className={`p-3 text-xs border rounded-lg font-medium leading-relaxed animate-fade-in ${
            theme === "dark" ? "bg-red-955/40 border-red-900/60 text-red-400" : "bg-red-50 border-red-100 text-red-600"
          }`} id="auth-error">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 font-sans ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-600"
            }`}>
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-450 pointer-events-none">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm transition-colors font-sans focus:outline-hidden focus:border-indigo-505 focus:ring-1 focus:ring-indigo-500 ${
                  theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-500" : "bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 hover:border-zinc-300"
                }`}
                id="auth-email-input"
                required
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 font-sans ${
                theme === "dark" ? "text-zinc-400" : "text-zinc-600"
              }`}>
                Display Name (Username)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-450 pointer-events-none">
                  <UserIcon className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Alice Editor"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm transition-colors font-sans focus:outline-hidden focus:border-indigo-505 focus:ring-1 focus:ring-indigo-500 ${
                    theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-500" : "bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 hover:border-zinc-300"
                  }`}
                  id="auth-username-input"
                  required={isRegister}
                />
              </div>
            </div>
          )}

          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 font-sans ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-600"
            }`}>
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-450 pointer-events-none">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                placeholder="password (at least 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm transition-colors font-sans focus:outline-hidden focus:border-indigo-505 focus:ring-1 focus:ring-indigo-500 ${
                  theme === "dark" ? "bg-zinc-955 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-500" : "bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 hover:border-zinc-300"
                }`}
                id="auth-password-input"
                minLength={6}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50 transition-colors shadow-sm select-none cursor-pointer font-sans"
            id="auth-submit-btn"
          >
            {loading ? "Authenticating..." : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        {/* Mode Toggle Button */}
        <div className={`flex flex-col gap-3 pt-4 border-t mt-2 text-center text-xs font-sans ${
          theme === "dark" ? "border-zinc-800 text-zinc-400" : "border-zinc-100 text-zinc-500"
        }`}>
          <div>
            {isRegister ? "Already have an account?" : "Need a professional account?"}{" "}
            <button
              onClick={() => {
                setError(null);
                setIsRegister(!isRegister);
              }}
              className="text-indigo-600 hover:text-indigo-750 font-semibold hover:underline cursor-pointer"
            >
              {isRegister ? "Sign In instead" : "Create one now"}
            </button>
          </div>

          <div className="relative py-2 select-none">
            <div className="absolute inset-0 flex items-center">
              <div className={`w-full border-t ${theme === "dark" ? "border-zinc-800" : "border-zinc-100"}`}></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className={`px-2 select-none ${theme === "dark" ? "bg-zinc-900 text-zinc-500" : "bg-white text-zinc-400"}`}>
                or bypass auth
              </span>
            </div>
          </div>

          {/* Quick Demo/Guest Portal */}
          <button
            onClick={handleDemoLogin}
            className={`w-full py-2 border rounded-lg text-xs font-semibold hover:bg-opacity-90 transition-colors cursor-pointer flex items-center justify-center gap-2 ${
              theme === "dark" 
                ? "bg-emerald-955/40 border-emerald-900/60 text-emerald-400 hover:bg-emerald-900/30" 
                : "bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100"
            }`}
            id="demo-login-btn"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Sign in as Anonymous Guest Creator
          </button>
        </div>
      </div>
    </div>
  );
}
