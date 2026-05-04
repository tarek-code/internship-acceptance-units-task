const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

// Mongo connection
mongoose.connect(
  "mongodb://mongo-0.mongo:27017,mongo-1.mongo:27017,mongo-2.mongo:27017/mydb?replicaSet=rs0"
)
.then(() => console.log("MongoDB connected"))
.catch(err => console.log(err));

// Schema
const itemSchema = new mongoose.Schema({
  name: String
});

const Item = mongoose.model("Item", itemSchema);

// Routes
app.get("/", (req, res) => {
  res.send("API is working 🚀");
});

// GET from DB
app.get("/items", async (req, res) => {
  const items = await Item.find();
  res.json(items);
});

// POST to DB
app.post("/items", async (req, res) => {
  const item = new Item(req.body);
  const savedItem = await item.save();
  res.status(201).json(savedItem);
});

// Start server
app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});