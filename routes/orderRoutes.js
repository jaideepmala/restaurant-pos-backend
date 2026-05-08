const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const protect = require("../middleware/authMiddleware");

// GET orders
router.get("/", async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

// CREATE order
router.post("/", protect, async (req, res) => {
  const order = await Order.create(req.body);
  res.json(order);
});


module.exports = router;