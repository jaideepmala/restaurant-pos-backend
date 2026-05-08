const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const protect = require("../middleware/authMiddleware");

// GET all orders
router.get("/", protect, async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

// CREATE order (SECURE)
router.post("/", protect, async (req, res) => {
  try {
    const { items, total } = req.body;

    const order = await Order.create({
      items,
      total,
      userId: req.user.userId, // 🔐 from token, not client
      status: "PLACED",
      createdAt: new Date(),
    });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;