import joi from "joi";
import express from "express";
import Rewrites from "../models/Rewrites.js";
import OpenAI from "openai";
import { validate } from "../middlewares/validate.js";
import { freeItemRewriteCount, lengths, prompt, tones } from "../utils/utils.js";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const paraphraserModel = "gpt-3.5-turbo";
const tokenLengths = [100, 200, 300];

const router = express.Router();

router.get("/", (req, res) => {
    res.send("Paraphraser");
});

router.get("/rewrites", validate, async (req, res) => {
    const rewrites = await Rewrites.findOne({ userId: req.user._id });
    if (!rewrites) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 30);

        const newRewrites = new Rewrites({
            userId: req.user._id,
            rewrites: freeItemRewriteCount,
            expirationDate: expirationDate,
        });
        await newRewrites.save();
        return res.send(newRewrites);
    }
    return res.send(rewrites);
});

router.post("/paraphrase", validate, async (req, res) => {
    const schema = joi.object({
        text: joi.string().required(),
        length: joi.number().required().min(0).max(2),
    });

    try {
        const data = await schema.validateAsync(req.body);

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

        if (rewrites.rewrites < 1) return res.status(400).send("Rewrites limit exceeded");

        await Rewrites.findOneAndUpdate({ userId: req.user._id }, { $inc: { rewrites: -1 } });

        const completion = await openai.chat.completions.create({
            model: paraphraserModel,
            messages: [
                { "role": "system", "content": "You are a paraphraser that rephrases text in different ways while preserving the original meaning." },
                { "role": "user", "content": `Paraphrase this text: "${data.text}"` }
            ],
            max_tokens: tokenLengths[data.length],
        });

        return res.send(completion.choices[0].message.content);
    }
    catch (err) {
        console.log(err)
        return res.status(500).send(err);
    }
});

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