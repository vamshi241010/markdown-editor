import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import Pdf from "../models/RoomPDF.js";
import { PDF_DIR } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import RoomParticipant from "../models/RoomParticipant.js";
const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PDF_DIR);
  },
  filename: (req, file, cb) => {
    const { roomId } = req.params;
    // Save as [roomId].pdf so it's clean and easy to retrieve
    cb(null, `${roomId}.pdf`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed."));
    }
  }
});

// POST /api/pdf/upload/:roomId
router.post("/upload/:roomId", authMiddleware, async(req, res, next) => {
    try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Check if user is participant and has host or speaker role
    const participant = await RoomParticipant.findOne({ roomId, userId }).lean();
    if (!participant || (participant.role !== "host" && participant.role !== "speaker")) {
      res.status(403).json({ error: "Only the host or approved speakers can upload PDFs." });
      return;
    }
  upload.single("pdf")(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message || "Failed to upload file." });
      return;
    }
    
    try {
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: "No file was uploaded." });
        return;
      }

      // Check if a PDF record already exists for this room, delete it first
      const existingPdf = await Pdf.findOne({ roomId }).lean();
      if (existingPdf) {
        await Pdf.deleteMany({ roomId });
      }

      const newPdfRecord = await Pdf.create({
        roomId,
        filename: file.originalname,
        gridfsId: file.filename, // We use the filename as gridfsId for custom storage
        uploadedAt: new Date().toISOString(),
        uploadedBy: userId
      });

      res.status(201).json(newPdfRecord);
    } catch (dbErr) {
      console.error("Database error saving PDF metadata:", dbErr);
      res.status(500).json({ error: "File saved but metadata creation failed." });
    }
  });
}catch (err) {
    console.error("Authorization check failed before PDF upload:", err);
    res.status(500).json({ error: "Authorization failed." });
  }
});

// GET /api/pdf/:roomId
router.get("/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const pdfRecord = await Pdf.findOne({ roomId }).lean();

    if (!pdfRecord) {
      res.status(404).json({ error: "No PDF found for this room." });
      return;
    }

    const filePath = path.join(PDF_DIR, `${roomId}.pdf`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "PDF file not found on server." });
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${pdfRecord.filename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error("Error streaming PDF file:", err);
    res.status(500).json({ error: "Failed to stream PDF." });
  }
});

// GET /api/pdf/worker/pdf.worker.min.mjs
router.get("/worker/pdf.worker.min.mjs", (req, res) => {
  try {
    const filePath = path.join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
    if (!fs.existsSync(filePath)) {
      res.status(404).send("Worker file not found on server.");
      return;
    }
    res.setHeader("Content-Type", "application/javascript");
    res.sendFile(filePath);
  } catch (err) {
    console.error("Error sending PDF worker:", err);
    res.status(500).send("Internal server error");
  }
});

export default router;
