import joi from "joi";
import express from "express";
import Document from "../models/Document.js";
import { validate } from "../middlewares/validate.js";

const router = express.Router();

router.get("/list", validate, async (req, res) => {
    const documents = (await Document.find({ userId: req.user._id })).reverse();

    res.send({ user: { name: req.user.name, email: req.user.email, type: req.user.type }, documents: documents });
});

router.post("/by-id", validate, async (req, res) => {
    const schema = joi.object({
        documentId: joi.string().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);
        return res.send(await Document.findById(data.documentId));
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.post("/create", validate, async (req, res) => {
    const schema = joi.object({
        title: joi.string().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);
        const newDocument = new Document({
            title: data.title,
            content: "",
            userId: req.user._id,
        });

        await newDocument.save();

        return res.send(newDocument);
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.post("/save", validate, async (req, res) => {
    const schema = joi.object({
        documentId: joi.string().required(),
        content: joi.string().required().allow(""),
        tone: joi.number().required().min(0).max(4),
        length: joi.number().required().min(0).max(2),
        rewrites: joi.number().required().min(1).max(10),
    });

    try {
        const data = await schema.validateAsync(req.body);

        await Document.updateOne({ _id: data.documentId }, { content: data.content, settings: { tone: data.tone, length: data.length, rewrites: data.rewrites } });

        return res.send("Saved");
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.post("/edit", validate, async (req, res) => {
    const schema = joi.object({
        documentId: joi.string().required(),
        title: joi.string().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);

        await Document.updateOne({ _id: data.documentId }, { title: data.title });

        return res.send("Renamed");
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

router.post("/delete", validate, async (req, res) => {
    const schema = joi.object({
        documentId: joi.string().required(),
    });

    try {
        const data = await schema.validateAsync(req.body);

        await Document.deleteOne({ _id: data.documentId });

        return res.send("Deleted");
    }
    catch (err) {
        return res.status(500).send(err);
    }
});

export default router;