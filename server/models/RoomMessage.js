import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  roomId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  text: { type: String, required: true },
  type: { type: String, default: "chat" }, // system, chat
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { versionKey: false });

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;
