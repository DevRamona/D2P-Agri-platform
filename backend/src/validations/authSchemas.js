const { z } = require("zod");

const roleEnum = z.enum(["FARMER", "BUYER"]);

const registerSchema = z.object({
  fullName: z.string().min(2),
  phoneNumber: z.string().min(7),
  password: z.string().min(6),
  role: roleEnum,
});

const loginSchema = z.object({
  phoneNumber: z.string().min(7),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  roleEnum,
};
