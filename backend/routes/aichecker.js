import joi from "joi";
import express from "express";
import { validate } from "../middlewares/validate.js";
import { Client } from "@gradio/client";

const router = express.Router();
console.log("Connecting to Gradio client...");
const app = await Client.connect("NoaiGPT/AiChecker");

router.post("/", async (req, res) => {
  console.log("Received request:", req.body);

  const schema = joi.object({
    textFile: joi.string().required(),
  });

  try {
    const data = await schema.validateAsync(req.body);
    const textFile = data.textFile;

 

    console.log("Running prediction...");
    const transcription = await app.predict("/predict", [textFile]);

    console.log("Prediction result:", transcription.data[0]);

    return res.send({ transcription: transcription.data[0] });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).send("Internal Server Error");
  }
});

export default router;