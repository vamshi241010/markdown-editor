import { WebSocketServer,WebSocket } from "ws";
import * as Y from "yjs";
import "./db.js";
import { Document as MongoDocument } from "./models/Document.js";
import { Presence } from "./models/Presence.js";
import RoomParticipant from "./models/RoomParticipant.js";
import RoomMessage from "./models/RoomMessage.js";
import Room from "./models/Room.js";

// ===== MARKDOWN EDITOR STATE =====
const activeYDocs = new Map(); // docId -> Y.Doc
const markdownRooms = new Map(); // docId -> Set of sockets
const saveDebounceTimers = new Map(); // docId -> setTimeout id
const rateLimits = new Map(); // userKey -> { count, resetTime }

// ===== STUDY ROOM STATE =====
const studyRooms = new Map(); // roomId -> Set of sockets
const roomsState = new Map(); // roomId -> { presenterMode, freeScroll, currentPage, pomodoro, etc }

// ===== SHARED STATE =====
const sessions = new Map(); // socket -> { type: 'markdown'|'study-room', ... }

// Regular cleanup of old presence in MongoDB
setInterval(async () => {
  const cutoff = new Date(Date.now() - 300000);
  await Presence.deleteMany({ lastActive: { $lt: cutoff } });
}, 20000);

export function setupWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);

    if (url.pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws) => {
    console.log("Client Connected");

    ws.on("message", async (messageStr) => {
      try {
        const msg = JSON.parse(messageStr);

        // ===== RATE LIMITING (markdown editor) =====
        if (msg.docId && msg.userId) {
          const limitKey = `${msg.userId}:${msg.docId}`;
          const now = Date.now();
          if (!rateLimits.has(limitKey)) {
            rateLimits.set(limitKey, { count: 0, resetTime: now + 1000 });
          }
          const limit = rateLimits.get(limitKey);
          if (now > limit.resetTime) {
            limit.count = 0;
            limit.resetTime = now + 1000;
          }
          limit.count++;
          if (limit.count > 100) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Rate limit exceeded (100 updates/sec)"
              })
            );
            return;
          }
        }

        // ===== MARKDOWN EDITOR HANDLERS =====
        if (
          msg.type === "join" ||
          msg.type === "update" ||
          msg.type === "presence"
        ) {
          handleMarkdownMessage(ws, msg);
          return;
        }

        // ===== STUDY ROOM HANDLERS =====
        if (msg.type.startsWith("study-") || 
            msg.type === "page-change" ||
            msg.type === "presenter-mode" ||
            msg.type === "free-scroll" ||
            msg.type === "role-change" ||
            msg.type === "kick-user" ||
            msg.type === "raise-hand" ||
            msg.type === "hand-approved" ||
            msg.type === "hand-denied" ||
            msg.type === "reaction" ||
            msg.type === "pomodoro-start" ||
            msg.type === "whiteboard-sync" ||
            msg.type === "annotations-sync" ||
            msg.type === "chat-message" ||
            msg.type === "chat-clear" ||
            msg.type === "view-mode-change") {
          handleStudyRoomMessage(ws, msg);
          return;
        }

        // ===== SHARED HANDLERS =====
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (err) {
        console.error("Error processing WebSocket message:", err);
      }
    });

    ws.on("close", async () => {
      const session = sessions.get(ws);
      if (!session) return;

      if (session.type === "markdown") {
        await handleMarkdownDisconnect(ws, session);
      } else if (session.type === "study-room") {
        await handleStudyRoomDisconnect(ws, session);
      }
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
    });
  });

  // ===== MARKDOWN EDITOR FUNCTIONS =====

  async function handleMarkdownMessage(ws, msg) {
    switch (msg.type) {
      case "join": {
        const { docId, userId, username, color } = msg;
        if (!docId || !userId) return;

        let yDoc = activeYDocs.get(docId);
        if (!yDoc) {
          yDoc = new Y.Doc();
          const existingDoc = await MongoDocument.findOne({ docId }).lean();

          if (existingDoc?.content) {
            yDoc.getText("markdown").insert(0, existingDoc.content);
          }

          activeYDocs.set(docId, yDoc);
        }

        if (!markdownRooms.has(docId))
          markdownRooms.set(docId, new Set());
        markdownRooms.get(docId).add(ws);

        sessions.set(ws, {
          type: "markdown",
          socket: ws,
          docId,
          userId,
          username: username || "Anonymous User",
          color: color || "#3B82F6",
          lastActive: Date.now()
        });

        await Presence.findOneAndUpdate(
          { docId, userId },
          {
            $set: {
              docId,
              userId,
              username: username || "Anonymous User",
              color: color || "#3B82F6",
              cursor: undefined,
              lastActive: new Date()
            }
          },
          { upsert: true }
        );

        const stateBinary = Y.encodeStateAsUpdate(yDoc);
        const stateBase64 = Buffer.from(stateBinary).toString("base64");
        ws.send(
          JSON.stringify({ type: "sync-init", yState: stateBase64 })
        );

        await broadcastMarkdownPresence(docId);
        break;
      }

      case "update": {
        const session = sessions.get(ws);
        if (!session || session.type !== "markdown") return;
        const { docId } = session;

        const yDoc = activeYDocs.get(docId);
        if (!yDoc) return;

        try {
          const binaryUpdate = Buffer.from(msg.update, "base64");
          Y.applyUpdate(yDoc, binaryUpdate);
        } catch (err) {
          console.error("Error applying Yjs update:", err);
          return;
        }

        broadcastMarkdownToRoom(docId, ws, {
          type: "update",
          update: msg.update,
          userId: session.userId
        });

        if (saveDebounceTimers.has(docId)) {
          clearTimeout(saveDebounceTimers.get(docId));
        }
        saveDebounceTimers.set(
          docId,
          setTimeout(async () => {
            try {
              const textContent = yDoc.getText("markdown").toString();
              await MongoDocument.findOneAndUpdate(
                { docId },
                { $set: { content: textContent, updated: new Date() } }
              );
              console.log(`Debounced save for ${docId}`);
            } catch (err) {
              console.error(`Save failed for ${docId}:`, err);
            } finally {
              saveDebounceTimers.delete(docId);
            }
          }, 500)
        );

        break;
      }

      case "presence": {
        const session = sessions.get(ws);
        if (!session || session.type !== "markdown") return;
        const { docId, userId, username, color } = session;

        session.lastActive = Date.now();

        await Presence.findOneAndUpdate(
          { docId, userId },
          {
            $set: {
              docId,
              userId,
              username,
              color,
              cursor: msg.cursor,
              lastActive: new Date()
            }
          },
          { upsert: true }
        );

        broadcastMarkdownToRoom(docId, ws, {
          type: "presence-update",
          userId,
          username,
          color,
          cursor: msg.cursor
        });
        break;
      }
    }
  }

  async function handleMarkdownDisconnect(ws, session) {
    const { docId, userId } = session;
    sessions.delete(ws);

    if (markdownRooms.has(docId)) {
      const room = markdownRooms.get(docId);
      room.delete(ws);

      if (saveDebounceTimers.has(docId)) {
        clearTimeout(saveDebounceTimers.get(docId));
        saveDebounceTimers.delete(docId);
      }

      const yDoc = activeYDocs.get(docId);
      if (yDoc) {
        try {
          const textContent = yDoc.getText("markdown").toString();
          await MongoDocument.findOneAndUpdate(
            { docId },
            { $set: { content: textContent, updated: new Date() } }
          );
          console.log(
            `Saved on disconnect for ${docId}:`,
            textContent.slice(0, 60)
          );
        } catch (err) {
          console.error(`Disconnect save failed for ${docId}:`, err);
        }
      }

      if (room.size === 0) {
        markdownRooms.delete(docId);
        setTimeout(() => {
          if (!markdownRooms.has(docId)) {
            activeYDocs.delete(docId);
          }
        }, 3000);
      }
    }

    await Presence.deleteMany({ docId, userId });
    await broadcastMarkdownPresence(docId);
  }

  async function broadcastMarkdownPresence(docId) {
    const cutoff = new Date(Date.now() - 300000);
    const list = await Presence.find({
      docId,
      lastActive: { $gt: cutoff }
    }).lean();
    const room = markdownRooms.get(docId);
    if (!room) return;

    const payload = JSON.stringify({
      type: "room-presence",
      users: list
    });

    room.forEach((client) => {
      if (client.readyState === 1) {
        client.send(payload);
      }
    });
  }

  function broadcastMarkdownToRoom(docId, senderWs, payloadObj) {
    const room = markdownRooms.get(docId);
    if (!room) return;

    const payload = JSON.stringify(payloadObj);
    room.forEach((client) => {
      if (client !== senderWs && client.readyState === 1) {
        client.send(payload);
      }
    });
  }

  // ===== STUDY ROOM FUNCTIONS =====

  async function handleStudyRoomMessage(ws, msg) {
    const { type, roomId, payload } = msg;

    switch (type) {
      case "study-join": {
        const { userId, username, role } = payload;

        sessions.set(ws, {
          type: "study-room",
          socket: ws,
          roomId,
          userId,
          username,
          role: role || "listener",
          currentPage: 1,
          onWhiteboard: false
        });

        if (!studyRooms.has(roomId)) {
          studyRooms.set(roomId, new Set());
        }
        studyRooms.get(roomId).add(ws);

        if (!roomsState.has(roomId)) {
          roomsState.set(roomId, {
            presenterMode: false,
            freeScroll: true,
            currentPage: 1,
            onWhiteboard: false,
             whiteboardPanOffset: { x: 0, y: 0 },
                whiteboardZoom: 1.0,
            pomodoro: {
              active: false,
              duration: 1500,
              timeLeft: 1500,
              isBreak: false
            },
            raisedHands: []
          });
        }

        const rState = roomsState.get(roomId);

        await RoomMessage.create({
          roomId,
          userId: "system",
          username: "System",
          text: `${username} joined the study room as a ${role || "listener"}.`,
          type: "system"
        });

        broadcastStudyRoom(roomId, {
          type: "study-join",
          roomId,
          payload: {
            userId,
            username,
            role: role || "listener",
            currentPage: 1,
            onWhiteboard: false,
            presenceList: getStudyPresenceList(roomId),
            roomConfig: {
              presenterMode: rState.presenterMode,
              freeScroll: rState.freeScroll,
              currentPage: rState.currentPage,
              onWhiteboard: rState.onWhiteboard,
              whiteboardState: rState.whiteboardYDocState || "",
              whiteboardPanOffset: rState.whiteboardPanOffset || { x: 0, y: 0 },
              whiteboardZoom: rState.whiteboardZoom || 1.0,
              pomodoro: {
                active: rState.pomodoro.active,
                timeLeft: rState.pomodoro.timeLeft,
                duration: rState.pomodoro.duration,
                isBreak: rState.pomodoro.isBreak
              }
            }
          }
        });
        break;
      }
 case "pomodoro-stop": {
  const session = sessions.get(ws);

  if (
    !session ||
    session.type !== "study-room" ||
    session.role !== "host"
  ) {
    return;
  }

  const rState = roomsState.get(session.roomId);
  if (!rState) return;

  if (rState.pomodoro.timerId) {
    clearInterval(rState.pomodoro.timerId);
    rState.pomodoro.timerId = null;
  }

  rState.pomodoro.active = false;
  rState.pomodoro.timeLeft = 0;

  broadcastStudyRoom(session.roomId, {
    type: "pomodoro-stop",
    roomId: session.roomId,
    payload: {
      active: false,
      timeLeft: 0,
      duration: rState.pomodoro.duration,
      isBreak: rState.pomodoro.isBreak
    }
  });

  break;
}
case "whiteboard-view-sync": {
            const session = sessions.get(ws);
            if (!session) return;

            const rState = roomsState.get(session.roomId);
            if (!rState) return;

            // Host/Speaker can move the whiteboard for everyone
            if (session.role === "host" || session.role === "speaker") {
              rState.whiteboardPanOffset = payload.panOffset;
              rState.whiteboardZoom = payload.zoom;

              // Broadcast view state to other sessions in the room
              broadcastToRoom(session.roomId, {
                type: "whiteboard-view-sync",
                roomId: session.roomId,
                payload: {
                  panOffset: payload.panOffset,
                  zoom: payload.zoom,
                  userId: session.userId
                }
              }, ws);
            }
            break;
          }

      case "page-change": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room") return;

        const rState = roomsState.get(session.roomId);
        if (!rState) return;

        session.currentPage = payload.page;

        if (rState.presenterMode && session.role === "host") {
          rState.currentPage = payload.page;
          broadcastStudyRoom(session.roomId, {
            type: "page-change",
            roomId: session.roomId,
            payload: {
              page: payload.page,
              username: session.username,
              presenceList: getStudyPresenceList(session.roomId)
            }
          });
        } else {
          broadcastStudyRoom(session.roomId, {
            type: "presence-update",
            roomId: session.roomId,
            payload: {
              presenceList: getStudyPresenceList(session.roomId)
            }
          });
        }
        break;
      }
      case "pdf-uploaded": {
            const session = sessions.get(ws);
            if (!session) return;

            if (session.role !== "host" && session.role !== "speaker") return;

            broadcastStudyRoom(session.roomId, {
              type: "pdf-uploaded",
              roomId: session.roomId,
              payload: {
                uploadedBy: session.username
              }
            }, ws);
            break;
          }
      case "presenter-mode": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room" || session.role !== "host")
          return;

        const rState = roomsState.get(session.roomId);
        if (!rState) return;

        rState.presenterMode = payload.presenterMode;
        if (payload.presenterMode) {
          rState.currentPage = session.currentPage;
        }

        broadcastStudyRoom(session.roomId, {
          type: "presenter-mode",
          roomId: session.roomId,
          payload: {
            presenterMode: rState.presenterMode,
            currentPage: rState.currentPage
          }
        });
        break;
      }

      case "free-scroll": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room" || session.role !== "host")
          return;

        const rState = roomsState.get(session.roomId);
        if (!rState) return;

        rState.freeScroll = payload.freeScroll;

        broadcastStudyRoom(session.roomId, {
          type: "free-scroll",
          roomId: session.roomId,
          payload: {
            freeScroll: rState.freeScroll
          }
        });
        break;
      }

      case "role-change": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room" || session.role !== "host")
          return;

        const { targetUserId, newRole } = payload;

        let targetSession = null;
        for (const [s, info] of sessions.entries()) {
          if (
            info.type === "study-room" &&
            info.roomId === session.roomId &&
            info.userId === targetUserId
          ) {
            info.role = newRole;
            targetSession = info;
            break;
          }
        }

        if (targetSession) {
          await RoomParticipant.updateOne(
            { roomId: session.roomId, userId: targetUserId },
            { role: newRole }
          );

          await RoomMessage.create({
            roomId: session.roomId,
            userId: "system",
            username: "System",
            text: `${targetSession.username}'s role was updated to ${newRole}.`,
            type: "system"
          });

          broadcastStudyRoom(session.roomId, {
            type: "role-change",
            roomId: session.roomId,
            payload: {
              targetUserId,
              newRole,
              presenceList: getStudyPresenceList(session.roomId)
            }
          });
        }
        break;
      }

      case "kick-user": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room" || session.role !== "host")
          return;

        const { targetUserId } = payload;

        let targetSocket = null;
        let targetUsername = "";
        for (const [s, info] of sessions.entries()) {
          if (
            info.type === "study-room" &&
            info.roomId === session.roomId &&
            info.userId === targetUserId
          ) {
            targetSocket = s;
            targetUsername = info.username;
            break;
          }
        }

        if (targetSocket) {
          await RoomParticipant.deleteOne({
            roomId: session.roomId,
            userId: targetUserId
          });

          targetSocket.send(
            JSON.stringify({
              type: "kicked",
              roomId: session.roomId
            })
          );

          handleStudyRoomDisconnect(targetSocket, sessions.get(targetSocket));
          targetSocket.close();

          await RoomMessage.create({
            roomId: session.roomId,
            userId: "system",
            username: "System",
            text: `${targetUsername} was kicked from the room by the host.`,
            type: "system"
          });

          broadcastStudyRoom(session.roomId, {
            type: "presence-update",
            roomId: session.roomId,
            payload: {
              presenceList: getStudyPresenceList(session.roomId)
            }
          });
        }
        break;
      }

      case "raise-hand": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room") return;

        const rState = roomsState.get(session.roomId);
        if (!rState) return;

        if (!rState.raisedHands.includes(session.userId)) {
          rState.raisedHands.push(session.userId);
        }

        broadcastStudyRoom(session.roomId, {
          type: "raise-hand",
          roomId: session.roomId,
          payload: {
            userId: session.userId,
            username: session.username,
            raisedHands: rState.raisedHands
          }
        });
        break;
      }

      case "hand-approved": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room" || session.role !== "host")
          return;

        const { targetUserId } = payload;
        const rState = roomsState.get(session.roomId);
        if (!rState) return;

        rState.raisedHands = rState.raisedHands.filter(
          (id) => id !== targetUserId
        );

        for (const [s, info] of sessions.entries()) {
          if (
            info.type === "study-room" &&
            info.roomId === session.roomId &&
            info.userId === targetUserId
          ) {
            info.role = "speaker";
            await RoomParticipant.updateOne(
              { roomId: session.roomId, userId: targetUserId },
              { role: "speaker" }
            );

            await RoomMessage.create({
              roomId: session.roomId,
              userId: "system",
              username: "System",
              text: `${info.username}'s raised hand was approved. They are now a Speaker.`,
              type: "system"
            });
            break;
          }
        }

        broadcastStudyRoom(session.roomId, {
          type: "hand-approved",
          roomId: session.roomId,
          payload: {
            targetUserId,
            raisedHands: rState.raisedHands,
            presenceList: getStudyPresenceList(session.roomId)
          }
        });
        break;
      }

      case "hand-denied": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room" || session.role !== "host")
          return;

        const { targetUserId } = payload;
        const rState = roomsState.get(session.roomId);
        if (!rState) return;

        rState.raisedHands = rState.raisedHands.filter(
          (id) => id !== targetUserId
        );

        broadcastStudyRoom(session.roomId, {
          type: "hand-denied",
          roomId: session.roomId,
          payload: {
            targetUserId,
            raisedHands: rState.raisedHands
          }
        });
        break;
      }

      case "reaction": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room") return;

        broadcastStudyRoom(session.roomId, {
          type: "reaction",
          roomId: session.roomId,
          payload: {
            userId: session.userId,
            username: session.username,
            reaction: payload.reaction
          }
        });
        break;
      }

      case "pomodoro-start": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room" || session.role !== "host")
          return;

        const rState = roomsState.get(session.roomId);
        if (!rState) return;

        if (rState.pomodoro.timerId) {
          clearInterval(rState.pomodoro.timerId);
        }

        const duration = payload.duration * 60;
        rState.pomodoro.active = true;
        rState.pomodoro.duration = duration;
        rState.pomodoro.timeLeft = duration;
        rState.pomodoro.isBreak = payload.isBreak || false;

        rState.pomodoro.timerId = setInterval(() => {
          const currentState = roomsState.get(session.roomId);
          if (currentState && currentState.pomodoro.active) {
            currentState.pomodoro.timeLeft--;
            if (currentState.pomodoro.timeLeft <= 0) {
              clearInterval(currentState.pomodoro.timerId);
              currentState.pomodoro.active = false;

              broadcastStudyRoom(session.roomId, {
                type: "pomodoro-end",
                roomId: session.roomId,
                payload: {
                  isBreak: currentState.pomodoro.isBreak
                }
              });
            } else {
              broadcastStudyRoom(session.roomId, {
                type: "pomodoro-sync",
                roomId: session.roomId,
                payload: {
                  active: true,
                  timeLeft: currentState.pomodoro.timeLeft,
                  duration: currentState.pomodoro.duration,
                  isBreak: currentState.pomodoro.isBreak
                }
              });
            }
          }
        }, 1000);

        broadcastStudyRoom(session.roomId, {
          type: "pomodoro-start",
          roomId: session.roomId,
          payload: {
            duration: rState.pomodoro.duration,
            timeLeft: rState.pomodoro.timeLeft,
            isBreak: rState.pomodoro.isBreak
          }
        });
        break;
      }

      case "whiteboard-sync": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room") return;

        const rState = roomsState.get(session.roomId);
        if (!rState) return;

        if (session.role === "host" || session.role === "speaker") {
          rState.whiteboardYDocState = payload.docState;

          broadcastStudyRoom(
            session.roomId,
            {
              type: "whiteboard-sync",
              roomId: session.roomId,
              payload: {
                docState: payload.docState,
                userId: session.userId
              }
            },
            ws
          );
        }
        break;
      }

      case "annotations-sync": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room") return;

        broadcastStudyRoom(
          session.roomId,
          {
            type: "annotations-sync",
            roomId: session.roomId,
            payload: {
              pageNumber: payload.pageNumber,
              elements: payload.elements,
              userId: session.userId
            }
          },
          ws
        );
        break;
      }

      case "chat-message": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room") return;

        const savedMsg = await RoomMessage.create({
          roomId: session.roomId,
          userId: session.userId,
          username: session.username,
          text: payload.text,
          type: "message"
        });

        broadcastStudyRoom(session.roomId, {
          type: "chat-message",
          roomId: session.roomId,
          payload: savedMsg
        });
        break;
      }

      case "chat-clear": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room" || session.role !== "host")
          return;

        await RoomMessage.deleteMany({ roomId: session.roomId });

        broadcastStudyRoom(session.roomId, {
          type: "chat-clear",
          roomId: session.roomId,
          payload: {}
        });
        break;
      }

      case "view-mode-change": {
        const session = sessions.get(ws);
        if (!session || session.type !== "study-room") return;

        session.onWhiteboard = payload.onWhiteboard;

        broadcastStudyRoom(session.roomId, {
          type: "presence-update",
          roomId: session.roomId,
          payload: {
            presenceList: getStudyPresenceList(session.roomId)
          }
        });
        break;
      }
    }
  }

  async function handleStudyRoomDisconnect(ws, session) {
    if (!session) return;

    const { roomId, userId, username } = session;
    sessions.delete(ws);

    if (studyRooms.has(roomId)) {
      const room = studyRooms.get(roomId);
      room.delete(ws);

      const remaining = getStudyPresenceList(roomId);

      await RoomMessage.create({
        roomId,
        userId: "system",
        username: "System",
        text: `${username} left the study room.`,
        type: "system"
      }).then((savedMsg) => {
        broadcastStudyRoom(roomId, {
          type: "study-leave",
          roomId,
          payload: {
            userId,
            presenceList: remaining,
            systemMessage: savedMsg
          }
        });
      });

      const roomSockets = Array.from(sessions.values()).filter(
        (s) => s.type === "study-room" && s.roomId === roomId
      );
      if (roomSockets.length === 0) {
        const rState = roomsState.get(roomId);
        if (rState && rState.pomodoro.timerId) {
          clearInterval(rState.pomodoro.timerId);
        }
        roomsState.delete(roomId);
        studyRooms.delete(roomId);
      } else {
        Room.updateOne(
          { _id: roomId },
          { participantCount: roomSockets.length }
        ).catch(console.error);
      }
    }
  }

  function getStudyPresenceList(roomId) {
    return Array.from(sessions.values())
      .filter((s) => s.type === "study-room" && s.roomId === roomId)
      .map((s) => ({
        userId: s.userId,
        username: s.username,
        role: s.role,
        currentPage: s.currentPage,
        onWhiteboard: s.onWhiteboard
      }));
  }

  function broadcastStudyRoom(roomId, message, excludeWs) {
    const serialized = JSON.stringify(message);
    for (const [ws, session] of sessions.entries()) {
      if (
        session.type === "study-room" &&
        session.roomId === roomId &&
        ws !== excludeWs &&
        ws.readyState === WebSocket.OPEN
      ) {
        ws.send(serialized);
      }
    }
  }
}

export function handleRoomDeletion(roomId) {
  const message = {
    type: "room-deleted",
    roomId,
    payload: { message: "This study room has been ended by the host." }
  };
  broadcastStudyRoom(roomId, message);

  const rState = roomsState.get(roomId);
  if (rState && rState.pomodoro && rState.pomodoro.timerId) {
    clearInterval(rState.pomodoro.timerId);
  }
  roomsState.delete(roomId);
  studyRooms.delete(roomId);

  for (const [ws, session] of sessions.entries()) {
    if (session.type === "study-room" && session.roomId === roomId) {
      sessions.delete(ws);
      try {
        ws.close();
      } catch (err) {
        console.error("Error closing socket on deletion:", err);
      }
    }
  }
}

// Helper to broadcast to study room (needed for export)
function broadcastStudyRoom(roomId, message, excludeWs) {
  const serialized = JSON.stringify(message);
  for (const [ws, session] of sessions.entries()) {
    if (
      session.type === "study-room" &&
      session.roomId === roomId &&
      ws !== excludeWs &&
      ws.readyState === WebSocket.OPEN
    ) {
      ws.send(serialized);
    }
  }
}