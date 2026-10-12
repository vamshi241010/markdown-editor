// const API_BASE = "/api";

// function getHeaders(extraHeaders = {}) {
//   const token = localStorage.getItem("token");
//   const headers = {
//     ...extraHeaders,
//     "Content-Type": "application/json"
//   };
//   if (token) {
//     headers["Authorization"] = `Bearer ${token}`;
//   }
//   return headers;
// }

// async function request(url, options = {}) {
//   const config = {
//     ...options,
//     headers: {
//       ...getHeaders(),
//       ...(options.headers || {})
//     }
//   };

//   const response = await fetch(`${API_BASE}${url}`, config);
  
//   if (!response.ok) {
//     let errMsg = "An error occurred";
//     try {
//       const errData = await response.json();
//       errMsg = errData.error || errMsg;
//     } catch {
//       // Ignored
//     }
//     throw new Error(errMsg);
//   }

//   if (response.status === 204) return null;
//   return response.json();
// }

// export const api = {
//   auth: {
//     register(email, username, password) {
//       return request("/auth/register", {
//         method: "POST",
//         body: JSON.stringify({ email, username, password })
//       });
//     },
//     login(email, password) {
//       return request("/auth/login", {
//         method: "POST",
//         body: JSON.stringify({ email, password })
//       });
//     }
//   },
//   rooms: {
//     async list() {
//       const res = await fetch(`${API_BASE_URL}/rooms`, {
//         headers: getHeaders(),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to fetch rooms.");
//       return data;
//     },

//     async create({ name, subject, tags, isPublic }) {
//       const res = await fetch(`${API_BASE_URL}/rooms`, {
//         method: "POST",
//         headers: getHeaders({ "Content-Type": "application/json" }),
//         body: JSON.stringify({ name, subject, tags, isPublic }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to create room.");
//       return data;
//     },

//     async get(roomId) {
//       const res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
//         headers: getHeaders(),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to fetch room details.");
//       return data;
//     },

//     async join(code) {
//       const res = await fetch(`${API_BASE_URL}/rooms/join`, {
//         method: "POST",
//         headers: getHeaders({ "Content-Type": "application/json" }),
//         body: JSON.stringify({ code }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to join room.");
//       return data;
//     },

//     async delete(roomId) {
//       const res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
//         method: "DELETE",
//         headers: getHeaders(),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to delete room.");
//       return data;
//     },

//     async getMessages(roomId) {
//       const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/messages`, {
//         headers: getHeaders(),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to fetch messages.");
//       return data;
//     },

//     async getBookmarks(roomId) {
//       const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/bookmarks`, {
//         headers: getHeaders(),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to fetch bookmarks.");
//       return data;
//     },

//     async addBookmark(roomId, { pageNumber, note }) {
//       const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/bookmarks`, {
//         method: "POST",
//         headers: getHeaders({ "Content-Type": "application/json" }),
//         body: JSON.stringify({ pageNumber, note }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to add bookmark.");
//       return data;
//     },

//     async deleteBookmark(roomId, bookmarkId) {
//       const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/bookmarks/${bookmarkId}`, {
//         method: "DELETE",
//         headers: getHeaders(),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to delete bookmark.");
//       return data;
//     },

//     async getSessions(roomId) {
//       const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/sessions`, {
//         headers: getHeaders(),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to fetch session history.");
//       return data;
//     },
//   },
//   documents: {
//     list() {
//       return request("/documents");
//     },
//     create(title, content) {
//       return request("/documents", {
//         method: "POST",
//         body: JSON.stringify({ title, content })
//       });
//     },
//     get(docId) {
//       return request(`/documents/${docId}`);
//     },
//     update(docId, updates) {
//       return request(`/documents/${docId}`, {
//         method: "PUT",
//         body: JSON.stringify(updates)
//       });
//     },
//     delete(docId) {
//       return request(`/documents/${docId}`, {
//         method: "DELETE"
//       });
//     },
//     share(docId, collaboratorEmail) {
//       return request(`/documents/${docId}/share`, {
//         method: "POST",
//         body: JSON.stringify({ collaboratorEmail })
//       });
//     }
//   },
//   pdf: {
//     async upload(roomId, file) {
//       const formData = new FormData();
//       formData.append("pdf", file);

//       const res = await fetch(`${API_BASE_URL}/pdf/upload/${roomId}`, {
//         method: "POST",
//         headers: getHeaders(), // Don't set Content-Type, fetch will automatically set boundary for FormData
//         body: formData,
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to upload PDF.");
//       return data;
//     },

//     getDownloadUrl(roomId) {
//       return `${API_BASE_URL}/pdf/${roomId}`;
//     }
//   }
// };

const API_BASE_URL = "/api";

// Helper to get headers with JWT token automatically
function getHeaders(extraHeaders = {}) {
  const token = localStorage.getItem("crm_token");
  const headers = {
    ...extraHeaders,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // ===== AUTH (shared) =====
  auth: {
    async register(username, email, password) {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register.");
      return data;
    },

    async login(email, password) {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to login.");
      return data;
    },

    logout() {
      localStorage.removeItem("crm_token");
      localStorage.removeItem("crm_user");
    },

    getCurrentUser() {
      try {
        const userStr = localStorage.getItem("crm_user");
        return userStr ? JSON.parse(userStr) : null;
      } catch (e) {
        return null;
      }
    },

    isAuthenticated() {
      return !!localStorage.getItem("crm_token");
    }
  },

  // ===== DOCUMENTS (markdown editor) =====
  documents: {
    async list() {
      const res = await fetch(`${API_BASE_URL}/documents`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch documents.");
      return data;
    },

    async create(title, content) {
      const res = await fetch(`${API_BASE_URL}/documents`, {
        method: "POST",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create document.");
      return data;
    },

    async get(docId) {
      const res = await fetch(`${API_BASE_URL}/documents/${docId}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch document.");
      return data;
    },

    async update(docId, updates) {
      const res = await fetch(`${API_BASE_URL}/documents/${docId}`, {
        method: "PUT",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update document.");
      return data;
    },

    async delete(docId) {
      const res = await fetch(`${API_BASE_URL}/documents/${docId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete document.");
      return data;
    },

    async share(docId, collaboratorEmail) {
      const res = await fetch(`${API_BASE_URL}/documents/${docId}/share`, {
        method: "POST",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ collaboratorEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to share document.");
      return data;
    }
  },

  // ===== STUDY ROOMS =====
  rooms: {
    async list() {
      const res = await fetch(`${API_BASE_URL}/rooms`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch rooms.");
      return data;
    },

    async create({ name, subject, tags, isPublic }) {
      const res = await fetch(`${API_BASE_URL}/rooms`, {
        method: "POST",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name, subject, tags, isPublic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create room.");
      return data;
    },

    async get(roomId) {
      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch room details.");
      return data;
    },

    async join(code) {
      const res = await fetch(`${API_BASE_URL}/rooms/join`, {
        method: "POST",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join room.");
      return data;
    },

    async delete(roomId) {
      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete room.");
      return data;
    },

    async getMessages(roomId) {
      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/messages`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch messages.");
      return data;
    },

    async getBookmarks(roomId) {
      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/bookmarks`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch bookmarks.");
      return data;
    },

    async addBookmark(roomId, { pageNumber, note }) {
      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/bookmarks`, {
        method: "POST",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ pageNumber, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add bookmark.");
      return data;
    },

    async deleteBookmark(roomId, bookmarkId) {
      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/bookmarks/${bookmarkId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete bookmark.");
      return data;
    },

    async getSessions(roomId) {
      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/sessions`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch session history.");
      return data;
    },
  },

  // ===== PDF (study rooms) =====
  pdf: {
    async upload(roomId, file) {
      const formData = new FormData();
      formData.append("pdf", file);

      const res = await fetch(`${API_BASE_URL}/pdf/upload/${roomId}`, {
        method: "POST",
        headers: getHeaders(), // Don't set Content-Type, fetch will automatically set boundary for FormData
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload PDF.");
      return data;
    },

    getDownloadUrl(roomId) {
      return `${API_BASE_URL}/pdf/${roomId}`;
    }
  }
};
