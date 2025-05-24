import mongoose from "mongoose";

const DocumentSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.ObjectId, required: true },
        title: { type: String, required: true },
        content: { type: String, required: false, default: "" },
        settings: {
            tone: { type: Number, required: false, default: 0 },
            length: { type: Number, required: false, default: 1 },
            rewrites: { type: Number, required: false, default: 1 },
        },
    },
    {
        timestamps: true,
    }
);

const Document = mongoose.model("Document", DocumentSchema);

export default Document;