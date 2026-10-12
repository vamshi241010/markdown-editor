import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "./db.js";
import { User } from "./models/User.js";
import { Document as MongoDocument } from "./models/Document.js";
import { marked } from "marked";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

export const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "na_secret_na_istam";

// Standard JWT Generation
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

// Production JWT Authentication Middleware
export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Access token required" });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).json({ error: "Access token is invalid or expired" });
      return;
    }
    req.user = {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username
    };
    next();
  });
}

// --- Auth Endpoints ---

router.post("/auth/register", async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    res.status(400).json({ error: "Email, username, and password are required" });
    return;
  }

  const existing = await User.findOne({ email: email.toLowerCase() }).lean();
  if (existing) {
    res.status(400).json({ error: "User with this email already exists" });
    return;
  }

  const userId = "user-" + crypto.randomBytes(6).toString("hex");
  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    id: userId,
    email,
    username,
    passwordHash
  };
  await new User(newUser).save();

  const clientUser = { id: userId, email, username };
  const token = generateToken(clientUser);

  res.status(201).json({ user: clientUser, token });
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() }).lean();
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

if (!user.passwordHash) {
  console.error("Login error: passwordHash is missing from the user document.");
  return res.status(500).json({
    error: "Account password data is missing. Please check the user record."
  });
}

const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

if (!isPasswordValid) {
  return res.status(401).json({
    error: "Invalid email or password"
  });
}

  const clientUser = { id: user.id, email: user.email, username: user.username };
  const token = generateToken(clientUser);

  res.json({ user: clientUser, token });
});

// --- Document Endpoints (Protected) ---

router.get("/documents", authenticateToken, async (req, res) => {
  const user = req.user;
  const emailLower = user.email ? user.email.toLowerCase() : "";
  const docs = await MongoDocument.find({
    $or: [
      { userId: user.id },
      { collaborators: user.id },
      { collaborators: emailLower }
    ]
  }).sort({ updated: -1 }).lean();
  res.json(docs);
});

router.post("/documents", authenticateToken, async (req, res) => {
  const user = req.user;
  const { title, content } = req.body;

  const docId = "doc-" + crypto.randomBytes(8).toString("hex");
  const newDoc = {
    docId,
    userId: user.id,
    title: title || "Untitled Document",
    content: content || "",
    collaborators: [],
    created: new Date(),
    updated: new Date(),
    version: 1
  };

  await new MongoDocument(newDoc).save();
  res.status(201).json(newDoc);
});

router.get("/documents/:docId", authenticateToken, async (req, res) => {
  const user = req.user;
  const { docId } = req.params;

  const doc = await MongoDocument.findOne({ docId }).lean();
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  // Authorize check
  const hasAccess = 
    doc.userId === user.id || 
    doc.collaborators.includes(user.id) || 
    doc.collaborators.includes(user.email.toLowerCase());

  if (!hasAccess) {
    res.status(403).json({ error: "Access denied to this document" });
    return;
  }

  res.json(doc);
});

router.put("/documents/:docId", authenticateToken, async (req, res) => {
  const user = req.user;
  const { docId } = req.params;
  const { title, content, collaborators } = req.body;
  const doc = await MongoDocument.findOne({ docId }).lean();
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const hasAccess = 
    doc.userId === user.id || 
    doc.collaborators.includes(user.id) || 
    doc.collaborators.includes(user.email.toLowerCase());

  if (!hasAccess) {
    res.status(403).json({ error: "Access denied to update this document" });
    return;
  }

  const updates = {};
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (collaborators !== undefined) updates.collaborators = collaborators;
  updates.version = (doc.version || 0) + 1;

  const { docId: dId, userId, created, ...safeUpdates } = updates;
  const updatedDoc = await MongoDocument.findOneAndUpdate(
    { docId },
    { $set: { ...safeUpdates, updated: new Date() } },
    { returnDocument:"after"}
  ).lean();
  res.json(updatedDoc);
});

router.delete("/documents/:docId", authenticateToken, async (req, res) => {
  const user = req.user;
  const { docId } = req.params;

  const doc = await MongoDocument.findOne({ docId }).lean();
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  // Only owner can delete
  if (doc.userId !== user.id) {
    res.status(403).json({ error: "Only the owner can delete this document" });
    return;
  }

  await MongoDocument.deleteOne({ docId });
  res.json({ message: "Document deleted successfully" });
});

router.post("/documents/:docId/share", authenticateToken, async (req, res) => {
  const user = req.user;
  const { docId } = req.params;
  const { collaboratorEmail } = req.body;

  if (!collaboratorEmail) {
    res.status(400).json({ error: "Collaborator email is required" });
    return;
  }

  const doc = await MongoDocument.findOne({ docId }).lean();
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  if (doc.userId !== user.id) {
    res.status(403).json({ error: "Only the document owner can share it" });
    return;
  }

  const emailLower = collaboratorEmail.toLowerCase().trim();
  
  if (emailLower === user.email.toLowerCase()) {
    res.status(400).json({ error: "You are already the owner of this document" });
    return;
  }

  if (!doc.collaborators.map(c => c.toLowerCase()).includes(emailLower)) {
    const updatedCollaborators = [...doc.collaborators, emailLower];
    await MongoDocument.findOneAndUpdate(
      { docId },
      { $set: { collaborators: updatedCollaborators, updated: new Date() } }
    );
  }

  res.json({ message: `Successfully shared with ${collaboratorEmail}` });
});

// Helper for document export access check
async function checkExportAccess(req, res) {
  const user = req.user;
  const { docId } = req.params;

  const doc = await MongoDocument.findOne({ docId }).lean();
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return null;
  }

  const hasAccess = 
    doc.userId === user.id || 
    doc.collaborators.includes(user.id) || 
    doc.collaborators.includes(user.email.toLowerCase());


  if (!hasAccess) {
    res.status(433).json({ error: "Access denied to export this document" });
    return null;
  }

  return doc;
}

// GET /documents/:docId/export/md
router.get("/documents/:docId/export/md", authenticateToken, async (req, res) => {
  const doc = await checkExportAccess(req, res);
  if (!doc) return;

  const safeTitle = doc.title ? doc.title.replace(/[^a-zA-Z0-9_\-\s]/g, "") : "Document";
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeTitle)}.md"`);
  res.send(doc.content || "");
});

// GET /documents/:docId/export/html
router.get("/documents/:docId/export/html", authenticateToken, async (req, res) => {
  const doc = await checkExportAccess(req, res);
  if (!doc) return;

  const safeTitle = doc.title ? doc.title.replace(/[^a-zA-Z0-9_\-\s]/g, "") : "Document";
  const htmlBody = marked.parse(doc.content || "");
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.title || "Document"}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; color: #2d3748; background-color: #f7fafc; }
    h1, h2, h3, h4 { color: #1a202c; margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 700; }
    h1 { border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3em; margin-top: 0; }
    p { margin-top: 0; margin-bottom: 1.25em; }
    ol, ul { margin-top: 0; margin-bottom: 1.25em; padding-left: 1.5em; }
    li { margin-bottom: 0.25em; }
    code { font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace; background: #e2e8f0; padding: 0.2em 0.4em; border-radius: 3px; font-size: 85%; }
    pre { background: #2d3748; color: #f7fafc; padding: 15px; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; color: inherit; padding: 0; font-size: 100%; }
    blockquote { border-left: 4px solid #cbd5e0; color: #718096; margin: 0 0 1.5em 0; padding-left: 1em; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 1.5em; }
    th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
    th { background: #edf2f7; }
  </style>
</head>
<body>
  <h1>${doc.title || "Document"}</h1>
  ${htmlBody}
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeTitle)}.html"`);
  res.send(fullHtml);
});

// Helper to sanitize text for PDFKit standard Helvetica/Times/Courier fonts
function sanitizeForPDF(text) {
  if (!text) return "";
  
  // Replace smart quotes and standard Unicode spaces with standard ASCII equivalents
  let clean = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2212]/g, "-") // Minus sign
    .replace(/\u00A0/g, " ");   // Non-breaking space

  // Strip all emojis and high surrogate pairs
  clean = clean.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "");

  // Match and strip any other common emoji/symbol ranges
  clean = clean.replace(/[\u2700-\u27BF]|[\u2600-\u26FF]|[\u25A0-\u25FF]|[\u2190-\u21FF]/g, "");

  // Only keep standard printable WinAnsi characters to prevent PDFKit garbling
  let result = "";
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255) || code === 10 || code === 13 || code === 9) {
      result += clean[i];
    } else if (code === 8226) {
      result += "•";
    }
  }

  // Replace multiple spaces left behind by stripped emojis and clean trailing
  return result.replace(/\s+/g, " ").trim();
}

// Helper to construct dynamic inline markdown text spans in PDFKit
function writeFormattedText(doc, text, defaultFont = "Helvetica", defaultSize = 10, defaultColor = "#2d3748", options = {}) {
  let processedText = text;
  let isCheckbox = false;
  let isChecked = false;

  if (processedText.startsWith("[ ] ")) {
    isCheckbox = true;
    isChecked = false;
    processedText = processedText.substring(4);
  } else if (processedText.startsWith("[x] ") || processedText.startsWith("[X] ")) {
    isCheckbox = true;
    isChecked = true;
    processedText = processedText.substring(4);
  }

  if (isCheckbox) {
    doc.font("Helvetica").fontSize(defaultSize).fillColor(defaultColor);
    doc.text(isChecked ? "[x] " : "[ ] ", { ...options, continued: true });
  }

  // Sanitize the remaining text to avoid encoding corruption in PDF
  processedText = sanitizeForPDF(processedText);

  // Split by bold, italic, bold-italic, and code block delimiters:
  // ***italicbold***, **bold**, *italic*, `code`
  const regex = /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = processedText.split(regex);

  const runs = parts.map(part => {
    if (part.startsWith("***") && part.endsWith("***")) {
      return { text: part.slice(3, -3), bold: true, italic: true };
    } else if (part.startsWith("**") && part.endsWith("**")) {
      return { text: part.slice(2, -2), bold: true };
    } else if (part.startsWith("*") && part.endsWith("*")) {
      return { text: part.slice(1, -1), italic: true };
    } else if (part.startsWith("`") && part.endsWith("`")) {
      return { text: part.slice(1, -1), mono: true };
    } else {
      return { text: part };
    }
  }).filter(p => p.text.length > 0);

  if (runs.length === 0) {
    // Empty line, output just a spacer
    doc.font(defaultFont).fontSize(defaultSize).fillColor(defaultColor);
    doc.text("", options);
    return;
  }

  runs.forEach((run, index) => {
    const isLast = index === runs.length - 1;
    let fontName = defaultFont;

    if (run.mono) {
      fontName = "Courier";
    } else {
      const isBaseOblique = defaultFont.includes("Oblique") || defaultFont.includes("Italic");
      const isBaseBold = defaultFont.includes("Bold");

      if (run.bold && run.italic) {
        fontName = "Helvetica-BoldOblique";
      } else if (run.bold) {
        fontName = isBaseOblique ? "Helvetica-BoldOblique" : "Helvetica-Bold";
      } else if (run.italic) {
        fontName = isBaseBold ? "Helvetica-BoldOblique" : "Helvetica-Oblique";
      } else {
        fontName = defaultFont;
      }
    }

    doc.font(fontName)
       .fontSize(run.mono ? defaultSize - 1 : defaultSize)
       .fillColor(run.mono ? "#c53030" : defaultColor);

    doc.text(run.text, {
      ...options,
      continued: !isLast
    });
  });
}

// GET /documents/:docId/export/pdf
router.get("/documents/:docId/export/pdf", authenticateToken, async (req, res) => {
  const docObj = await checkExportAccess(req, res);
  if (!docObj) return;

  const safeTitle = docObj.title ? docObj.title.replace(/[^a-zA-Z0-9_\-\s]/g, "") : "Document";
  
  const doc = new PDFDocument({ margin: 50 });
  let chunks = [];
  doc.on("data", chunk => chunks.push(chunk));
  doc.on("end", () => {
    let pdfData = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeTitle)}.pdf"`);
    res.send(pdfData);
  });

  // Title
  doc.fontSize(24).font("Helvetica-Bold").fillColor("#1a202c").text(sanitizeForPDF(docObj.title || "Untitled Document"));
  doc.moveDown(1);

  const lines = (docObj.content || "").split("\n");
  let isCodeBlock = false;

  lines.forEach(line => {
    if (line.startsWith("```")) {
      isCodeBlock = !isCodeBlock;
      return;
    }

    if (isCodeBlock) {
      doc.fontSize(10).font("Courier").fillColor("#4a5568").text(sanitizeForPDF(line), { indent: 15 });
      return;
    }

    if (line.startsWith("# ")) {
      doc.moveDown(0.5);
      writeFormattedText(doc, line.replace("# ", ""), "Helvetica-Bold", 18, "#1a202c");
      doc.moveDown(0.3);
    } else if (line.startsWith("## ")) {
      doc.moveDown(0.4);
      writeFormattedText(doc, line.replace("## ", ""), "Helvetica-Bold", 14, "#2d3748");
      doc.moveDown(0.2);
    } else if (line.startsWith("### ")) {
      doc.moveDown(0.4);
      writeFormattedText(doc, line.replace("### ", ""), "Helvetica-Bold", 12, "#4a5568");
      doc.moveDown(0.2);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const contentOfLine = line.substring(2);
      if (contentOfLine.startsWith("[ ] ") || contentOfLine.startsWith("[x] ") || contentOfLine.startsWith("[X] ")) {
        writeFormattedText(doc, contentOfLine, "Helvetica", 10, "#2d3748", { indent: 15 });
      } else {
        writeFormattedText(doc, `• ${contentOfLine}`, "Helvetica", 10, "#2d3748", { indent: 15 });
      }
    } else if (/^\d+\.\s/.test(line)) {
      writeFormattedText(doc, line, "Helvetica", 10, "#2d3748", { indent: 15 });
    } else if (line.trim() === "---") {
      doc.moveDown(0.25);
      const currentY = doc.y;
      doc.moveTo(50, currentY)
         .lineTo(doc.page.width - 50, currentY)
         .strokeColor("#e2e8f0")
         .lineWidth(1)
         .stroke();
      doc.moveDown(0.4);
    } else if (line.startsWith("> ")) {
      doc.moveDown(0.25);
      writeFormattedText(doc, line.substring(2), "Helvetica-Oblique", 10, "#4a5568", { indent: 20 });
      doc.moveDown(0.25);
    } else if (line.trim() === "") {
      doc.moveDown(0.3);
    } else {
      writeFormattedText(doc, line, "Helvetica", 10, "#2d3748");
    }
  });

  doc.end();
});

// GET /documents/:docId/export/docx
router.get("/documents/:docId/export/docx", authenticateToken, async (req, res) => {
  const docObj = await checkExportAccess(req, res);
  if (!docObj) return;

  const safeTitle = docObj.title ? docObj.title.replace(/[^a-zA-Z0-9_\-\s]/g, "") : "Document";

  const paragraphs = [];

  // Document Title heading
  paragraphs.push(new Paragraph({
    text: docObj.title || "Untitled Document",
    heading: HeadingLevel.TITLE,
    spacing: { after: 300 }
  }));

  const lines = (docObj.content || "").split("\n");
  let inCode = false;

  lines.forEach(line => {
    if (line.startsWith("```")) {
      inCode = !inCode;
      return;
    }

    if (inCode) {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({
            text: line,
            font: "Courier New",
            size: 20
          })
        ]
      }));
      return;
    }

    if (line.startsWith("# ")) {
      paragraphs.push(new Paragraph({
        text: line.replace("# ", ""),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 }
      }));
    } else if (line.startsWith("## ")) {
      paragraphs.push(new Paragraph({
        text: line.replace("## ", ""),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 }
      }));
    } else if (line.startsWith("### ")) {
      paragraphs.push(new Paragraph({
        text: line.replace("### ", ""),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 160, after: 80 }
      }));
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      paragraphs.push(new Paragraph({
        text: line.substring(2),
        bullet: { level: 0 },
        spacing: { after: 100 }
      }));
    } else if (line.trim() === "") {
      // spacer/empty line
    } else {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({
            text: line
          })
        ],
        spacing: { after: 120 }
      }));
    }
  });

  const wordDoc = new Document({
    sections: [{
      properties: {},
      children: paragraphs
    }]
  });

  Packer.toBuffer(wordDoc).then((buffer) => {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeTitle)}.docx"`);
    res.send(buffer);
  }).catch(err => {
    console.error("docx export error:", err);
    res.status(500).json({ error: "Failed to generate word doc" });
  });
});
