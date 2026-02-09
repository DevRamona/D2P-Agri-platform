import type { ViewMode } from "../types";

interface OrderTrackingProps {
  onNavigate?: (view: ViewMode) => void;
}

const timeline = [
  {
    title: "Payment Confirmed",
    time: "Oct 12, 09:00 AM",
    detail: "Transaction verified via MoMo Business",
    status: "done",
  },
  {
    title: "Farmer Delivering to Hub",
    time: "Oct 13, 02:30 PM",
    detail: "Farmer: Jean-Paul M. (Musanze District)",
    status: "done",
  },
  {
    title: "Hub Inspection Underway",
    time: "In Progress · Processing",
    detail: "Grade A Check: Passed",
    status: "active",
  },
  {
    title: "Released for Delivery",
    time: "Pending quality certificate issuance",
    detail: "",
    status: "pending",
  },
];

const OrderTracking = ({ onNavigate }: OrderTrackingProps) => {
  return (
    <section className="w-full max-w-[520px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-8">
      <header className="flex items-center justify-between">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          onClick={() => onNavigate?.("order-review")}
          aria-label="Go back"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="text-center">
          <p className="m-0 text-base font-semibold">Order #AG-9921</p>
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[2px] text-[var(--accent)]">Active Tracking</p>
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          aria-label="Info"
        >
          <span className="text-sm font-semibold">i</span>
        </button>
      </header>

      <div className="flex items-center gap-4 rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
        <img
          src="https://images.unsplash.com/photo-1506806732259-39c2d0268443?auto=format&fit=crop&w=600&q=80"
          alt=""
          className="h-16 w-16 rounded-[14px] object-cover"
        />
        <div>
          <p className="m-0 text-sm font-semibold">500kg Irish Potatoes</p>
          <p className="mt-1 text-base font-semibold text-[var(--accent)]">1,250,000 RWF</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Kigali Distribution Center Hub</p>
        </div>
      </div>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[linear-gradient(135deg,#0e2f12,#0f3d15)] p-5 text-white">
        <p className="m-0 text-xs font-semibold uppercase tracking-[2px] text-white/70">Estimated Arrival</p>
        <p className="mt-3 text-2xl font-semibold">Oct 15, 2023</p>
        <p className="mt-1 text-sm text-white/70">By 5:00 PM</p>
        <div className="mt-4 flex justify-end">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--accent)] text-[#0b1307]">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 13h13l3 3v3H3z" />
              <path d="M16 8h4l2 5" />
              <circle cx="7.5" cy="18.5" r="1.5" />
              <circle cx="16.5" cy="18.5" r="1.5" />
            </svg>
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold">Delivery Progress</h3>
        <span className="text-xs text-[var(--muted)]">Updated 2m ago</span>
      </div>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5">
        <div className="relative flex flex-col gap-6">
          {timeline.map((step, index) => (
            <div key={step.title} className="relative flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-full ${
                    step.status === "done"
                      ? "bg-[var(--accent)] text-[#0b1307]"
                      : step.status === "active"
                      ? "bg-[var(--surface-2)] text-[var(--accent)]"
                      : "bg-[var(--surface-2)] text-[var(--muted)]"
                  }`}
                >
                  {step.status === "done" ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12l4 4 10-10" />
                    </svg>
                  ) : step.status === "active" ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="5" y="5" width="14" height="14" rx="3" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="4" y="6" width="16" height="12" rx="3" />
                    </svg>
                  )}
                </span>
                {index < timeline.length - 1 && (
                  <span className={`mt-2 h-12 w-1 rounded-full ${step.status === "done" ? "bg-[var(--accent)]" : "bg-[var(--surface-2)]"}`} />
                )}
              </div>
              <div className="flex-1">
                <p className={`m-0 text-sm font-semibold ${step.status === "active" ? "text-[var(--accent)]" : ""}`}>
                  {step.title}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">{step.time}</p>
                {step.detail && (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {step.detail}
                  </p>
                )}
                {step.status === "active" && (
                  <div className="mt-3 rounded-[16px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--muted)]">
                    Verifying moisture content and weight calibration at Kigali Central Hub.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="m-0 text-base font-semibold">Route Map</h3>
      </div>
      <div className="overflow-hidden rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)]">
        <img
          src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80"
          alt=""
          className="h-44 w-full object-cover"
        />
        <div className="p-4">
          <div className="inline-flex rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--muted)]">
            Kigali Central Hub → Nyarugenge
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button className="flex-1 rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold">
          Contact Support
        </button>
        <button className="flex-1 rounded-[16px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#0b1307]">
          View Invoice
        </button>
      </div>
    </section>
  );
};

export default OrderTracking;
