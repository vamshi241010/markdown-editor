import mongoose from "mongoose";

const participantSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  roomId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  role: { type: String, default: "member" }, // host, member, listener, etc.
  joinedAt: { type: String, default: () => new Date().toISOString() },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { versionKey: false });

const Participant = mongoose.models.Participant || mongoose.model("Participant", participantSchema);

export default Participant;
