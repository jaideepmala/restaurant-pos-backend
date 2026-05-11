const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Restaurant = require("../models/Restaurant");
const User = require("../models/User");

const router = express.Router();

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const getJwtSecret = () => {
  // Keep Render/local deployments alive even before JWT_SECRET is configured.
  // Add JWT_SECRET in Render env vars before production traffic.
  return process.env.JWT_SECRET || "supersecretkey";
};

const ensureDefaultRestaurantForLegacyUser = async (user) => {
  if (user.restaurantId) {
    return user.restaurantId;
  }

  const restaurant = await Restaurant.findOneAndUpdate(
    { slug: "default-restaurant" },
    {
      $setOnInsert: {
        name: "Default Restaurant",
        slug: "default-restaurant",
      },
    },
    { new: true, upsert: true }
  );

  user.restaurantId = restaurant._id;
  await user.save();

  return restaurant._id;
};

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, restaurantId, restaurantName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "name, email, and password are required",
      });
    }

    let resolvedRestaurantId = restaurantId;

    if (!resolvedRestaurantId) {
      const resolvedRestaurantName = restaurantName || `${name}'s Restaurant`;
      const slug = slugify(resolvedRestaurantName);

      const restaurant = await Restaurant.findOneAndUpdate(
        { slug },
        {
          $setOnInsert: {
            name: resolvedRestaurantName,
            slug,
          },
        },
        { new: true, upsert: true }
      );

      resolvedRestaurantId = restaurant._id;
    }

    const existingUser = await User.findOne({
      restaurantId: resolvedRestaurantId,
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists for this restaurant",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      restaurantId: resolvedRestaurantId,
      name,
      email,
      password: hashedPassword,
      role,
    });

    res.status(201).json({
      message: "User registered",
      user: {
        id: user._id,
        restaurantId: user.restaurantId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "email and password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const restaurantId = await ensureDefaultRestaurantForLegacyUser(user);

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        restaurantId,
      },
      getJwtSecret(),
      {
        expiresIn: "7d",
      }
    );

    res.json({
      token,
      user: {
        id: user._id,
        restaurantId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;
