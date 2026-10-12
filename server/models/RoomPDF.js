import mongoose from "mongoose";

const pdfSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  roomId: { type: String, required: true },
  filename: { type: String, required: true },
  gridfsId: { type: String },
  uploadedAt: { type: String, default: () => new Date().toISOString() },
  uploadedBy: { type: String },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { versionKey: false });

const Pdf = mongoose.models.Pdf || mongoose.model("Pdf", pdfSchema);

export default Pdf;
