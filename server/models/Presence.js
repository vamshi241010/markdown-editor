import mongoose from "mongoose";

const PresenceSchema = new mongoose.Schema({
  docId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: "#3b82f6"
  },
  cursor: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  lastActive: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Automatically clean up records that are more than 5 minutes stale
// This works alongside the interval cleaner

export const Presence = mongoose.model("Presence", PresenceSchema);
