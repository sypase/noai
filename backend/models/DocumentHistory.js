// Import mongoose
import mongoose from "mongoose";

// Define schema for document history
const DocumentHistorySchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.ObjectId, required: true },
        documentId: { type: mongoose.Schema.ObjectId, required: true },
        action: { type: String, enum: ['created', 'updated', 'deleted'], required: true },
        timestamp: { type: Date, default: Date.now }
    }
);

export default DocumentHistory;
