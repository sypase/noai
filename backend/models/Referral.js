import mongoose from "mongoose";

const ReferralSchema = new mongoose.Schema(
  {
    referrerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    referredUserId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    status: { 
      type: String, 
      enum: ['pending', 'completed'], 
      default: 'pending' 
    },
    rewardClaimed: { 
      type: Boolean, 
      default: false 
    },
    rewardAmount: { 
      type: Number, 
      default: 5 // Default reward amount for successful referral
    },
  },
  { timestamps: true }
);

const Referral = mongoose.model("Referral", ReferralSchema);

export default Referral;
