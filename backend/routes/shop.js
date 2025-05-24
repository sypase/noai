import joi from "joi";
import dotenv from "dotenv";
import crypto from "crypto";
import express from "express";
import User from "../models/User.js";
import Item from "../models/Item.js";
import Order from "../models/Order.js";
import Rewrites from "../models/Rewrites.js";
import Purchase from "../models/Purchase.js";
import { validate } from "../middlewares/validate.js";
import PaymentMethod from "../models/PaymentMethod.js";
import {
  currency,
  merchantAddress,
  merchantName,
  razorpayThemeColor,
} from "../utils/utils.js";
import Invoice from "../models/Invoice.js";
dotenv.config();
import nodemailer from "nodemailer";

const router = express.Router();


router.get("/", validate, async (req, res) => {
  try {
    let paymentMethod = await PaymentMethod.findOne();
    
    // If no document exists, create a default one
    if (!paymentMethod) {
      paymentMethod = await PaymentMethod.create({
        razorpay: true,
        stripe: true,
        manual: true,  // Added manual
        imepay: true,
        esewa: true,
        khalti: true
      });
    }

    const items = await Item.find();

    const paymentMethods = {
      razorpay: paymentMethod.razorpay,
      stripe: paymentMethod.stripe,
      manual: paymentMethod.manual,  // Added manual
      imepay: paymentMethod.imepay,
      esewa: paymentMethod.esewa,
      khalti: paymentMethod.khalti
    };

    const data = {
      items: items,
      paymentMethods: paymentMethods,
    };

    return res.send(data);
  } catch (error) {
    console.error('Error in GET route:', error);
    return res.status(500).send('Internal Server Error');
  }
});
router.get("/purchases", validate, async (req, res) => {
  const purchases = (await Purchase.find()).reverse();

  var purchasesData = [];

  for (const purchase of purchases) {
    const item = await Item.findById(purchase.itemId);

    purchasesData.push({
      _id: purchase._id,
      item: item.title,
      amount: purchase.amount,
      paymentMethod: purchase.paymentMethod,
      date: purchase.createdAt.toLocaleString().split(",")[0],
    });
  }

  return res.send(purchasesData);
});

router.post("/invoice", validate, async (req, res) => {
  const schema = joi.object({
    purchaseId: joi.string().required(),
  });

  try {
    const data = await schema.validateAsync(req.body);
    const purchase = await Purchase.findById(data.purchaseId);

    if (!purchase) {
      return res.status(404).send("Purchase not found");
    }

    if (
      req.user.type !== "admin" &&
      req.user._id.toString() !== purchase.userId.toString()
    ) {
      return res.status(403).send("Forbidden");
    }

    let invoice = await Invoice.findOne({ purchaseId: purchase._id });

    if (!invoice) {
      const user = await User.findById(purchase.userId);
      if (!user) {
        return res.status(404).send("User not found");
      }

      const itemDetails = await Item.findById(purchase.itemId);

      invoice = new Invoice({
        purchaseId: purchase._id,
        userId: purchase.userId,
        date: new Date(purchase.createdAt).toLocaleDateString(),
        item: itemDetails.title,
        amount: purchase.amount,
        paymentMethod: purchase.paymentMethod,
        to: {
          name: user.name,
          email: user.email,
        },
        from: {
          name: "NoaiGPT",
          email: "invoice@noaigpt.com",
        },
      });

      await invoice.save();
    }

    return res.send(invoice);
  } catch (err) {
    if (err.isJoi) {
      return res.status(400).send(err.details[0].message);
    }
    console.error("Error fetching invoice:", err);
    return res.status(500).send("Internal Server Error");
  }
});
router.post("/create-manual-order", validate, async (req, res) => {
  try {
    const { itemId } = req.body;
    console.log("yeta" + itemId);
    console.log(req.user._id);

    // Find the item by itemId
    const item = await Item.findById(itemId);

    // Check if the item exists and is enabled
    if (!item || !item.enable) {
      return res
        .status(400)
        .json({ error: "Item is not available or disabled" });
    }

    // Generate a unique order ID
    const orderId = `MANUAL_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const orderPrice = item.price;

    // Create a new order
    const order = new Order({
      orderId: orderId,
      userId: req.user._id,
      email: req.user.email, // Add the user's email
      itemId: itemId,
      amount: item.price,
      paymentMethod: "manual",
      status: "created",
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    await order.save();

    // Generate QR code data (replace with actual bank details)
    const qrData = {
      eSewa_id: "9767470586",
      name: "Sarilla Malla Shrestha"
    };

    res.json({ qrData, orderId, orderPrice });
  } catch (error) {
    console.error("Error creating manual order:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

router.post("/confirm-manual-payment", async (req, res) => {
  try {
    const { transactionDetails, orderId } = req.body;
    // Find the order by orderId
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Update the order status to 'pending' and add the transaction details
    order.status = "pending";
    order.transactionDetails = transactionDetails;
    await order.save();

    // Get the current time
    const currentTime = new Date();

    // Send email notification
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: "sunabranjitkar@gmail.com",
      subject: `${process.env.APP_NAME}: New Manual Payment Confirmation (Order ID: ${orderId})`,
      text: `Order ID: ${order.orderId}
      Transaction Details: ${order.transactionDetails}
      Order Status: ${order.status}
      Time: ${currentTime}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
      } else {
        console.log("Email sent:", info.response);
      }
    });

    res.status(200).json({
      message: "Payment confirmation pending",
      orderId: order.orderId,
      transactionDetails: order.transactionDetails,
      orderStatus: order.status,
      time: currentTime,
    });
  } catch (error) {
    console.error("Error confirming manual payment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
// Get all orders
router.get("/orders", validate, async (req, res) => {
  try {
    const { search, sort } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];
    }

    let orders;
    if (sort === "latest") {
      orders = await Order.find({ userId: req.user._id, ...query }).sort({
        createdAt: -1,
      });
    } else if (sort === "oldest") {
      orders = await Order.find({ userId: req.user._id, ...query }).sort({
        createdAt: 1,
      });
    } else {
      orders = await Order.find({ userId: req.user._id, ...query });
    }

    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.post("/cancel-manual-order", validate, async (req, res) => {
  try {
    const { orderId } = req.body;

    // Find the order by orderId
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if the order can be cancelled
    if (order.status !== "created") {
      return res.status(400).json({ error: "Cannot cancel this order" });
    }

    // Update the order status to "cancelled"
    order.status = "cancelled";
    await order.save();

    return res.json({ message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling manual order:", error);
    return res.status(500).json({ error: "An error occurred" });
  }
});
export default router;
