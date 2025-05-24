// import mongoose from "mongoose";

// const PaymentMethodSchema = new mongoose.Schema(
//     {
//         razorpay: {
//             type: Boolean,
//             required: true
//         },
//         stripe: {
//             type: Boolean,
//             required: true
//         },
//     },
//     {
//         timestamps: true,
//     }
// );

// const PaymentMethod = mongoose.model("PaymentMethod", PaymentMethodSchema);

// export default PaymentMethod;

// import mongoose from "mongoose";

// const PaymentMethodSchema = new mongoose.Schema(
//   {
//     razorpay: { type: Boolean, required: true },
//     stripe: { type: Boolean, required: true },
//     manual: { type: Boolean, required: true },
//     imepay: { type: Boolean, required: true },
//     esewa: { type: Boolean, required: true },
//     khalti: { type: Boolean, required: true },

//   },
//   { timestamps: true }
// );

// const PaymentMethod = mongoose.model("PaymentMethod", PaymentMethodSchema);

// export default PaymentMethod;

import mongoose from "mongoose";

const PaymentMethodSchema = new mongoose.Schema(
  {
    razorpay: { type: Boolean, required: true },
    stripe: { type: Boolean, required: true },
    manual: { type: Boolean, required: true },  // Added manual
    imepay: { type: Boolean, required: true },
    esewa: { type: Boolean, required: true },
    khalti: { type: Boolean, required: true },
  },
  { timestamps: true }
);

const PaymentMethod = mongoose.model("PaymentMethod", PaymentMethodSchema);

export default PaymentMethod;