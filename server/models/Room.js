import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  name: { type: String, required: true },
  subject: { type: String },
  tags: { type: [String], default: [] },
  isPublic: { type: Boolean, default: true },
  hostId: { type: String },
  code: { type: String },
  participantCount: { type: Number, default: 0 },
  lastActive: { type: String, default: () => new Date().toISOString() },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { versionKey: false });

const Room = mongoose.models.Room || mongoose.model("Room", roomSchema);

export default Room;
