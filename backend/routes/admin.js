import joi from "joi";
import express from "express";
import Item from "../models/Item.js";
import User from "../models/User.js";
import Rewrites from "../models/Rewrites.js";
import Purchase from "../models/Purchase.js";
import PaymentMethod from "../models/PaymentMethod.js";
import { validateAdmin } from "../middlewares/validate.js";
import Order from "../models/Order.js";
import nodemailer from "nodemailer";
import CreditTransaction from "../models/CreditPool.js";
const router = express.Router();

router.get("/", validateAdmin, async (req, res) => {
  return res.send("Admin Panel");
});

//DASHBOARD START
router.get("/dashboard", validateAdmin, async (req, res) => {
  const users = await User.find().countDocuments();
  const items = await Item.find().countDocuments();
  const purchasesData = await Purchase.find();
  const purchases = purchasesData.length;
  var earnings = 0;
  for (const purchase of purchasesData) {
    earnings += purchase.amount;
  }

  return res.send({ users, items, purchases, earnings });
});
//DASHBOARD END

//SHOP START
router.get("/shop", validateAdmin, async (req, res) => {
  return res.send((await Item.find()).reverse());
});

router.post("/shop/create", validateAdmin, async (req, res) => {
  const schema = joi.object({
    title: joi.string().required(),
    rewriteLimit: joi.number().required().min(1),
    price: joi.number().required().min(0),
    type: joi.number().required().min(0).max(3), // 0 = free, 1 = monthly, 2 = yearly, 3 = lifetime
  });

  try {
    const data = await schema.validateAsync(req.body);
    const newItem = new Item({
      enable: true,
      userId: req.user._id,
      title: data.title,
      rewriteLimit: data.rewriteLimit,
      price: data.price,
      type: data.type,
    });

    await newItem.save();
    return res.send(newItem);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.post("/shop/edit", validateAdmin, async (req, res) => {
  const schema = joi.object({
    itemId: joi.string().required(),
    enable: joi.boolean().required(),
    title: joi.string().required(),
    rewriteLimit: joi.number().required().min(1),
    price: joi.number().required().min(0),
    type: joi.number().required().min(0).max(3), // 0 = free, 1 = monthly, 2 = yearly, 3 = lifetime
  });

  try {
    const data = await schema.validateAsync(req.body);
    await Item.findOneAndUpdate(
      { _id: data.itemId, userId: req.user._id },
      {
        enable: data.enable,
        title: data.title,
        rewriteLimit: data.rewriteLimit,
        price: data.price,
        type: data.type,
      }
    );

    return res.send("Updated!");
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.post("/shop/delete", validateAdmin, async (req, res) => {
  const schema = joi.object({
    itemId: joi.string().required(),
  });

  try {
    const data = await schema.validateAsync(req.body);
    await Item.findByIdAndDelete(data.itemId);

    return res.send("Deleted!");
  } catch (err) {
    return res.status(500).send(err);
  }
});
//SHOP END

//PAYMENT METHODS START
// router.get("/payment-methods", validateAdmin, async (req, res) => {
//   const paymentMethod = await PaymentMethod.findOne();

//   if (!paymentMethod) {
//     return res.send({ razorpay: true, stripe: true });
//   }

//   return res.send({
//     razorpay: paymentMethod.razorpay,
//     stripe: paymentMethod.stripe,
//   });
// });

// router.post("/payment-methods", validateAdmin, async (req, res) => {
//   const schema = joi.object({
//     razorpay: joi.boolean().required(),
//     stripe: joi.boolean().required(),
//   });

//   try {
//     const data = await schema.validateAsync(req.body);
//     const paymentMethod = await PaymentMethod.findOne();

//     if (!paymentMethod) {
//       const newPaymentMethod = new PaymentMethod({
//         razorpay: data.razorpay,
//         stripe: data.stripe,
//       });

//       await newPaymentMethod.save();
//       return res.send({
//         razorpay: newPaymentMethod.razorpay,
//         stripe: newPaymentMethod.stripe,
//       });
//     }

//     paymentMethod.razorpay = data.razorpay;
//     paymentMethod.stripe = data.stripe;

//     await paymentMethod.save();

//     return res.send({
//       razorpay: paymentMethod.razorpay,
//       stripe: paymentMethod.stripe,
//     });
//   } catch (err) {
//     return res.status(500).send(err);
//   }
// });

router.get("/payment-methods", validateAdmin, async (req, res) => {
  const paymentMethod = await PaymentMethod.findOne();
  if (!paymentMethod) {
    return res.send({ razorpay: true, stripe: true, manual: true });
  }
  return res.send({
    razorpay: paymentMethod.razorpay,
    stripe: paymentMethod.stripe,
    manual: paymentMethod.manual,
  });
});

router.post("/payment-methods", validateAdmin, async (req, res) => {
  const schema = joi.object({
    razorpay: joi.boolean().required(),
    stripe: joi.boolean().required(),
    manual: joi.boolean().required(),
  });

  try {
    const data = await schema.validateAsync(req.body);
    const paymentMethod = await PaymentMethod.findOne();
    if (!paymentMethod) {
      const newPaymentMethod = new PaymentMethod({
        razorpay: data.razorpay,
        stripe: data.stripe,
        manual: data.manual,
      });
      await newPaymentMethod.save();
      return res.send({
        razorpay: newPaymentMethod.razorpay,
        stripe: newPaymentMethod.stripe,
        manual: newPaymentMethod.manual,
      });
    }
    paymentMethod.razorpay = data.razorpay;
    paymentMethod.stripe = data.stripe;
    paymentMethod.manual = data.manual;
    await paymentMethod.save();
    return res.send({
      razorpay: paymentMethod.razorpay,
      stripe: paymentMethod.stripe,
      manual: paymentMethod.manual,
    });
  } catch (err) {
    return res.status(500).send(err);
  }
});
//PAYMENT METHODS END

//USERS START
router.get("/users", validateAdmin, async (req, res) => {
  const users = (await User.find().select("-password")).reverse();

  var usersData = [];
  for (const user of users) {
    const rewrites = await Rewrites.findOne({ userId: user._id });
    const purchases = await Purchase.find({ userId: user._id });

    usersData.push({
      _id: user._id,
      name: user.name,
      email: user.email,
      type: user.type,
      rewrites: rewrites ? rewrites.rewrites : 0,
      purchases: purchases.length,
    });
  }

  return res.send(usersData);
});
//USERS END

//SETTINGS START
router.get("/settings", validateAdmin, async (req, res) => {
  return res.send("Users");
});
//SETTINGS END

//PURCHASES START
router.get("/purchases", validateAdmin, async (req, res) => {
  const purchases = (await Purchase.find()).reverse();

  var purchasesData = [];

  for (const purchase of purchases) {
    const user = await User.findById(purchase.userId);
    const item = await Item.findById(purchase.itemId);

    purchasesData.push({
      _id: purchase._id,
      user: user.name,
      email: user.email,
      item: item.title,
      amount: purchase.amount,
      paymentMethod: purchase.paymentMethod,
      date: purchase.createdAt.toLocaleString().split(",")[0],
    });
  }

  return res.send(purchasesData);
});

router.get("/orders", validateAdmin, async (req, res) => {
  try {
    console.log("hello");
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

router.post("/reject-order", validateAdmin, async (req, res) => {
  try {
    const { orderId } = req.body;

    // Find the order by ID
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if the order is already rejected
    if (order.status === "rejected") {
      return res.status(400).json({ error: "Order is already rejected" });
    }

    // Update order status to "rejected"
    order.status = "rejected";
    await order.save();

    res.json({ message: "Order rejected" });
  } catch (error) {
    console.error("Error rejecting order:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

// POST /admin/mark-as-pending
router.post("/mark-as-pending", validateAdmin, async (req, res) => {
  try {
    const { orderId } = req.body;

    // Find the order by ID
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if the order is already pending
    if (order.status === "pending") {
      return res.status(400).json({ error: "Order is already pending" });
    }

    // Update order status to "pending"
    order.status = "pending";
    await order.save();

    res.json({ message: "Order marked as pending" });
  } catch (error) {
    console.error("Error marking order as pending:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

// router.post("/approve-order", validateAdmin, async (req, res) => {
//   try {
//     const { orderId } = req.body;
//     // Find the order by ID
//     const order = await Order.findById(orderId);
//     if (!order) {
//       return res.status(404).json({ error: "Order not found" });
//     }
//     // Check if the order is already approved
//     if (order.status === "approved") {
//       return res.status(400).json({ error: "Order is already approved" });
//     }
//     // Update order status to "approved"
//     order.status = "approved";
//     await order.save();
//     // Create a new purchase
//     const purchase = new Purchase({
//       userId: order.userId,
//       itemId: order.itemId,
//       transactionId: "admin_approved",
//       amount: order.amount,
//       paymentMethod: "manual",
//       expirationDate: order.expirationDate,
//     });
//     await purchase.save();
//     // Fetch the item based on the itemId from the order
//     const item = await Item.findById(order.itemId);
//     if (!item) {
//       console.error("Item not found for the given order:", order);
//       return res.status(400).json({ error: "Invalid order item" });
//     }
//     const rewritesCount = item.rewriteLimit;
//     // Update user's rewrites and expiration date
//     const rewrites = await Rewrites.findOne({ userId: order.userId });
//     if (rewrites) {
//       // Ensure rewritesCount is a valid number before adding
//       if (!isNaN(rewritesCount)) {
//         rewrites.rewrites += rewritesCount;
//       } else {
//         console.error("Invalid rewritesCount value:", rewritesCount);
//       }
//       rewrites.expirationDate = order.expirationDate;
//       await rewrites.save();
//     } else {
//       // Ensure rewritesCount is a valid number before creating a new Rewrites document
//       if (!isNaN(rewritesCount)) {
//         const newRewrites = new Rewrites({
//           userId: order.userId,
//           rewrites: rewritesCount,
//           expirationDate: order.expirationDate,
//         });
//         await newRewrites.save();
//       } else {
//         console.error("Invalid rewritesCount value:", rewritesCount);
//       }
//     }
//     res.json({ message: "Order approved and purchase created" });
//   } catch (error) {
//     console.error("Error approving order:", error);
//     res.status(500).json({ error: "An error occurred" });
//   }
// });

// router.post("/approve-order", validateAdmin, async (req, res) => {
//   try {
//     const { orderId } = req.body;
//     // Find the order by ID
//     const order = await Order.findById(orderId);
//     if (!order) {
//       return res.status(404).json({ error: "Order not found" });
//     }
//     // Check if the order is already approved
//     if (order.status === "approved") {
//       return res.status(400).json({ error: "Order is already approved" });
//     }
//     // Update order status to "approved"
//     order.status = "approved";
//     await order.save();

//     // Create a new purchase
//     const purchase = new Purchase({
//       userId: order.userId,
//       itemId: order.itemId,
//       transactionId: "admin_approved",
//       amount: order.amount,
//       paymentMethod: "manual",
//       expirationDate: order.expirationDate,
//     });
//     await purchase.save();

//     // Fetch the item based on the itemId from the order
//     const item = await Item.findById(order.itemId);
//     if (!item) {
//       console.error("Item not found for the given order:", order);
//       return res.status(400).json({ error: "Invalid order item" });
//     }
//     const rewritesCount = item.rewriteLimit;

//     // Update user's rewrites and expiration date
//     const rewrites = await Rewrites.findOne({ userId: order.userId });
//     if (rewrites) {
//       // Ensure rewritesCount is a valid number before adding
//       if (!isNaN(rewritesCount)) {
//         rewrites.rewrites += rewritesCount;
//       } else {
//         console.error("Invalid rewritesCount value:", rewritesCount);
//       }
//       rewrites.expirationDate = order.expirationDate;
//       await rewrites.save();
//     } else {
//       // Ensure rewritesCount is a valid number before creating a new Rewrites document
//       if (!isNaN(rewritesCount)) {
//         const newRewrites = new Rewrites({
//           userId: order.userId,
//           rewrites: rewritesCount,
//           expirationDate: order.expirationDate,
//         });
//         await newRewrites.save();
//       } else {
//         console.error("Invalid rewritesCount value:", rewritesCount);
//       }
//     }

//     // Send email notification
//     const user = await User.findById(order.userId);
//     const itemName = item.name;
//     const invoiceUrl = `${process.env.APP_URL}/purchase/${purchase._id}/invoice`; // Replace with your invoice URL

//     const transporter = nodemailer.createTransport({
//       host: process.env.SMTP_HOST,
//       port: process.env.SMTP_PORT,
//       secure: true,
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//       },
//     });

//     const mailOptions = {
//       from: process.env.SMTP_USER,
//       to: user.email,
//       subject: "Order Approved - NoaiGPT",
//       text: `Your order of ${itemName} has been marked as approved. Your points have been updated in the system. \n\nPurchase Details: ${purchase}\n\nDownload Invoice: ${invoiceUrl}`,
//     };

//     await transporter.sendMail(mailOptions);

//     res.json({ message: "Order approved, purchase created, and email sent" });
//   } catch (error) {
//     console.error("Error approving order:", error);
//     res.status(500).json({ error: "An error occurred" });
//   }
// });
// router.post("/approve-order", validateAdmin, async (req, res) => {
//   try {
//     const { orderId } = req.body;
//     // Find the order by ID
//     const order = await Order.findById(orderId);
//     if (!order) {
//       return res.status(404).json({ error: "Order not found" });
//     }
//     // Check if the order is already approved
//     if (order.status === "approved") {
//       return res.status(400).json({ error: "Order is already approved" });
//     }
//     // Update order status to "approved"
//     order.status = "approved";
//     await order.save();

//     // Create a new purchase
//     const purchase = new Purchase({
//       userId: order.userId,
//       itemId: order.itemId,
//       transactionId: "admin_approved",
//       amount: order.amount,
//       paymentMethod: "manual",
//       expirationDate: order.expirationDate,
//     });
//     await purchase.save();

//     // Fetch the item based on the itemId from the order
//     const item = await Item.findById(order.itemId);
//     if (!item) {
//       console.error("Item not found for the given order:", order);
//       return res.status(400).json({ error: "Invalid order item" });
//     }
//     const rewritesCount = item.rewriteLimit;

//     // Update user's rewrites and expiration date
//     const rewrites = await Rewrites.findOne({ userId: order.userId });
//     if (rewrites) {
//       // Ensure rewritesCount is a valid number before adding
//       if (!isNaN(rewritesCount)) {
//         rewrites.rewrites += rewritesCount;
//       } else {
//         console.error("Invalid rewritesCount value:", rewritesCount);
//       }
//       rewrites.expirationDate = order.expirationDate;
//       await rewrites.save();
//     } else {
//       // Ensure rewritesCount is a valid number before creating a new Rewrites document
//       if (!isNaN(rewritesCount)) {
//         const newRewrites = new Rewrites({
//           userId: order.userId,
//           rewrites: rewritesCount,
//           expirationDate: order.expirationDate,
//         });
//         await newRewrites.save();
//       } else {
//         console.error("Invalid rewritesCount value:", rewritesCount);
//       }
//     }

//     // Send email notification
//     const user = await User.findById(order.userId);
//     const itemName = item.name;
//     const invoiceUrl = `http://localhost:3000/invoice/${purchase._id}`;

//     const transporter = nodemailer.createTransport({
//       host: process.env.SMTP_HOST,
//       port: process.env.SMTP_PORT,
//       secure: true,
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//       },
//     });

//     const mailOptions = {
//       from: process.env.SMTP_USER,
//       to: user.email,
//       subject: "Order Approved - NoaiGPT",
//       html: `
//         <html>
//           <head>
//             <style>
//               body {
//                 font-family: Arial, sans-serif;
//                 font-size: 16px;
//                 line-height: 1.5;
//                 color: #333;
//               }
//               h1 {
//                 color: #008080;
//               }
//               p {
//                 margin: 1em 0;
//               }
//               a {
//                 color: #008080;
//                 text-decoration: none;
//               }
//             </style>
//           </head>
//           <body>
//             <h1>Order Approved</h1>
//             <p>Dear ${user.name},</p>
//             <p>Your order has been marked as approved. Your points have been updated in the system.</p>
//             <h2>Purchase Details</h2>
//             <ul>
//               <li><strong>Transaction ID:</strong> ${
//                 purchase.transactionId
//               }</li>
//               <li><strong>Amount:</strong> ${purchase.amount}</li>
//               <li><strong>Payment Method:</strong> ${
//                 purchase.paymentMethod
//               }</li>
//               <li><strong>Expiration Date:</strong> ${purchase.expirationDate.toLocaleDateString()}</li>
//             </ul>
//             <p>You can download your invoice by clicking the link below:</p>
//             <p><a href="${invoiceUrl}">Download Invoice</a></p>
//             <p>Thank you for your order!</p>
//             <p>Best regards,<br>The NoaiGPT Team</p>
//           </body>
//         </html>
//       `,
//     };

//     await transporter.sendMail(mailOptions);

//     res.json({ message: "Order approved, purchase created, and email sent" });
//   } catch (error) {
//     console.error("Error approving order:", error);
//     res.status(500).json({ error: "An error occurred" });
//   }
// });

router.post("/approve-order", validateAdmin, async (req, res) => {
  try {
    const { orderId } = req.body;
    // Find the order by ID
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    // Check if the order is already approved
    if (order.status === "approved") {
      return res.status(400).json({ error: "Order is already approved" });
    }
    // Update order status to "approved"
    order.status = "approved";
    await order.save();

    // Create a new purchase
    const purchase = new Purchase({
      userId: order.userId,
      itemId: order.itemId,
      transactionId: "admin_approved",
      amount: order.amount,
      paymentMethod: "manual",
      expirationDate: order.expirationDate,
    });
    await purchase.save();

    // Fetch the item based on the itemId from the order
    const item = await Item.findById(order.itemId);
    if (!item) {
      console.error("Item not found for the given order:", order);
      return res.status(400).json({ error: "Invalid order item" });
    }
    const rewritesCount = item.rewriteLimit;

    // Update user's rewrites and expiration date
    const rewrites = await Rewrites.findOne({ userId: order.userId });
    if (rewrites) {
      // Ensure rewritesCount is a valid number before adding
      if (!isNaN(rewritesCount)) {
        rewrites.rewrites += rewritesCount;
      } else {
        console.error("Invalid rewritesCount value:", rewritesCount);
      }
      rewrites.expirationDate = order.expirationDate;
      await rewrites.save();
    } else {
      // Ensure rewritesCount is a valid number before creating a new Rewrites document
      if (!isNaN(rewritesCount)) {
        const newRewrites = new Rewrites({
          userId: order.userId,
          rewrites: rewritesCount,
          expirationDate: order.expirationDate,
        });
        await newRewrites.save();
      } else {
        console.error("Invalid rewritesCount value:", rewritesCount);
      }
    }

    // Record the credit transaction for adding credits
    const creditTransaction = new CreditTransaction({
      userId: order.userId,
      type: "credit_added",
      amount: rewritesCount,
    });
    await creditTransaction.save();

    // Send email notification
    const user = await User.findById(order.userId);
    const itemName = item.name;
    const invoiceUrl = `http://localhost:3000/invoice/${purchase._id}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: user.email,
      subject: "Order Approved - NoaiGPT",
      html: `
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                font-size: 16px;
                line-height: 1.5;
                color: #333;
              }
              h1 {
                color: #008080;
              }
              p {
                margin: 1em 0;
              }
              a {
                color: #008080;
                text-decoration: none;
              }
            </style>
          </head>
          <body>
            <h1>Order Approved</h1>
            <p>Dear ${user.name},</p>
            <p>Your order has been marked as approved. Your points have been updated in the system.</p>
            <h2>Purchase Details</h2>
            <ul>
              <li><strong>Transaction ID:</strong> ${
                purchase.transactionId
              }</li>
              <li><strong>Amount:</strong> ${purchase.amount}</li>
              <li><strong>Payment Method:</strong> ${
                purchase.paymentMethod
              }</li>
              <li><strong>Expiration Date:</strong> ${purchase.expirationDate.toLocaleDateString()}</li>
            </ul>
            <p>You can download your invoice by clicking the link below:</p>
            <p><a href="${invoiceUrl}">Download Invoice</a></p>
            <p>Thank you for your order!</p>
            <p>Best regards,<br>The NoaiGPT Team</p>
          </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Order approved, purchase created, and email sent" });
  } catch (error) {
    console.error("Error approving order:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});



router.get("/analytics", validateAdmin, async (req, res) => {
  try {
    console.log("asdsad");
    // Today's credit usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysCreditUsage = await CreditTransaction.aggregate([
      { $match: { type: "credit_used", date: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Monthly credit usage
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const monthlyCreditUsage = await CreditTransaction.aggregate([
      { $match: { type: "credit_used", date: { $gte: currentMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Total credits added and used
    const totalCreditsAdded = await CreditTransaction.aggregate([
      { $match: { type: "credit_added" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalCreditsUsed = await CreditTransaction.aggregate([
      { $match: { type: "credit_used" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Top credit users
    const topUsers = await CreditTransaction.aggregate([
      { $match: { type: "credit_used" } },
      { $group: { _id: "$userId", totalCreditsUsed: { $sum: "$amount" } } },
      { $sort: { totalCreditsUsed: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $project: { _id: 0, name: "$user.name", totalCreditsUsed: 1 } },
    ]);

    res.json({
      todaysCreditUsage:
        todaysCreditUsage.length > 0 ? todaysCreditUsage[0].total : 0,
      monthlyCreditUsage:
        monthlyCreditUsage.length > 0 ? monthlyCreditUsage[0].total : 0,
      totalCreditsAdded:
        totalCreditsAdded.length > 0 ? totalCreditsAdded[0].total : 0,
      totalCreditsUsed:
        totalCreditsUsed.length > 0 ? totalCreditsUsed[0].total : 0,
      topUsers,
    });
  } catch (error) {
    console.error("Error fetching credit analytics:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

export default router;
