import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import itemsRouter from "./routes/shop.js";
import adminRouter from "./routes/admin.js";
import usersRouter from "./routes/users.js";
import rewordRouter from "./routes/rewordai.js";
import documentsRouter from "./routes/documents.js";
import test from "./routes/test.js"
import free from "./routes/free.js"
import Referral from "./routes/referrals.js";
import imepayRoutes from './routes/imepay.js';


// import aichecker from "./routes/aichecker.js"; // Import the aichecker route


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/rewordai", rewordRouter);
app.use("/users", usersRouter);
app.use("/documents", documentsRouter);
app.use("/admin", adminRouter);
app.use("/shop", itemsRouter);
app.use("/test", test);
app.use("/free", free);
app.use("/referrals", Referral);
app.use("/imepay", imepayRoutes);





app.get("/", (req, res) => {
  res.send("NoaiGPT API");
});

async function connectDB() {
  try {
    await mongoose.connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

connectDB();

const port = process.env.PORT || 8080;

// Create an HTTP server
const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Internal Server Error");
});

// 404 error handling middleware
app.use((req, res, next) => {
  res.status(404).send("Not Found");
});