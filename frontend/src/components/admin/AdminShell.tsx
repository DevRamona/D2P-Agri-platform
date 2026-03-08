import type { ReactNode } from "react";

type NavKey = "overview" | "escrow" | "hubs" | "config";

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
}

const join = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

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
          : "bg-[var(--surface-2)] text-[var(--muted)]";
  return (
    <span className={join("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[1.2px]", toneClasses)}>
      {children}
    </span>
  );
};

export const AdminMobileScreen = ({ children }: AdminMobileScreenProps) => (
  <section className="w-full max-w-[520px] overflow-hidden rounded-[28px] border border-[var(--stroke)] bg-[linear-gradient(180deg,#041f09,#06260b_40%,#041b08)] shadow-[0_28px_70px_rgba(0,0,0,0.35)] animate-[rise_0.5s_ease_both]">
    <div className="min-h-[820px] px-4 py-4 sm:px-5 sm:py-5">{children}</div>
  </section>
);

export const SectionCard = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={join("rounded-[18px] border border-[rgba(163,177,155,0.18)] bg-[linear-gradient(135deg,rgba(255,255,255,0.02),rgba(73,197,26,0.04))] p-4", className)}>
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
}) => (
  <SectionCard className="min-h-[108px]">
    <div className="flex items-center justify-between gap-2">
      <p className="m-0 text-xs text-[var(--muted)]">{label}</p>
      {typeof changePct === "number" && (
        <span className={join("text-xs font-semibold", changePct >= 0 ? "text-[#28ff56]" : "text-[#ff6b6b]")}>
          {changePct > 0 ? "+" : ""}
          {Math.round(changePct * 10) / 10}%
        </span>
      )}
    </div>
    <div className="mt-3 flex items-end gap-1">
      <p className="m-0 text-2xl font-bold text-[var(--text)]">{value}</p>
      {unit && <p className="m-0 pb-1 text-xs text-[var(--muted)]">{unit}</p>}
    </div>
  </SectionCard>
);

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
  <div className="flex items-center gap-3 rounded-[16px] border border-[rgba(163,177,155,0.16)] bg-[rgba(20,34,52,0.75)] px-4 py-3">
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

export const AdminBottomNav = ({ active, onNavigate }: AdminBottomNavProps) => {
  const items: NavItem[] = [
    { key: "overview", label: "Overview", target: "overview" },
    { key: "escrow", label: "Escrow", target: "escrow" },
    { key: "hubs", label: "Hubs", target: "hubs-disputes" },
    { key: "config", label: "Config" },
  ];

  return (
    <nav className="mt-4 grid grid-cols-4 gap-2 border-t border-[rgba(163,177,155,0.14)] pt-3">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => item.target && onNavigate?.(item.target)}
            className={join("flex flex-col items-center gap-1 rounded-[12px] px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.8px]", isActive ? "text-[var(--accent)]" : "text-[var(--muted)]")}
          >
            <span className={join("grid h-8 w-8 place-items-center rounded-[10px] border", isActive ? "border-[rgba(73,197,26,0.35)] bg-[rgba(73,197,26,0.08)]" : "border-[rgba(163,177,155,0.14)] bg-[rgba(255,255,255,0.02)]")}>
              <span className="block h-2.5 w-2.5 rounded-[4px] bg-current opacity-90" />
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
};

