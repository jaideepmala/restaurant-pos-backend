const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

// GET orders
router.get("/", async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

// CREATE order
router.post("/", async (req, res) => {
  const order = await Order.create(req.body);
  res.json(order);
});

module.exports = router;