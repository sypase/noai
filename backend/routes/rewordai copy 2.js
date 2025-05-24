import express from "express";
import Rewrites from "../models/Rewrites.js";
import axios from "axios";
import { validate } from "../middlewares/validate.js";
import { freeItemRewriteCount, lengths, prompt, tones } from "../utils/utils.js";
import dotenv from "dotenv";
import { OpenAI } from "openai"; // Assuming you have the OpenAI library installed

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

    const newRewrites = new Rewrites({
      userId: req.user._id,
      words: freeItemRewriteCount,
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
  });

  try {
    const rewrites = await Rewrites.findOne({ userId: req.user._id });

    // Check if the expiration date has passed
    const currentDate = new Date();
    if (rewrites && rewrites.expirationDate < currentDate) {
      // Update words to 0 if the expiration date has passed
      await Rewrites.findOneAndUpdate(
        { userId: req.user._id },
        { words: 0 }
      );
      rewrites.words = 0;
    }

    if (!rewrites) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);
      const newRewrites = new Rewrites({
        userId: req.user._id,
        words: freeItemRewriteCount,
        expirationDate: expirationDate,
      });
      await newRewrites.save();
    }

    const wordCount = countWords(req.body.text);

    if (wordCount < 50) {
      return res.status(400).send("Word count should be at least 50");
    }

    if (rewrites.words < wordCount) {
      return res.status(400).send("Word limit exceeded");
    }

    try {
      const openai = new OpenAI(process.env.OPENAI_API_KEY);
      const response = await openai.chat.completions.create({
        model: "ft:gpt-3.5-turbo-0125:personal::9qGC8cwZ",
        temperature: 0.87,
        messages: [
          {
            role: 'system',
            content: `
              You are a text humanizer.
              You humanize AI generated text.
              The text must appear like humanly written.
              THE INPUT AND THE OUTPUT TEXT SHOULD HAVE THE SAME FORMAT.
              THE HEADINGS AND THE BULLETS IN THE INPUT SHOULD REMAIN IN PLACE
            `,
          },
          {
            role: 'user',
            content: `
              THE LANGUAGE OF THE INPUT AND THE OUTPUT MUST BE SAME. THE SENTENCES SHOULD NOT BE SHORT LENGTH - THEY SHOULD BE SAME AS IN THE INPUT. ALSO THE PARAGRAPHS SHOULD NOT BE SHORT EITHER - PARAGRAPHS MUST HAVE THE SAME LENGTH
            `,
          },
          {
            role: 'user',
            content: `Humanize the text. Keep the output format i.e. the bullets and the headings as it is and don't use the list of words that are not permissible. \nTEXT: ${req.body.text}`,
          },
        ],
      });

      const humanizedText = response.choices[0].message.content;

      // Deduct words only if the response is successful
      await Rewrites.findOneAndUpdate(
        { userId: req.user._id },
        { $inc: { words: -wordCount } } // Subtract wordCount from words
      );

      return res.send({ output: humanizedText });
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      return res
        .status(500)
        .send("An error occurred while calling the OpenAI API");
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }
});

function countWords(str) {
  const words = str.trim().split(/\s+/);
  return words.length;
}

router.get("/userExpirationDate", validate, async (req, res) => {
  try {
    const userId = req.user._id;
    const expirationDate = await getUserExpirationDate(userId);
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