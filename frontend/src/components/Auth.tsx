import { useState, type FormEvent, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { UserRole } from "../types";
import { ApiRequestError } from "../api/client";
import { fromApiRole, login, register } from "../api/auth";
import { setTokens } from "../utils/authStorage";

interface AuthProps {
  role: UserRole;
  onBack: () => void;
  onLoginSuccess: (role: UserRole, user?: unknown) => void;
  initialTab?: AuthTab;
}

type AuthTab = "login" | "register";

type StatusState = {
  loading: boolean;
  error: string | null;
  success: string | null;
};

const Auth = ({ role, onBack, onLoginSuccess, initialTab = "login" }: AuthProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const tab = initialTab;
  const [status, setStatus] = useState<StatusState>({
    loading: false,
    error: null,
    success: location.state?.successMessage || null
  });

  useEffect(() => {
    if (location.state?.successMessage) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    const formData = new FormData(form);
    const fullName = String(formData.get("fullName") || "").trim();
    const phoneNumber = String(formData.get("phoneNumber") || "").trim();
    const password = String(formData.get("password") || "").trim();

    setStatus({ loading: true, error: null, success: null });

    try {
      if (tab === "register") {
        await register({ fullName, phoneNumber, password, role });
        navigate("/auth/login", {
          state: { successMessage: "Account created successfully. Please log in." }
        });
        return;
      }

      const result = await login({ phoneNumber, password });
      setTokens(result.accessToken, result.refreshToken);
      setStatus({ loading: false, error: null, success: null });
      onLoginSuccess(fromApiRole(result.user.role), result.user);
    } catch (error) {
      const message = error instanceof ApiRequestError
        ? error.message
        : error instanceof Error ? error.message : "Something went wrong. Try again.";
      setStatus({ loading: false, error: message, success: null });
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
      </div>

      <div className="flex flex-col gap-5 rounded-[28px] border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-7">
        <div>
          <h2 id="auth-title" className="font-display text-[clamp(22px,2.5vw,30px)] font-bold m-0 capitalize">
            {role} {tab === "login" ? "Login" : "Registration"}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
            {tab === "login"
              ? `Welcome back, ${role}! Log in to access your dashboard.`
              : `Create your ${role} account to start trading on IsokoLink.`}
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
            className={`rounded-full px-4 py-2 text-sm font-bold ${tab === "login" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            onClick={() => navigate("/auth/login")}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "register"}
            className={`rounded-full px-4 py-2 text-sm font-bold ${tab === "register" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            onClick={() => navigate("/auth/register")}
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
            <span className="text-[13px] text-[var(--muted)]">Phone number</span>
            <input
              type="tel"
              name="phoneNumber"
              autoComplete="tel"
              placeholder="+250 7XX XXX XXX"
              required
              className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3 text-[15px] text-[var(--text)] placeholder:text-[rgba(163,177,155,0.7)]"
            />
          </label>
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
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[var(--accent)] px-5 py-3.5 text-base font-bold text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.3)] disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
            disabled={status.loading}
          >
            {status.loading ? "Please wait..." : tab === "login" ? "Login" : "Create account"}
          </button>
        </form>

        {status.error && <p className="m-0 text-sm text-red-400">{status.error}</p>}
        {status.success && <p className="m-0 text-sm text-[var(--accent)]">{status.success}</p>}

        <p className="m-0 text-center text-[13px] text-[var(--muted)]">
          Need help? <span className="font-semibold text-[var(--accent)]">Contact support</span>
        </p>
      </div>
    </section>
  );
};

export default Auth;
