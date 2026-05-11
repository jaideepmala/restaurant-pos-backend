const jwt = require("jsonwebtoken");
const Restaurant = require("../models/Restaurant");
const User = require("../models/User");

const getJwtSecrets = () => {
  const secrets = [];

  if (process.env.JWT_SECRET) {
    secrets.push(process.env.JWT_SECRET);
  }

  // Backward compatibility for tokens/login from the first MVP version.
  secrets.push("supersecretkey");

  return [...new Set(secrets)];
};

const verifyToken = (token) => {
  for (const secret of getJwtSecrets()) {
    try {
      return jwt.verify(token, secret);
    } catch (err) {
      // Try the next secret.
    }
  }

  throw new Error("Invalid token");
};

const ensureDefaultRestaurantForUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  if (user.restaurantId) {
    return {
      restaurantId: user.restaurantId,
      role: user.role,
    };
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

  return {
    restaurantId: restaurant._id,
    role: user.role,
  };
};

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded.userId) {
      return res.status(401).json({
        message: "Token is missing user context",
      });
    }

    let role = decoded.role;
    let restaurantId = decoded.restaurantId;

    if (!restaurantId || !role) {
      const legacyContext = await ensureDefaultRestaurantForUser(decoded.userId);
      restaurantId = legacyContext.restaurantId;
      role = legacyContext.role;
    }

    req.user = {
      userId: decoded.userId,
      role,
      restaurantId,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      message: "Invalid token",
    });
  }
};

module.exports = protect;
