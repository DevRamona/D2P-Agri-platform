export type UserRole = "farmer" | "buyer";

export type ViewMode =
  | "welcome"
  | "auth"
  | "dashboard"
  | "inventory"
  | "quality-scan"
  | "batch-creation"
  | "batch-tracker"
  | "wallet"
  | "buyer-marketplace"
  | "buyer-batch-details"
  | "order-review"
  | "order-tracking"
  | "buyer-order-history"
  | string; // Allow dynamic paths like batch-tracker/:id

export type ThemeMode = "light" | "dark";
