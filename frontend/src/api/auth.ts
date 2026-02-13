import type { UserRole } from "../types";
import { apiFetch } from "./client";

export type ApiRole = "FARMER" | "BUYER";

export type ApiUser = {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: ApiRole;
  createdAt: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
};

export const toApiRole = (role: UserRole): ApiRole => (role === "farmer" ? "FARMER" : "BUYER");
export const fromApiRole = (role: ApiRole): UserRole => (role === "FARMER" ? "farmer" : "buyer");

export const register = (payload: {
  fullName: string;
  phoneNumber?: string;
  email?: string;
  password: string;
  role: UserRole;
}) =>
  apiFetch<{ user: ApiUser }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      fullName: payload.fullName,
      phoneNumber: payload.phoneNumber,
      email: payload.email,
      password: payload.password,
      role: toApiRole(payload.role),
    }),
  });

export const login = (payload: { identifier: string; password: string }) =>
  apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const refresh = (refreshToken: string) =>
  apiFetch<{ accessToken: string }>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

export const me = (accessToken: string) =>
  apiFetch<{ user: ApiUser }>("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

export const logout = (refreshToken: string) =>
  apiFetch<{ message: string }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
