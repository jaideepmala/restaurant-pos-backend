const express = require("express");
const Order = require("../models/Order");
const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const router = express.Router();

const orderTypeMap = {
  "Dine In": "DINE_IN",
  Takeaway: "TAKEAWAY",
  Delivery: "DELIVERY",
  DINE_IN: "DINE_IN",
  TAKEAWAY: "TAKEAWAY",
  DELIVERY: "DELIVERY",
};

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Order must contain at least one item");
  }

  return items.map((item) => {
    const quantity = Number(item.quantity);
    const price = Number(item.price);

    if (!item.name || !Number.isInteger(quantity) || quantity < 1 || Number.isNaN(price) || price < 0) {
      throw new Error("Each item requires name, positive quantity, and valid price");
    }

    return {
      productId: item.productId || item._id || item.id,
      name: item.name,
      quantity,
      price,
      lineTotal: price * quantity,
    };
  });
};

router.get(
  "/",
  protect,
  allowRoles("admin", "cashier", "kitchen"),
  async (req, res) => {
    const orders = await Order.find({
      restaurantId: req.user.restaurantId,
    }).sort({ createdAt: -1 });

    res.json(orders);
  }
);

router.post("/", protect, allowRoles("admin", "cashier"), async (req, res) => {
  try {
    const { items, tableName, mode, orderType } = req.body;
    const normalizedItems = normalizeItems(items);
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const tax = Math.round(subtotal * 0.05);
    const serviceCharge = normalizedItems.length ? 24 : 0;
    const totalAmount = subtotal + tax + serviceCharge;

    const order = await Order.create({
      restaurantId: req.user.restaurantId,
      cashierId: req.user.userId,
      items: normalizedItems,
      subtotal,
      tax,
      serviceCharge,
      totalAmount,
      tableName,
      orderType: orderTypeMap[orderType || mode] || "DINE_IN",
      status: "PLACED",
    });

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || "Invalid order" });
  }
});

router.patch(
  "/:id/status",
  protect,
  allowRoles("admin", "kitchen"),
  async (req, res) => {
    try {
      const { status } = req.body;

      const order = await Order.findOneAndUpdate(
        {
          _id: req.params.id,
          restaurantId: req.user.restaurantId,
        },
        { status },
        { new: true, runValidators: true }
      );

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(order);
    } catch (err) {
      console.error(err);
      res.status(400).json({ message: "Invalid status update" });
    }
  }
);

module.exports = router;
