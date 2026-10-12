import mongoose from "mongoose";

const annotationSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  roomId: { type: String, required: true },
  pageNumber: { type: Number },
  elements: { type: mongoose.Schema.Types.Mixed },
  userId: { type: String },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { versionKey: false });

const Annotation = mongoose.models.Annotation || mongoose.model("Annotation", annotationSchema);

export default Annotation;
