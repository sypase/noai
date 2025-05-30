import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: true,
            minlength: 6
        },
        type: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },
        referralCode: { // Field for the user's unique referral code
            type: String,
            unique: true,
            sparse: true,
        },
         role: { type: String, default: "user" },
        createdAt: { type: Date, default: Date.now }
    },
    {
        timestamps: true,
    }
);

const User = mongoose.model("User", UserSchema);

export default User;
