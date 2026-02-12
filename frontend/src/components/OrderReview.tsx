import type { ViewMode } from "../types";

interface OrderReviewProps {
  onNavigate?: (view: ViewMode) => void;
}

const OrderReview = ({ onNavigate }: OrderReviewProps) => {
  return (
    <section className="w-full max-w-[520px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-8">
      <header className="flex items-center justify-between">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          onClick={() => onNavigate?.("buyer-batch-details")}
          aria-label="Go back"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <p className="m-0 text-base font-semibold">Order Review &amp; Deposit</p>
        <span className="h-10 w-10" aria-hidden="true" />
      </header>

      <div className="flex items-center gap-4 rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
        <img
          src="https://images.unsplash.com/photo-1506806732259-39c2d0268443?auto=format&fit=crop&w=600&q=80"
          alt=""
          className="h-16 w-16 rounded-[14px] object-cover"
        />
        <div>
          <p className="m-0 text-xs font-semibold text-[var(--accent)]">Confirmed Order</p>
          <p className="mt-1 text-sm font-semibold">Premium Irish Potatoes</p>
          <p className="mt-1 text-xs text-[var(--muted)]">500kg · Musanze District</p>
          <p className="mt-2 text-sm font-semibold">500,000 RWF Total</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold">Payment Split</h3>
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-semibold text-[var(--accent)]">
          Escrow Protected
        </span>
      </div>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="m-0 text-xs text-[var(--muted)]">Deposit Amount (60%)</p>
            <p className="mt-2 text-2xl font-bold text-[var(--accent)]">300,000 RWF</p>
          </div>
          <div className="text-right">
            <p className="m-0 text-xs text-[var(--muted)]">Balance Due on Delivery</p>
            <p className="mt-2 text-base font-semibold">200,000 RWF</p>
          </div>
        </div>
        <div className="mt-4 h-3 w-full rounded-full bg-[var(--surface-2)]">
          <div className="h-3 w-[60%] rounded-full bg-[var(--accent)]" />
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-[var(--stroke)] bg-[var(--surface-2)] p-4 text-xs text-[var(--muted)]">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12l4 4 10-10" />
            </svg>
          </span>
          <p className="m-0">
            Your 305,000 RWF payment will be held in escrow. Funds are only released to the farmer after you confirm
            delivery and quality in the app.
          </p>
        </div>
      </div>

      <div>
        <p className="m-0 text-xs font-semibold tracking-[2px] text-[var(--muted)]">Detailed Breakdown</p>
      </div>
      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm">
        <div className="flex items-center justify-between text-[var(--muted)]">
          <span>Order Deposit (60%)</span>
          <span className="text-[var(--text)]">300,000 RWF</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[var(--muted)]">
          <span>Service Fee</span>
          <span className="text-[var(--text)]">5,000 RWF</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[var(--muted)]">
          <span>Logistics Insurance</span>
          <span className="text-[var(--accent)]">Free</span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[var(--stroke)] pt-4 font-semibold">
          <span>Amount Due Today</span>
          <span className="text-[var(--accent)]">305,000 RWF</span>
        </div>
      </div>

      <div>
        <p className="m-0 text-xs font-semibold tracking-[2px] text-[var(--muted)]">Payment Method</p>
      </div>
      <div className="flex flex-col gap-3">
        <button className="flex items-center justify-between rounded-[18px] border border-[var(--accent)] bg-[var(--surface)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-yellow-400 text-black font-semibold text-xs">
              MoMo
            </span>
            <div>
              <p className="m-0 text-sm font-semibold">MTN Mobile Money</p>
              <p className="m-0 text-xs text-[var(--muted)]">Instant payment processing</p>
            </div>
          </div>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--accent)] text-[#0b1307]">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12l4 4 10-10" />
            </svg>
          </span>
        </button>
        <button className="flex items-center justify-between rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-red-500 text-white font-semibold text-xs">
              Airtel
            </span>
            <div>
              <p className="m-0 text-sm font-semibold">Airtel Money</p>
              <p className="m-0 text-xs text-[var(--muted)]">Instant payment processing</p>
            </div>
          </div>
          <span className="grid h-5 w-5 place-items-center rounded-full border border-[var(--stroke)]" />
        </button>
        <button className="flex items-center justify-between rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-slate-700 text-white font-semibold text-xs">
              Bank
            </span>
            <div>
              <p className="m-0 text-sm font-semibold">Bank Transfer</p>
              <p className="m-0 text-xs text-[var(--muted)]">Processing time: 1-2 days</p>
            </div>
          </div>
          <span className="grid h-5 w-5 place-items-center rounded-full border border-[var(--stroke)]" />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-4z" />
          </svg>
          SSL Secure
        </div>
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7h16v10H4z" />
            <path d="M9 7v10" />
          </svg>
          RAB Verified
        </div>
      </div>

      <p className="m-0 text-center text-[10px] text-[var(--muted)]">
        By clicking Confirm, you agree to the Escrow Protection terms and conditions for agricultural commerce in Rwanda.
      </p>

      <button
        className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-4 text-base font-semibold text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.35)]"
        type="button"
        onClick={() => onNavigate?.("order-tracking")}
      >
        Confirm &amp; Pay 305,000 RWF
      </button>
    </section>
  );
};

export default OrderReview;
