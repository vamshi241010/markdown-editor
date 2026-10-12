import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  roomId: { type: String, required: true },
  startedAt: { type: String, default: () => new Date().toISOString() },
  endedAt: { type: String, default: () => new Date().toISOString() },
  chatLog: { type: [mongoose.Schema.Types.Mixed], default: [] },
  whiteboardSnapshot: { type: String, default: "" },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { versionKey: false });

const Session = mongoose.models.Session || mongoose.model("Session", sessionSchema);

export default Session;
