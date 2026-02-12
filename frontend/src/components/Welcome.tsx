import type { UserRole } from "../types";

interface WelcomeProps {
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  onGetStarted: (tab: "login" | "register") => void;
}

const Welcome = ({ role, onRoleChange, onGetStarted }: WelcomeProps) => {
  const baseRoleCard =
    "flex flex-col items-center gap-3 rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-5 text-[var(--text)] font-semibold transition duration-200";
  const activeRoleCard = "border-[var(--accent)] shadow-[0_12px_28px_rgba(73,197,26,0.25)] -translate-y-0.5";

  return (
    <section
      className="w-full max-w-[520px] lg:max-w-[600px] flex flex-col gap-5 animate-[rise_0.6s_ease_both]"
      aria-labelledby="welcome-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid h-16 w-16 place-items-center rounded-[18px] border border-[var(--stroke)] bg-[var(--surface-2)] shadow-[inset_0_0_0_2px_rgba(73,197,26,0.18)]">
          <svg viewBox="0 0 64 64" role="img" aria-label="D2P tractor" className="h-10 w-10 fill-[var(--accent)]">
            <rect x="6" y="30" width="34" height="14" rx="6" />
            <rect x="36" y="18" width="14" height="20" rx="5" />
            <rect x="44" y="14" width="12" height="6" rx="3" />
            <circle cx="20" cy="48" r="8" />
            <circle cx="48" cy="48" r="6" />
          </svg>
        </div>
        <div>
          <h1
            id="welcome-title"
            className="font-display text-[clamp(22px,3vw,32px)] font-bold leading-tight m-0"
          >
            IsokoLink
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
            Smart farming and secure trading for Rwanda's maize and bean farmers.
          </p>
        </div>
      </div>

      <figure className="relative h-[clamp(180px,38vw,240px)] overflow-hidden rounded-[28px] shadow-[var(--shadow)]">
        <img
          src="https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1400&q=80"
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(16,25,12,0.2),rgba(16,25,12,0.75))]"
          aria-hidden="true"
        />
      </figure>

      <p className="m-0 text-[12px] uppercase tracking-[4px] text-[var(--muted)]">I am a...</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Choose your role">
        <button
          type="button"
          className={`${baseRoleCard} ${role === "farmer" ? activeRoleCard : ""}`}
          role="radio"
          aria-checked={role === "farmer"}
          onClick={() => onRoleChange("farmer")}
        >
          <span className="grid h-12 w-12 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]">
            <svg viewBox="0 0 48 48" className={`h-7 w-7 ${role === "farmer" ? "fill-[var(--accent)]" : "fill-[var(--muted)]"}`}>
              <path d="M24 10c5.523 0 10 4.477 10 10 0 7.5-6 12-10 18-4-6-10-10.5-10-18 0-5.523 4.477-10 10-10z" />
              <path d="M22 20h4v10h-4z" />
              <path d="M18 24h12v4H18z" />
            </svg>
          </span>
          <span>Farmer</span>
        </button>
        <button
          type="button"
          className={`${baseRoleCard} ${role === "buyer" ? activeRoleCard : ""}`}
          role="radio"
          aria-checked={role === "buyer"}
          onClick={() => onRoleChange("buyer")}
        >
          <span className="grid h-12 w-12 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]">
            <svg viewBox="0 0 48 48" className={`h-7 w-7 ${role === "buyer" ? "fill-[var(--accent)]" : "fill-[var(--muted)]"}`}>
              <path d="M14 16h20l-2 20H16L14 16z" />
              <path d="M18 16c0-4 3-6 6-6s6 2 6 6" />
            </svg>
          </span>
          <span>Buyer</span>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[var(--accent)] px-5 py-3.5 text-base font-bold text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.3)] transition-transform active:scale-[0.98]"
          type="button"
          onClick={() => onGetStarted("register")}
        >
          Create Account
          <span aria-hidden="true">→</span>
        </button>

        <p className="m-0 text-center text-sm font-semibold text-[var(--muted)]">
          Already have an account?{" "}
          <button
            type="button"
            className="text-[var(--accent)] hover:underline"
            onClick={() => onGetStarted("login")}
          >
            Log in
          </button>
        </p>
      </div>

      <p className="m-0 text-center text-xs leading-relaxed text-[var(--muted)]">
        By continuing, you agree to our <span className="font-semibold text-[var(--accent)]">Terms of Service</span> and
        <span className="font-semibold text-[var(--accent)]"> Privacy Policy</span>.
      </p>
    </section>
  );
};

export default Welcome;
