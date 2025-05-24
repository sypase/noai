import joi from "joi";
import express from "express";
import Rewrites from "../../models/Rewrites.js";
import CreditTransaction from "../models/CreditTransaction.js";
// import OpenAI from "openai";
import axios from "axios";
import { validate } from "../../middlewares/validate.js";
import {
  freeItemRewriteCount,
  lengths,
  prompt,
  tones,
} from "../../utils/utils.js";
import dotenv from "dotenv";
const nebulaEndpoint = "https://cognibypass.com/api/models/nebula";

dotenv.config();

const router = express.Router();

router.get("/", (req, res) => {
  res.send("Humanize");
});

router.get("/rewrites", validate, async (req, res) => {
  
  const rewrites = await Rewrites.findOne({ userId: req.user._id });
  if (!rewrites) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);

    const rewrites = new Rewrites({
      userId: savedUser._id,
      rewrites: freeItemRewriteCount,
      expirationDate: expirationDate,
    });
    await newRewrites.save();
    return res.send(newRewrites);
  }
  return res.send(rewrites);
});

router.post("/rewrite", validate, async (req, res) => {
  const schema = joi.object({
    text: joi.string().required(),
    tone: joi.number().required().min(0).max(4),
    length: joi.number().required().min(0).max(2),
    rewrites: joi.number().required().min(1).max(10),
  });

  try {
    const rewrites = await Rewrites.findOne({ userId: req.user._id });

    // Check if the expiration date has passed
    const currentDate = new Date();
    if (rewrites && rewrites.expirationDate < currentDate) {
      // Update rewrites to 0 if the expiration date has passed
      await Rewrites.findOneAndUpdate(
        { userId: req.user._id },
        { rewrites: 0 }
      );
      rewrites.rewrites = 0;
    }

    if (!rewrites) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);
      const newRewrites = new Rewrites({
        userId: req.user._id,
        rewrites: freeItemRewriteCount,
        expirationDate: expirationDate,
      });
      await newRewrites.save();
    }

    console.log(rewrites.rewrites);
    console.log(req.body);

    const wordcountlimit = countWords(req.body.text);
    const creditScorelimit = calculateCredits(wordcountlimit);

    if (wordcountlimit < 50) {
      return res.status(400).send("Word should be at least 50");
    }

    if (rewrites.rewrites < creditScorelimit) {
      return res.status(400).send("Humanize limit exceeded");
    }

    const wordcount = countWords(req.body.text);
    console.log(wordcount + " Word count");
    const creditScore = calculateCredits(wordcount);
    console.log(creditScore + " Credit count");

    try {
      const response = await axios.post(nebulaEndpoint, {
        text: req.body.text,
        uid: process.env.NEBULA_API_KEY,
        level: (req.body.tone + 1).toString(),
      });

      console.log(response.data.output);

      // Deduct credits only if the response is successful
      await Rewrites.findOneAndUpdate(
        { userId: req.user._id },
        { $inc: { rewrites: -creditScore } } // Subtract creditScore from rewrites
      );

      // Record the credit transaction
      const creditTransaction = new CreditTransaction({
        userId: req.user._id,
        type: "credit_used",
        amount: creditScore,
      });
      await creditTransaction.save();

      return res.send({ output: response.data.output });
    } catch (error) {
      console.error("Error calling Nebula API:", error);
      return res
        .status(500)
        .send("An error occurred while calling the NoaiGPT API");
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }
});

function countWords(str) {
  // Remove leading and trailing whitespace, then split by whitespace
  const words = str.trim().split(/\s+/);
  // Return the length of the array, which represents the number of words
  return words.length;  
}

function calculateCredits(score) {
  // Ensure the score is a valid number
  if (isNaN(score) || score < 0) {
    return "Invalid score";
  }

  // Determine the number of credits based on the score range
  if (score >= 0 && score <= 149) {
    return 1;
  } else if (score >= 150 && score <= 249) {
    return 2;
  } else if (score >= 250 && score <= 349) {
    return 3;
  } else {
    // Calculate the number of credits for scores above 349
    const creditsBase = 3;
    const scoreRange = 100;
    const creditsIncrement = Math.floor((score - 249) / scoreRange);
    return creditsBase + creditsIncrement;
  }
}
router.get("/userExpirationDate", validate, async (req, res) => {
  try {
    const userId = req.user._id;
    const expirationDate = await getUserExpirationDate(userId);
    console.log(expirationDate);
    return res.send({ expirationDate });
  } catch (err) {
    console.error("Error fetching user expiration date:", err);
    return res.status(500).send("Internal Server Error");
  }
});

async function getUserExpirationDate(userId) {
  try {
    const rewrites = await Rewrites.findOne({ userId: userId });
    if (rewrites) {
      return rewrites.expirationDate;
    } else {
      return null;
    }
  } catch (err) {
    console.error("Error fetching user expiration date:", err);
    throw err;
  }
}

export default router;
