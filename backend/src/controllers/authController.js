const { registerSchema, loginSchema, refreshSchema } = require("../validations/authSchemas");
const authService = require("../services/authService");
const { success, failure } = require("../utils/response");

const toUserDto = (user) => ({
  id: user.id || user._id,
  fullName: user.fullName,
  phoneNumber: user.phoneNumber,
  role: user.role,
  createdAt: user.createdAt,
});

const register = async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(failure("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()));
  }

  try {
    console.log("Registering user:", parsed.data.phoneNumber || parsed.data.email);
    const { user } = await authService.register(parsed.data);
    console.log("User registered:", user.id);
    return res.status(201).json(success({ user: toUserDto(user) }));
  } catch (error) {
    if (error.code === "CONFLICT") {
      return res.status(409).json(failure("CONFLICT", error.message));
    }
    if (error.code === "FORBIDDEN") {
      return res.status(403).json(failure("FORBIDDEN", error.message));
    }
    console.error("Register error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
  }
};

const login = async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(failure("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()));
  }

  try {
    const { accessToken, refreshToken, user } = await authService.login(parsed.data);
    return res.status(200).json(success({ accessToken, refreshToken, user: toUserDto(user) }));
  } catch (error) {
    if (error.code === "UNAUTHORIZED") {
      return res.status(401).json(failure("UNAUTHORIZED", error.message));
    }
    console.error("Login error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
  }
};

const refresh = async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(failure("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()));
  }

  try {
    const { accessToken } = await authService.refresh(parsed.data.refreshToken);
    return res.status(200).json(success({ accessToken }));
  } catch (error) {
    if (error.code === "UNAUTHORIZED") {
      return res.status(401).json(failure("UNAUTHORIZED", error.message));
    }
    if (error.code === "NOT_FOUND") {
      return res.status(404).json(failure("NOT_FOUND", error.message));
    }
    console.error("Refresh error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
  }
};

const me = async (req, res) => {
  try {
    const { user } = await authService.me(req.user.id);
    return res.status(200).json(success({ user: toUserDto(user) }));
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return res.status(404).json(failure("NOT_FOUND", error.message));
    }
    console.error("Me error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
  }
};

const logout = async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(failure("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()));
  }

  try {
    await authService.logout(parsed.data.refreshToken);
    return res.status(200).json(success({ message: "Logged out" }));
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
  }
};

module.exports = {
  register,
  login,
  refresh,
  me,
  logout,
};

