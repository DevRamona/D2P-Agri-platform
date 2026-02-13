import { useState, type FormEvent, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { UserRole } from "../types";
import { ApiRequestError } from "../api/client";
import { fromApiRole, login, register } from "../api/auth";
import { setTokens } from "../utils/authStorage";

interface AuthProps {
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

const Auth = ({ onBack, onLoginSuccess, initialTab = "login" }: AuthProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const tab = initialTab;
  const [role, setRole] = useState<UserRole>("farmer");
  const [status, setStatus] = useState<StatusState>({
    loading: false,
    error: null,
    success: location.state?.successMessage || null
  });

  useEffect(() => {
    setStatus({
      loading: false,
      error: null,
      success: location.state?.successMessage || null
    });

    if (location.state?.successMessage) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state, tab]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    const formData = new FormData(form);
    const password = String(formData.get("password") || "").trim();

    // For login, 'identifier' is used.
    // For register, 'identifier' corresponds to the Phone Number field (labeled "Phone number (Optional)"), 
    // and there is a separate 'email' field.
    const identifierInput = String(formData.get("identifier") || "").trim();
    const emailInput = String(formData.get("email") || "").trim();

    setStatus({ loading: true, error: null, success: null });

    // Client-side Validation across both modes
    if (password.length < 6) {
      setStatus({ loading: false, error: "Password must be at least 6 characters.", success: null });
      return;
    }

    try {
      if (tab === "register") {
        const fullName = String(formData.get("fullName") || "").trim();
        // identifierInput is the phone number here
        const phoneNumber = identifierInput || undefined;
        const email = emailInput || undefined;

        if (!phoneNumber && !email) {
          setStatus({ loading: false, error: "Please provide either a phone number or an email.", success: null });
          return;
        }

        if (email && !email.includes("@")) {
          setStatus({ loading: false, error: "Please enter a valid email address.", success: null });
          return;
        }

        await register({ fullName, phoneNumber, email, password, role });
        navigate("/auth/login", {
          state: { successMessage: "Account created successfully. Please log in." }
        });
        return;
      }

      // Login Mode
      if (!identifierInput) {
        setStatus({ loading: false, error: "Please enter your email or phone number.", success: null });
        return;
      }

      const result = await login({ identifier: identifierInput, password });
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
            {tab === "login" ? "Login" : "Create Account"}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
            {tab === "login"
              ? "Welcome back! Log in to access your dashboard."
              : "Join IsokoLink to start trading securely."}
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

        <form className="grid gap-4" onSubmit={handleSubmit} key={tab}>
          {tab === "register" && (
            <>
              <label className="flex flex-col gap-2 text-sm font-semibold">
                <span className="text-[13px] text-[var(--muted)]">I am a...</span>
                <div className="relative">
                  <select
                    name="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full appearance-none rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3 text-[15px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  >
                    <option value="farmer">Farmer</option>
                    <option value="buyer">Buyer</option>
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </label>

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

              <label className="flex flex-col gap-2 text-sm font-semibold">
                <span className="text-[13px] text-[var(--muted)]">Email (Optional)</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="jane@example.com"
                  className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3 text-[15px] text-[var(--text)] placeholder:text-[rgba(163,177,155,0.7)]"
                />
              </label>
            </>
          )}

          <label className="flex flex-col gap-2 text-sm font-semibold">
            <span className="text-[13px] text-[var(--muted)]">{tab === "login" ? "Email or Phone number" : "Phone number (Optional)"}</span>
            <input
              type="text"
              name="identifier"
              autoComplete="username"
              placeholder={tab === "login" ? "jane@example.com or +250..." : "+250 7XX XXX XXX"}
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
