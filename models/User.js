const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "cashier", "kitchen"],
      default: "cashier",
    },
  },
  { timestamps: true }
);

userSchema.index({ restaurantId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
