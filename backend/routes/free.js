import express from 'express';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import axios from 'axios';

// Load environment variables from .env file
dotenv.config();

// Get OpenAI API key from process.env
const openaiApiKey = process.env.OPENAI_API_KEY;

const router = express.Router();

// Create a rate limiter
const limiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => req.ip, // Use the IP address for rate limiting
  message: "Too many requests, please try again later.",
  statusCode: 429, // HTTP status code to return when rate limit is exceeded
});

// Apply the rate limiter to all routes in this file
router.use(limiter);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: openaiApiKey,
});

router.get('/', (req, res) => {
  res.send('This is a test route');
});

router.post("/rewrite", async (req, res) => {
  const { text, setting = 1, output_format = "text" } = req.body;
  const UNDETECTABLE_AI_API_KEY = process.env.UNDETECTABLE_AI_API_KEY; // Use environment variable for the API key

  try {
    async function humanizeText(inputText) {
      const response = await openai.chat.completions.create({
        model: "ft:gpt-4o-mini-2024-07-18:personal:noaigptv1:9urnCuyb",
        temperature: 0.92,
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
            content: `Humanize the text. Keep the output format i.e. the bullets and the headings as it is and don't use the list of words that are not permissible. \nTEXT: ${inputText}`,
          },
        ],
      });

      return response.choices[0].message.content;
    }

    async function checkWithUndetectableAI(text) {
      const response = await axios.post('https://aicheck.undetectable.ai/detectIndividual', {
        text: text,
        key: UNDETECTABLE_AI_API_KEY
      });
      return response.data.human;
    }

    let finalHumanizedText = await humanizeText(text);
    finalHumanizedText = await humanizeText(finalHumanizedText);

    let humanScore = await checkWithUndetectableAI(finalHumanizedText);
    let attempts = 0;
    const maxAttempts = 3; // Set a maximum number of attempts to prevent infinite loops

    while (humanScore <= 80 && attempts < maxAttempts) {
      finalHumanizedText = await humanizeText(finalHumanizedText);
      humanScore = await checkWithUndetectableAI(finalHumanizedText);
      attempts++;
    }

    // Get remaining attempts
    const remainingAttempts = req.rateLimit.remaining;

    res.json({
      humanizedText: finalHumanizedText,
      humanScore: humanScore,
      remainingAttempts: remainingAttempts
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});

export default router;