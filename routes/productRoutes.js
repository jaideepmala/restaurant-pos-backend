const express = require("express");
const Product = require("../models/Product");
const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
  "/",
  protect,
  allowRoles("admin", "cashier", "kitchen"),
  async (req, res) => {
    const products = await Product.find({
      restaurantId: req.user.restaurantId,
    }).sort({ category: 1, name: 1 });

    res.json(products);
  }
);

router.post("/", protect, allowRoles("admin"), async (req, res) => {
  try {
    const product = await Product.create({
      ...req.body,
      restaurantId: req.user.restaurantId,
    });

    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id", protect, allowRoles("admin"), async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      {
        _id: req.params.id,
        restaurantId: req.user.restaurantId,
      },
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
