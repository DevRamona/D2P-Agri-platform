const bcrypt = require("bcryptjs");
const { User } = require("../models/User");
const { RefreshToken } = require("../models/RefreshToken");
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } = require("../utils/token");
const { env } = require("../config/env");

const parseExpiry = (value) => {
  const match = String(value).match(/^(\d+)([smhd])$/);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return amount * multiplier;
};

class AuthService {
  async register({ fullName, phoneNumber, password, role }) {
    const existing = await User.findOne({ phoneNumber });
    if (existing) {
      throw { code: "CONFLICT", message: "Phone number already in use" };
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ fullName, phoneNumber, passwordHash, role });

    return { user };
  }

  async login({ phoneNumber, password }) {
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      throw { code: "UNAUTHORIZED", message: "Invalid credentials" };
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw { code: "UNAUTHORIZED", message: "Invalid credentials" };
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const tokenHash = hashToken(refreshToken);

    const expiresAt = new Date(Date.now() + parseExpiry(env.jwtRefreshExpiresIn));
    await RefreshToken.create({ userId: user.id, tokenHash, expiresAt });

    return { accessToken, refreshToken, user };
  }

  async refresh(token) {
    let payload;
    try {
      payload = verifyRefreshToken(token);
      if (payload.type !== "refresh") {
        throw new Error("Invalid token type");
      }
    } catch (error) {
      throw { code: "UNAUTHORIZED", message: "Invalid or expired refresh token" };
    }

    const tokenHash = hashToken(token);
    const stored = await RefreshToken.findOne({ tokenHash, userId: payload.sub });
    if (!stored) {
      throw { code: "UNAUTHORIZED", message: "Refresh token revoked" };
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw { code: "NOT_FOUND", message: "User not found" };
    }

    const accessToken = signAccessToken(user);
    return { accessToken };
  }

  async me(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw { code: "NOT_FOUND", message: "User not found" };
    }
    return { user };
  }

  async logout(token) {
    const tokenHash = hashToken(token);
    await RefreshToken.deleteOne({ tokenHash });
    return { message: "Logged out" };
  }
}

module.exports = new AuthService();
