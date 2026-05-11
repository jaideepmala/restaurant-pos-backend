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

const createTokenPayload = (user, restaurantId) => ({
  userId: user._id,
  role: user.role,
  restaurantId,
});

const buildAuthResponse = (user, restaurantId) => ({
  token: jwt.sign(createTokenPayload(user, restaurantId), getJwtSecret(), {
    expiresIn: "7d",
  }),
  user: {
    id: user._id,
    restaurantId,
    name: user.name,
    email: user.email,
    role: user.role,
  },
});

const createUniqueRestaurantSlug = async (restaurantName) => {
  const baseSlug = slugify(restaurantName) || "restaurant";
  let slug = baseSlug;
  let suffix = 1;

  while (await Restaurant.exists({ slug })) {
    suffix += 1;
    slug = baseSlug + "-" + suffix;
  }

  return slug;
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

router.post("/signup-restaurant", async (req, res) => {
  try {
    const { restaurantName, ownerName, email, password } = req.body;

    if (!restaurantName || !ownerName || !email || !password) {
      return res.status(400).json({
        message: "restaurantName, ownerName, email, and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        message: "An account with this email already exists",
      });
    }

    const slug = await createUniqueRestaurantSlug(restaurantName);
    const restaurant = await Restaurant.create({
      name: restaurantName,
      slug,
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      restaurantId: restaurant._id,
      name: ownerName,
      email: normalizedEmail,
      password: hashedPassword,
      role: "admin",
    });

    res.status(201).json({
      message: "Restaurant created",
      restaurant: {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
      },
      ...buildAuthResponse(user, restaurant._id),
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
    });
  }
});

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

    res.json(buildAuthResponse(user, restaurantId));
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;
