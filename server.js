import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { router as apiRouter } from "./server/routes.js";
import { setupWebSocketServer } from "./server/websocket.js";
import roomRoutes from "./server/routes/rooms.js";
import pdfRoutes from "./server/routes/pdf.js";
// Load env variables
dotenv.config();
async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // JSON parsing and static routes setup
  app.use(express.json());
  app.use("/api/rooms", roomRoutes);
  app.use("/api/pdf", pdfRoutes);

  // API endpoints prefixing
  app.use("/api", apiRouter);

  // Healthcheck endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  const server = http.createServer(app);

  // Configure WebSocket server attached to the HTTP server
  setupWebSocketServer(server);

  // Integration with Vite
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    // SPA Fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Express and WebSocket server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical error starting backend server:", err);
});
