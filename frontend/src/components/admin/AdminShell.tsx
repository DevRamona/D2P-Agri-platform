import type { ReactNode } from "react";

type NavKey = "overview" | "escrow" | "hubs" | "logout";

type NavItem = {
  key: NavKey;
  label: string;
  target?: string;
};

interface AdminMobileScreenProps {
  children: ReactNode;
}

interface AdminBottomNavProps {
  active: NavKey;
  onNavigate?: (target: string) => void;
  onLogout?: () => void;
}

const join = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const formatSignedChange = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "0%";
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
};

const NavGlyph = ({ itemKey }: { itemKey: NavKey }) => {
  if (itemKey === "overview") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="5" width="6" height="6" rx="1.5" />
        <rect x="14" y="5" width="6" height="10" rx="1.5" />
        <rect x="4" y="15" width="6" height="5" rx="1.5" />
        <rect x="14" y="19" width="6" height="1" rx="0.5" />
      </svg>
    );
  }
  if (itemKey === "escrow") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3l7 4v5c0 4.7-2.7 7.9-7 9-4.3-1.1-7-4.3-7-9V7l7-4z" />
        <path d="M9.5 12.5l1.7 1.7 3.8-4" />
      </svg>
    );
  }
  if (itemKey === "hubs") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="6" cy="8" r="2.2" />
        <circle cx="18" cy="8" r="2.2" />
        <circle cx="12" cy="17" r="2.2" />
        <path d="M7.7 9.5l2.8 5.1M16.3 9.5l-2.8 5.1M8.4 8h7.2" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 7V5a2 2 0 012-2h6a2 2 0 012 2v14a2 2 0 01-2 2h-6a2 2 0 01-2-2v-2" />
      <path d="M14 12H4" />
      <path d="M7.5 8.5L4 12l3.5 3.5" />
    </svg>
  );
};

export const formatRwf = (value: number) => `${Math.round(Number(value) || 0).toLocaleString()} RWF`;
export const formatKg = (value: number) => `${Math.round(Number(value) || 0).toLocaleString()} kg`;

export const formatAgo = (iso: string) => {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "just now";
  const diffMs = Date.now() - dt.getTime();
  const diffMin = Math.max(0, Math.round(diffMs / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
};

export const StatusChip = ({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red";
}) => {
  const toneClasses =
    tone === "green"
      ? "bg-[rgba(27,214,64,0.18)] text-[#52ff73]"
      : tone === "amber"
        ? "bg-[rgba(245,166,35,0.15)] text-[#f6c24d]"
        : tone === "red"
          ? "bg-[rgba(255,84,84,0.16)] text-[#ff7b7b]"
          : "bg-[rgba(255,255,255,0.06)] text-[var(--muted)]";
  return (
    <span className={join("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[1.2px]", toneClasses)}>
      {children}
    </span>
  );
};

export const HeaderBadge = ({
  label,
  tone = "neutral",
  children,
}: {
  label: string;
  tone?: "neutral" | "green" | "amber";
  children: ReactNode;
}) => {
  const toneClasses =
    tone === "green"
      ? "border-[rgba(73,197,26,0.28)] bg-[rgba(73,197,26,0.1)] text-[var(--accent)]"
      : tone === "amber"
        ? "border-[rgba(245,166,35,0.22)] bg-[rgba(245,166,35,0.08)] text-[#f6c24d]"
        : "border-[rgba(163,177,155,0.2)] bg-[rgba(255,255,255,0.03)] text-[var(--muted)]";
  return (
    <div className={join("inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[1.1px]", toneClasses)}>
      <span className="grid h-6 w-6 place-items-center rounded-full bg-[rgba(0,0,0,0.16)]">{children}</span>
      <span>{label}</span>
    </div>
  );
};

export const EmptyState = ({
  title,
  message,
}: {
  title: string;
  message: string;
}) => (
  <SectionCard className="border-dashed border-[rgba(163,177,155,0.2)] bg-[rgba(7,18,9,0.7)]">
    <p className="m-0 text-base font-semibold text-[var(--text)]">{title}</p>
    <p className="m-0 mt-2 text-sm leading-relaxed text-[var(--muted)]">{message}</p>
  </SectionCard>
);

export const AdminMobileScreen = ({ children }: AdminMobileScreenProps) => (
  <section className="w-full max-w-[1100px] overflow-hidden rounded-[28px] border border-[rgba(163,177,155,0.18)] bg-[linear-gradient(180deg,#041c08,#06240d_42%,#041708)] shadow-[0_28px_70px_rgba(0,0,0,0.35)] animate-[rise_0.5s_ease_both]">
    <div className="min-h-[720px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</div>
  </section>
);

export const SectionCard = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={join("rounded-[20px] border border-[rgba(163,177,155,0.16)] bg-[linear-gradient(135deg,rgba(255,255,255,0.02),rgba(73,197,26,0.035))] p-4 sm:p-5", className)}>
    {children}
  </div>
);

export const MetricCard = ({
  label,
  value,
  unit,
  changePct,
}: {
  label: string;
  value: string;
  unit?: string;
  changePct?: number;
}) => {
  const changeLabel = formatSignedChange(changePct);
  const toneClass =
    typeof changePct !== "number" || Number.isNaN(changePct)
      ? "text-[var(--muted)]"
      : changePct > 0
        ? "text-[#28ff56]"
        : changePct < 0
          ? "text-[#ff6b6b]"
          : "text-[var(--muted)]";

  return (
    <SectionCard className="min-h-[118px]">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-xs uppercase tracking-[1.1px] text-[var(--muted)]">{label}</p>
        {changeLabel && <span className={join("text-xs font-semibold", toneClass)}>{changeLabel}</span>}
      </div>
      <div className="mt-4 flex items-end gap-1">
        <p className="m-0 text-2xl font-bold text-[var(--text)] sm:text-[32px]">{value}</p>
        {unit && <p className="m-0 pb-1 text-xs text-[var(--muted)]">{unit}</p>}
      </div>
    </SectionCard>
  );
};

export const SearchInput = ({
  value,
  onChange,
  placeholder,
  trailingLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  trailingLabel?: string;
}) => (
  <div className="flex items-center gap-3 rounded-[16px] border border-[rgba(163,177,155,0.16)] bg-[rgba(8,22,12,0.82)] px-4 py-3">
    <svg className="h-4 w-4 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none"
    />
    {trailingLabel && <span className="text-xs font-semibold tracking-[1.2px] text-[var(--accent)]">{trailingLabel}</span>}
  </div>
);

export const AdminBottomNav = ({ active, onNavigate, onLogout }: AdminBottomNavProps) => {
  const items: NavItem[] = [
    { key: "overview", label: "Overview", target: "overview" },
    { key: "escrow", label: "Escrow", target: "escrow" },
    { key: "hubs", label: "Hubs", target: "hubs-disputes" },
    { key: "logout", label: "Logout" },
  ];

  return (
    <nav className="mt-8 grid grid-cols-2 gap-2 border-t border-[rgba(163,177,155,0.14)] pt-4 sm:grid-cols-4">
      {items.map((item) => {
        const isActive = item.key === active;
        const isDanger = item.key === "logout";
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              if (item.key === "logout") {
                onLogout?.();
                return;
              }
              if (item.target) {
                onNavigate?.(item.target);
              }
            }}
            className={join(
              "flex items-center justify-center gap-3 rounded-[14px] border px-3 py-3 text-xs font-semibold uppercase tracking-[0.9px] transition-colors",
              isActive
                ? "border-[rgba(73,197,26,0.28)] bg-[rgba(73,197,26,0.08)] text-[var(--accent)]"
                : isDanger
                  ? "border-[rgba(255,84,84,0.18)] bg-[rgba(255,84,84,0.05)] text-[#ffb0b0]"
                  : "border-[rgba(163,177,155,0.12)] bg-[rgba(255,255,255,0.02)] text-[var(--muted)]",
            )}
          >
            <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[rgba(0,0,0,0.14)]">
              <NavGlyph itemKey={item.key} />
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

