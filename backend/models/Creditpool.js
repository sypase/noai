import mongoose from "mongoose";

const CreditTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Types.ObjectId, required: true },
    type: { 
      type: String, 
      required: true, 
      enum: [
        "credit_added", 
        "credit_used", 
        "credit_purchase", 
        "credit_bonus", 
        "credit_referral"
      ] 
    },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const CreditTransaction = mongoose.model("CreditTransaction", CreditTransactionSchema);

export default CreditTransaction;
