import { useState, type FormEvent } from "react";
import type { UserRole } from "../types";

interface AuthProps {
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  onBack: () => void;
  onLoginSuccess: () => void;
}

type AuthTab = "login" | "register";

const Auth = ({ role, onRoleChange, onBack, onLoginSuccess }: AuthProps) => {
  const [tab, setTab] = useState<AuthTab>("login");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (tab === "login" && role === "farmer") {
      onLoginSuccess();
    }
  };

  return (
    <section
      className="w-full max-w-[520px] lg:max-w-[600px] flex flex-col gap-5 animate-[rise_0.6s_ease_both]"
      aria-labelledby="auth-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" className="text-sm font-semibold text-[var(--muted)]" onClick={onBack}>
          ← Back
        </button>
        <div
          className="flex w-full items-center gap-2 rounded-full border border-[var(--stroke)] bg-[var(--surface-2)] p-1 sm:w-auto"
          role="radiogroup"
          aria-label="Account type"
        >
          <button
            type="button"
            className={`flex-1 rounded-full px-4 py-1.5 text-center text-sm font-semibold sm:flex-none ${
              role === "farmer" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
            role="radio"
            aria-checked={role === "farmer"}
            onClick={() => onRoleChange("farmer")}
          >
            Farmer
          </button>
          <button
            type="button"
            className={`flex-1 rounded-full px-4 py-1.5 text-center text-sm font-semibold sm:flex-none ${
              role === "buyer" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
            role="radio"
            aria-checked={role === "buyer"}
            onClick={() => onRoleChange("buyer")}
          >
            Buyer
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-[28px] border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-7">
        <div>
          <h2 id="auth-title" className="font-display text-[clamp(22px,2.5vw,30px)] font-bold m-0">
            {tab === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
            {tab === "login"
              ? "Log in to manage listings, track orders, and access escrow tools."
              : "Register in minutes to buy or sell maize and beans with confidence."}
          </p>
        </div>

        <div
          className="grid grid-cols-2 gap-2 rounded-full border border-[var(--stroke)] bg-[var(--surface-2)] p-1"
          role="tablist"
          aria-label="Authentication tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "login"}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              tab === "login" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
            onClick={() => setTab("login")}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "register"}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              tab === "register" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
            onClick={() => setTab("register")}
          >
            Register
          </button>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          {tab === "register" && (
            <label className="flex flex-col gap-2 text-sm font-semibold">
              <span className="text-[13px] text-[var(--muted)]">Full name</span>
              <input
                type="text"
                name="fullName"
                autoComplete="name"
                placeholder="Jane Doe"
                required
                className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3 text-[15px] text-[var(--text)] placeholder:text-[rgba(163,177,155,0.7)]"
              />
            </label>
          )}
          <label className="flex flex-col gap-2 text-sm font-semibold">
            <span className="text-[13px] text-[var(--muted)]">Email</span>
            <input
              type="email"
              name="email"
              autoComplete={tab === "login" ? "username" : "email"}
              placeholder="you@example.com"
              required
              className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3 text-[15px] text-[var(--text)] placeholder:text-[rgba(163,177,155,0.7)]"
            />
          </label>
          {tab === "register" && (
            <label className="flex flex-col gap-2 text-sm font-semibold">
              <span className="text-[13px] text-[var(--muted)]">Phone number</span>
              <input
                type="tel"
                name="phone"
                autoComplete="tel"
                placeholder="+250 7XX XXX XXX"
                required
                className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3 text-[15px] text-[var(--text)] placeholder:text-[rgba(163,177,155,0.7)]"
              />
            </label>
          )}
          <label className="flex flex-col gap-2 text-sm font-semibold">
            <span className="text-[13px] text-[var(--muted)]">Password</span>
            <input
              type="password"
              name="password"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              required
              className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3 text-[15px] text-[var(--text)] placeholder:text-[rgba(163,177,155,0.7)]"
            />
          </label>

          <button
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[var(--accent)] px-5 py-3.5 text-base font-bold text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.3)]"
            type="submit"
          >
            {tab === "login" ? "Login" : "Create account"}
          </button>
        </form>

        <p className="m-0 text-center text-[13px] text-[var(--muted)]">
          Need help? <span className="font-semibold text-[var(--accent)]">Contact support</span>
        </p>
      </div>
    </section>
  );
};

export default Auth;
