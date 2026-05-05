const express = require("express");
const { webcrypto } = require("crypto");
// Node 18 fallback for MongoDB driver that expects globalThis.crypto.
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const mongoose = require("mongoose");

const app = express();
app.use(express.json());

// Mongo connection
mongoose.connect(
  "mongodb://mongo-0.mongo.default.svc.cluster.local:27017,mongo-1.mongo.default.svc.cluster.local:27017,mongo-2.mongo.default.svc.cluster.local:27017/mydb?replicaSet=rs0"
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

// PUT update item by id
app.put("/items/:id", async (req, res) => {
  try {
    const updatedItem = await Item.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!updatedItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json(updatedItem);
  } catch (err) {
    res.status(400).json({ message: "Invalid request", error: err.message });
  }
});

// DELETE item by id
app.delete("/items/:id", async (req, res) => {
  try {
    const deletedItem = await Item.findByIdAndDelete(req.params.id);

    if (!deletedItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json({ message: "Item deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: "Invalid request", error: err.message });
  }
});

// Start server
app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});