const { z } = require("zod");

const roleEnum = z.enum(["FARMER", "BUYER", "ADMIN"]);

const registerSchema = z.object({
  fullName: z.string().min(2),
  phoneNumber: z.string().min(7).optional(),
  email: z.string().email("Invalid email address").optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: roleEnum,
  adminInviteCode: z.string().min(3).optional(),
}).refine(data => data.phoneNumber || data.email, {
  message: "Either phone number or email is required",
  path: ["phoneNumber"],
});

const loginSchema = z.object({
  identifier: z.string().min(3), // Can be phone or email
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
