import joi from "joi";
import bcrypt from "bcrypt";
import express from "express";
import jwt from "jsonwebtoken";
import User from "../../models/User.js";
import Rewrites from "../../models/Rewrites.js";
import { validate } from "../../middlewares/validate.js";
import ResetPassword from "../../models/ResetPassword.js"; // Import ResetPassword model
import { freeItemRewriteCount, logoBase64 } from "../../utils/utils.js";
import dotenv from "dotenv";
import EmailVerification from "../../models/EmailVerification.js";
import nodemailer from "nodemailer";
import smtpTransport from "nodemailer-smtp-transport";
import { verify } from '../google-auth.js';

dotenv.config();

const router = express.Router();

// router.get("/", validate, (req, res) => {
//   res.send("Users");
// });

router.get("/", validate, (req, res) => {
  res.send({ 
    user: {
      name: req.user.name,
      email: req.user.email,
      type: req.user.type
    }
  });
});


router.post("/signup", async (req, res) => {
  const schema = joi.object({
    name: joi.string().min(3).required(),
    email: joi.string().min(6).required().email(),
    password: joi.string().min(6).required(),
  });

  try {
    const data = await schema.validateAsync(req.body);

    if (await User.findOne({ email: data.email }))
      return res.status(400).send("Email already exists");

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const users = await User.find();

    const newUser = new User({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      type: users.length == 0 ? "admin" : "user",
    });

    const savedUser = await newUser.save();

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);

    const rewrites = new Rewrites({
      userId: savedUser._id,
      rewrites: freeItemRewriteCount,
      expirationDate: expirationDate,
    });

    await rewrites.save();

    return res.send(savedUser);
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.post("/login", async (req, res) => {
  const schema = joi.object({
    email: joi.string().min(6).required().email(),
    password: joi.string().min(6),
  });

  try {
    const data = await schema.validateAsync(req.body);

    const user = await User.findOne({ email: data.email });

    if (!user) return res.status(400).send("Email or password is wrong");

    const validPassword = await bcrypt.compare(data.password, user.password);

    if (!validPassword)
      return res.status(400).send("Email or password is wrong");

    const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET);

    return res.send({ user: user, token: token });
  } catch (err) {
    return res.status(500).send(err);
  }
});

async function sendEmail(email, res) {
  const transporter = nodemailer.createTransport(
    smtpTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      requireTLS: true,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  );

  const minm = 1000;
  const maxm = 9999;
  const code = Math.floor(Math.random() * (maxm - minm + 1)) + minm;

  const options = {
    from: `${process.env.APP_NAME} <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Verify your email address`,
    html: `
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 10px; font-family: Arial, sans-serif;">
        <div style="background-color: #333; color: #fff; padding: 20px; border-radius: 5px; text-align: center;">
          <h1>${process.env.APP_NAME}</h1>
        </div>
        <div style="background-color: #fff; padding: 20px; border-radius: 5px; margin-top: 20px;">
          <h2 style="color: #333;">Verify your email</h2>
          <p style="font-size: 16px; line-height: 1.5; color: #555;">
            Thank you for registering with ${
              process.env.APP_NAME
            }. To complete the verification process, please enter the following code:
          </p>
          <p style="font-size: 24px; font-weight: bold; color: #333; text-align: center;">${code.toString()}</p>
          <p style="font-size: 16px; line-height: 1.5; color: #555;">
            If you did not initiate this request, please ignore this email.
          </p>
        </div>
        <div style="text-align: center; margin-top: 20px;">
          <p style="font-size: 14px; color: #777;">© ${new Date().getFullYear()} ${
      process.env.APP_NAME
    }. All rights reserved.</p>
        </div>
      </div>
    `,
  };

  transporter.sendMail(options, async (err, info) => {
    if (err) {
      console.log(err);
      return res.status(500).send(err);
    }

    const emailVerification = await EmailVerification.findOne({ email });
    if (emailVerification) {
      await EmailVerification.findOneAndUpdate(
        { email },
        { code: code.toString() }
      );
    } else {
      const newEmailVerification = new EmailVerification({
        email,
        code: code.toString(),
        isVerified: false,
      });
      await newEmailVerification.save();
    }

    return res.send("Email sent!");
  });
}
router.post("/send-verification-code", async (req, res) => {
  const schema = joi.object({
    email: joi.string().email().required(),
  });

  try {
    const data = await schema.validateAsync(req.body);

    const emailVerification = await EmailVerification.findOne({
      email: data.email,
    });
    if (emailVerification && emailVerification.isVerified)
      return res.status(400).send("Email already verified");

    await sendEmail(data.email, res, false);
  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }
});

router.post("/verify-email", async (req, res) => {
  const schema = joi.object({
    email: joi.string().email().required(),
    code: joi.string().required(),
  });

  try {
    const data = await schema.validateAsync(req.body);
    const emailVerification = await EmailVerification.findOne({
      email: data.email,
    });

    if (!emailVerification) return res.status(404).send("Email not found");

    if (emailVerification.code === data.code) {
      await EmailVerification.updateOne(
        { email: data.email },
        { isVerified: true }
      );
      return res.send("Email verified!");
    } else {
      return res.status(400).send("Invalid code");
    }
  } catch (err) {
    return res.status(500).send(err);
  }
});
router.post("/reset-password", async (req, res) => {
  const schema = joi.object({
    email: joi.string().email().required(),
  });

  try {
    const data = await schema.validateAsync(req.body);
    console.log(data);

    // Check if user exists
    const user = await User.findOne({ email: data.email });
    if (!user) return res.status(404).send("User not found");

    // Generate a random reset code
    const resetCode = Math.random().toString(36).substring(7);

    // Save reset code in the database
    const resetEntry = new ResetPassword({
      email: data.email,
      resetCode: resetCode,
    });
    await resetEntry.save();

    // Send reset password email
    const resetLink = `http://noaigpt.com/reset-password/${resetCode}`;
    const emailBody = `Click on the following link to reset your password: ${resetLink}`;

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true, // Set to true for SSL/TLS connection
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Define email options
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: data.email,
      subject: "Password Reset",
      text: emailBody,
    };

    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).send("Failed to send reset password email");
      } else {
        console.log("Reset password email sent:", info.response);
        return res.send("Reset password email sent successfully");
      }
    });
  } catch (err) {
    console.error("Error resetting password:", err);
    return res.status(500).send("Internal server error");
  }
});

router.post("/reset-password/confirm", async (req, res) => {
  const schema = joi.object({
    resetCode: joi.string().required(),
    newPassword: joi.string().min(6).required(),
  });

  try {
    const data = await schema.validateAsync(req.body);

    // Find the reset entry based on the reset code
    const resetEntry = await ResetPassword.findOne({
      resetCode: data.resetCode,
    });

    // If reset entry not found, return error
    if (!resetEntry)
      return res.status(404).send("Invalid or expired reset code");

    // Check if reset code has already been used
    if (resetEntry.isReset) {
      return res.status(400).send("This reset code has already been used");
    }

    // Check if reset code is expired (optional, based on your implementation)
    // Implement your expiration logic here...

    // If reset code is valid, update user's password
    const hashedPassword = await bcrypt.hash(data.newPassword, 10);
    await User.updateOne(
      { email: resetEntry.email },
      { password: hashedPassword }
    );

    // Mark reset entry as used
    resetEntry.isReset = true;
    await resetEntry.save();

    return res.send("Password reset successful");
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.post('/google-auth', async (req, res) => {
  try {
    const { tokenId } = req.body;

    // Verify the Google Auth token
    const { email, name } = await verify(tokenId);

    // Check if the user already exists or create a new user
    let user = await User.findOne({ email });
    if (!user) {
      const hashedPassword = await bcrypt.hash(email + process.env.SALT_KEY, 10); // Generate a random password for new users
      user = new User({ name, email, password: hashedPassword });
      const savedUser = await user.save();
      
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);

      const rewrites = new Rewrites({
        userId: savedUser._id,
        rewrites: freeItemRewriteCount,
        expirationDate: expirationDate,
      });

      await rewrites.save();
    }

    // Generate a JWT token and send it back to the client
    const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET);

    // const token = jwt.sign({ userId: user._id }, process.env.TOKEN_SECRET);
    return res.send({ user: user, token: token });

  } catch (error) {
    console.error('Error authenticating with Google:', error);
    return res.status(500).json({ error: 'Error authenticating with Google' });
  }
});


export default router;
