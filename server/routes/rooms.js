import express from "express";
import fs from "fs";
import path from "path";
import Room from "../models/Room.js";
import Participant from "../models/RoomParticipant.js";
import Message from "../models/RoomMessage.js";
import Bookmark from "../models/RoomBookmark.js";
import Session from "../models/RoomSession.js";
import Pdf from "../models/RoomPDF.js";
import Annotation from "../models/Annotation.js";
import { PDF_DIR } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { handleRoomDeletion } from "../websocket.js";

const router = express.Router();

// Helper to generate 6-character room code (uppercase string)
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/rooms - list public rooms + user's rooms
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all rooms
    const allRooms = await Room.find({}).lean();

    // Get all room IDs where user is a participant
    const userParticipations = await Participant.find({ userId }).lean();
    const userRoomIds = userParticipations.map(p => p.roomId);

    // Filter rooms: either isPublic is true OR user is the host OR user is a participant
    const filteredRooms = allRooms.filter(room => {
      return room.isPublic === true || room.hostId === userId || userRoomIds.includes(room._id);
    });

    // Populate participant counts and host usernames if needed
    for (const room of filteredRooms) {
      const parts = await Participant.find({ roomId: room._id }).lean();
      room.participantCount = parts.length;
    }

    res.json(filteredRooms);
  } catch (err) {
    console.error("Error fetching rooms:", err);
    res.status(500).json({ error: "Failed to fetch rooms." });
  }
});

// POST /api/rooms - create room
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, subject, tags, isPublic } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    if (!name || !subject) {
      res.status(400).json({ error: "Room name and subject are required." });
      return;
    }

    const code = generateRoomCode();
    const newRoom = await Room.create({
      name,
      subject,
      tags: tags || [],
      isPublic: isPublic !== false, // default to true
      hostId: userId,
      code,
      participantCount: 1,
      lastActive: new Date().toISOString()
    });

    // Create participant entry for host
    console.log("REQ USER:", req.user);
console.log("USER ID:", req.user.id);
    await Participant.create({
      roomId: newRoom._id,
      userId,
      username,
      role: "host",
      joinedAt: new Date().toISOString()
    });

    res.status(201).json(newRoom);
  } catch (err) {
    console.error("Error creating room:", err);
    res.status(500).json({ error: "Failed to create room." });
  }
});

// GET /api/rooms/:roomId - get room details
router.get("/:roomId", authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ _id: roomId }).lean();

    if (!room) {
      res.status(404).json({ error: "Room not found." });
      return;
    }

    // Get active participants
    const participants = await Participant.find({ roomId }).lean();
    room.participants = participants;

    res.json({ ...room, participants });
  } catch (err) {
    console.error("Error fetching room details:", err);
    res.status(500).json({ error: "Failed to fetch room details." });
  }
});

// POST /api/rooms/join - join via room code
router.post("/join", authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    if (!code) {
      res.status(400).json({ error: "Room code is required." });
      return;
    }

    const uppercaseCode = code.trim().toUpperCase();
    const room = await Room.findOne({ code: uppercaseCode }).lean();

    if (!room) {
      res.status(404).json({ error: "Invalid room code." });
      return;
    }

    // Check if already a participant
    const existingPart = await Participant.findOne({ roomId: room._id, userId }).lean();
    if (!existingPart) {
        console.log("REQ USER:", req.user);
console.log("USER ID:", req.user.id);
      // Add as a listener
      await Participant.create({
        roomId: room._id,
        userId,
        username,
        role: "listener",
        joinedAt: new Date().toISOString()
      });
    }

    res.json({ success: true, roomId: room._id });
  } catch (err) {
    console.error("Error joining room:", err);
    res.status(500).json({ error: "Failed to join room." });
  }
});

// DELETE /api/rooms/:roomId - delete room (host only)
router.delete("/:roomId", authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const room = await Room.findOne({ _id: roomId }).lean();
    if (!room) {
      res.status(404).json({ error: "Room not found." });
      return;
    }

    if (room.hostId !== userId) {
      res.status(403).json({ error: "Only the host can delete this room." });
      return;
    }

    // Archive session history before deleting
    const chatLog = await Message.find({ roomId }).lean();
    await Session.create({
      roomId,
      startedAt: room.createdAt,
      endedAt: new Date().toISOString(),
      chatLog: chatLog || [],
      whiteboardSnapshot: "" // optional, can be set in WS
    });

    // Delete records associated with the room
    await Room.deleteOne({ _id: roomId });
    await Participant.deleteMany({ roomId });
    await Message.deleteMany({ roomId });
    await Bookmark.deleteMany({ roomId });
    await Annotation.deleteMany({ roomId });
    await Pdf.deleteMany({ roomId });

    // Try to physically delete the uploaded PDF from disk if it exists
    const filePath = path.join(PDF_DIR, `${roomId}.pdf`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.error("Failed to delete physical PDF file on disk:", unlinkErr);
      }
    }

    // Notify and terminate all active websocket sessions for this room in real-time
    try {
      handleRoomDeletion(roomId);
    } catch (wsErr) {
      console.error("Error cleaning up WS sessions for deleted room:", wsErr);
    }

    res.json({ success: true, message: "Room deleted and session archived." });
  } catch (err) {
    console.error("Error deleting room:", err);
    res.status(500).json({ error: "Failed to delete room." });
  }
});

// GET /api/rooms/:roomId/messages - chat history
router.get("/:roomId/messages", authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await Message.find({ roomId }).lean();
    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Failed to fetch chat history." });
  }
});

// GET /api/rooms/:roomId/bookmarks - get bookmarks
router.get("/:roomId/bookmarks", authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const bookmarks = await Bookmark.find({ roomId }).lean();
    res.json(bookmarks);
  } catch (err) {
    console.error("Error fetching bookmarks:", err);
    res.status(500).json({ error: "Failed to fetch bookmarks." });
  }
});

// POST /api/rooms/:roomId/bookmarks - add bookmark
router.post("/:roomId/bookmarks", authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { pageNumber, note } = req.body;
    const userId = req.user.id;

    if (pageNumber === undefined || pageNumber === null) {
      res.status(400).json({ error: "Page number is required." });
      return;
    }

    const bookmark = await Bookmark.create({
      roomId,
      userId,
      pageNumber,
      note: note || "",
      createdAt: new Date().toISOString()
    });

    res.status(201).json(bookmark);
  } catch (err) {
    console.error("Error adding bookmark:", err);
    res.status(500).json({ error: "Failed to add bookmark." });
  }
});

// DELETE /api/rooms/:roomId/bookmarks/:bookmarkId - delete bookmark
router.delete("/:roomId/bookmarks/:bookmarkId", authMiddleware, async (req, res) => {
  try {
    const { roomId, bookmarkId } = req.params;
    const userId = req.user.id;

    const bookmark = await Bookmark.findOne({ _id: bookmarkId, roomId });
    if (!bookmark) {
      res.status(404).json({ error: "Bookmark not found." });
      return;
    }

    const room = await Room.findOne({ _id: roomId }).lean();
    const isHost = room && room.hostId === userId;
    if (bookmark.userId !== userId && !isHost) {
      res.status(403).json({ error: "You are not authorized to delete this bookmark." });
      return;
    }

    await Bookmark.deleteOne({ _id: bookmarkId });
    res.json({ success: true, message: "Bookmark deleted successfully." });
  } catch (err) {
    console.error("Error deleting bookmark:", err);
    res.status(500).json({ error: "Failed to delete bookmark." });
  }
});

// GET /api/rooms/:roomId/sessions - session history
router.get("/:roomId/sessions", authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const sessions = await Session.find({ roomId }).lean();
    res.json(sessions);
  } catch (err) {
    console.error("Error fetching sessions:", err);
    res.status(500).json({ error: "Failed to fetch session history." });
  }
});

export default router;
