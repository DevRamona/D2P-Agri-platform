const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, unique: true, sparse: true, trim: true },
    email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["FARMER", "BUYER"], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const User = mongoose.model("User", userSchema);

module.exports = { User };
