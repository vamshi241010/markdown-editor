import mongoose from "mongoose";

const DocumentSchema = new mongoose.Schema({
  docId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    default: "Untitled Document"
  },
  content: {
    type: String,
    default: ""
  },
  collaborators: {
    type: [String],
    default: []
  },
  yState: {
    type: String,
    default: ""
  },
  created: {
    type: Date,
    default: Date.now
  },
  updated: {
    type: Date,
    default: Date.now
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: { createdAt: "created", updatedAt: "updated" }
});

export const Document = mongoose.model("Document", DocumentSchema);
