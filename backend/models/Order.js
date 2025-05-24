import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.ObjectId, required: true },
    email: { type: String, required: true }, // Update the field name to 'email'
    itemId: { type: mongoose.Schema.ObjectId, required: true },
    orderId: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, required: true, enum: ["manual"] },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "created","cancelled"],
      default: "created",
    },
    expirationDate: { type: Date, required: true },
    transactionDetails: { type: String },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", OrderSchema);
export default Order;