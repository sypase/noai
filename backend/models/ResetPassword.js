// models/ResetPassword.js
import mongoose from "mongoose";

const resetPasswordSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
        },
        resetCode: {
            type: String,
            required: true,
        },
        isReset: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

const ResetPassword = mongoose.model("ResetPassword", resetPasswordSchema);

export default ResetPassword;