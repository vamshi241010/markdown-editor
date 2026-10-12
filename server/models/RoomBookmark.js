import mongoose from "mongoose";

const bookmarkSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  roomId: { type: String, required: true },
  userId: { type: String, required: true },
  pageNumber: { type: Number, required: true },
  note: { type: String, default: "" },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { versionKey: false });

const Bookmark = mongoose.models.Bookmark || mongoose.model("Bookmark", bookmarkSchema);

export default Bookmark;
