import { Link, useNavigate } from "react-router-dom";

type Clause = {
  id: string;
  title: string;
  clause: string;
  whyItMatters: string;
};

const eulaClauses: Clause[] = [
  {
    id: "acceptance",
    title: "Acceptance and scope",
    clause:
      "By using IsokoLink, you agree to use this prototype for normal and lawful agricultural trading, crop scanning, and escrow-supported ordering. This page covers the current build dated 31 March 2026.",
    whyItMatters:
      "It tells users what this version of the app actually covers and stops us presenting the prototype as something bigger than it is.",
  },
  {
    id: "accounts",
    title: "Accounts, identity, and security",
    clause:
      "Users should register with real account details, keep their password private, and avoid sharing login access. The system stores account roles so farmers, buyers, and admins see different tools.",
    whyItMatters:
      "This helps reduce impersonation, account misuse, and order disputes. It also matters for users who may be new to digital platforms and need basic protection built in.",
  },
  {
    id: "ai-limits",
    title: "AI assistance is support, not final diagnosis",
    clause:
      "Disease results and generated recommendations are support tools only. They can be wrong, incomplete, or uncertain, and they should not replace an agronomist, extension officer, or field visit.",
    whyItMatters:
      "This is one of the most important clauses on the page. Without it, users may trust the scan too much and make treatment decisions that harm crops, income, or soil health.",
  },
  {
    id: "payments",
    title: "Payments, escrow, and third-party providers",
    clause:
      "Orders, deposits, and release steps are tracked in IsokoLink, but the actual payment flow may go through third-party services such as Stripe or Flutterwave. Their own terms still apply to the payment itself.",
    whyItMatters:
      "It makes the responsibility boundary clearer. If a payment fails or a dispute happens, users need to know that more than one system may be involved.",
  },
  {
    id: "acceptable-use",
    title: "Acceptable use and prohibited conduct",
    clause:
      "Users must not use the platform for fraud, abuse, unlawful uploads, service disruption, restricted data scraping, or misleading crop-scan submissions.",
    whyItMatters:
      "Even a prototype needs clear limits. This protects the system, other users, and the credibility of the advice shown in the app.",
  },
  {
    id: "availability",
    title: "Availability, updates, and suspension",
    clause:
      "The platform may change, pause features, or suspend access for security, maintenance, moderation, or compliance reasons. The service is provided on a best-effort basis, not as a guarantee of constant uptime.",
    whyItMatters:
      "The app depends on databases, APIs, and ML services that can fail. Users should know that clearly instead of assuming the system is always available or always correct.",
  },
];

const privacyClauses: Clause[] = [
  {
    id: "data-collected",
    title: "What data the system collects",
    clause:
      "IsokoLink collects account details such as full name, phone number, and optional email, as well as order and payment data needed to run the marketplace. The crop scanner also handles uploaded images, crop hints, language choice, severity, goals, and Rwanda location details entered by the user.",
    whyItMatters:
      "Users should know what information enters the system. Developers also need a clear list of data types they are responsible for protecting and justifying.",
  },
  {
    id: "data-use",
    title: "How data is used",
    clause:
      "Account data is used for login and role-based access. Transaction data is used for ordering, escrow, delivery tracking, and audit records. Crop-scan data is used for ML analysis and, when enabled, for generating recommendations based on the crop and location context provided.",
    whyItMatters:
      "This shows the purpose of each data flow. Users should not be left guessing why the app asked for information in the first place.",
  },
  {
    id: "third-parties",
    title: "Third-party processing and cross-system transfer",
    clause:
      "The platform may send data to the ML service for disease analysis, to a configured LLM provider for recommendation generation, and to payment processors for checkout and verification. Users should avoid adding unrelated personal details in crop notes or free-text fields.",
    whyItMatters:
      "This is the point where data leaves the core app. That matters because outside services create extra privacy risk and a different trust boundary.",
  },
  {
    id: "retention",
    title: "Storage and retention",
    clause:
      "This build uses privacy-first defaults: crop images are processed for analysis but are not stored by default, refresh tokens expire automatically, and anonymized feedback storage is off unless it is deliberately enabled in deployment settings. Orders and account records may stay longer for security, audit, and dispute handling.",
    whyItMatters:
      "Keeping less data reduces unnecessary exposure. It also means future deployments must be honest if they decide to keep images or feedback for longer.",
  },
  {
    id: "rights",
    title: "User choices, rights, and practical control",
    clause:
      "Users can choose not to use the crop scanner, can log out, can update some profile details, and can request manual support for correction or deletion where the deployment setup allows it. Because this is a prototype, these requests may need to be handled by an administrator rather than by a self-service page.",
    whyItMatters:
      "A privacy policy is not very useful if users have no control at all. This clause also keeps the project honest about what the prototype can and cannot automate.",
  },
  {
    id: "security",
    title: "Security, limits, and no silent reuse for research",
    clause:
      "The project uses password hashing, token-based sessions, role checks, and rate limits, but no system can promise perfect security. Uploaded crop images and user feedback are not treated as open research data by default, and any reuse for training or publication should need a separate notice and consent process.",
    whyItMatters:
      "This avoids giving users false confidence and makes the consent boundary clearer if the project grows into later research or model-development work.",
  },
];

const audienceNotes = [
  {
    label: "For users",
    text: "It shows what the app can help with, and where users still need to be careful.",
  },
  {
    label: "For developers",
    text: "It sets promises the code and deployment should actually match.",
  },
  {
    label: "For researchers",
    text: "It makes clear that user crop data is not automatically research data.",
  },
  {
    label: "For system operation",
    text: "It links the written policy to storage, third-party APIs, moderation, and failure handling.",
  },
];

const projectNotes = [
  {
    title: "Academic prototype",
    text: "This page is written for a student project submission and reflects the current prototype build rather than a production legal review.",
  },
  {
    title: "Plain language",
    text: "The wording is kept direct and readable so users can understand what data is used, what the AI does, and where the limits are.",
  },
  {
    title: "Implementation-based",
    text: "The clauses are based on the features currently in the app: account login, trading workflows, escrow tracking, crop scanning, and optional third-party services.",
  },
];

const PolicySection = ({
  id,
  eyebrow,
  title,
  summary,
  clauses,
}: {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  clauses: Clause[];
}) => (
  <section
    id={id}
    className="rounded-[28px] border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-7"
  >
    <div className="flex flex-col gap-3">
      <span className="inline-flex w-fit rounded-full border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {eyebrow}
      </span>
      <div>
        <h2 className="m-0 font-display text-[clamp(24px,3vw,34px)] font-bold">{title}</h2>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[var(--muted)]">{summary}</p>
      </div>
    </div>

    <div className="mt-6 grid gap-4">
      {clauses.map((clause, index) => (
        <article
          key={clause.id}
          id={clause.id}
          className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface-2)] p-5"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
              Clause {index + 1}
            </span>
            <h3 className="m-0 text-lg font-bold text-[var(--text)]">{clause.title}</h3>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text)]">
            <span className="font-semibold text-[var(--accent)]">What it says:</span> {clause.clause}
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
            <span className="font-semibold text-[var(--text)]">Why it matters:</span> {clause.whyItMatters}
          </p>
        </article>
      ))}
    </div>
  </section>
);

const LegalHub = () => {
  const navigate = useNavigate();

  return (
    <section className="app-screen app-screen-comfort flex flex-col gap-6" aria-labelledby="legal-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="text-sm font-semibold text-[var(--muted)]" onClick={() => navigate(-1)}>
          Back
        </button>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Updated 31 March 2026
        </span>
      </div>

      <section className="overflow-hidden rounded-[32px] border border-[var(--stroke)] bg-[linear-gradient(145deg,var(--surface),var(--surface-2))] p-6 shadow-[var(--shadow)] sm:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
              EULA
            </span>
            <span className="inline-flex rounded-full border border-[var(--stroke)] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Privacy Policy
            </span>
            <span className="inline-flex rounded-full border border-[var(--stroke)] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              Academic Prototype
            </span>
          </div>

          <div>
            <h1 id="legal-title" className="m-0 font-display text-[clamp(28px,4vw,42px)] font-bold leading-tight">
              Legal and privacy information for this IsokoLink project
            </h1>
            <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-[var(--muted)]">
              This page explains the basic terms for using the app and how the current prototype handles user data,
              order data, and crop-scan information.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href="#eula"
              className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
            >
              <p className="m-0 text-sm font-bold text-[var(--text)]">Read the End-User Licence Agreement</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Covers account use, payments, acceptable behaviour, and the limits of AI advice.
              </p>
            </a>
            <a
              href="#privacy"
              className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
            >
              <p className="m-0 text-sm font-bold text-[var(--text)]">Read the Privacy Policy</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Explains what data the system uses, where it goes, and what is not stored by default.
              </p>
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-[28px] border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:grid-cols-3 sm:p-7">
        {projectNotes.map((note) => (
          <article key={note.title} className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface-2)] p-5">
            <p className="m-0 text-sm font-bold text-[var(--accent)]">{note.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{note.text}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 rounded-[28px] border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:grid-cols-2 sm:p-7">
        {audienceNotes.map((note) => (
          <article key={note.label} className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface-2)] p-5">
            <p className="m-0 text-sm font-bold text-[var(--accent)]">{note.label}</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{note.text}</p>
          </article>
        ))}
      </section>

      <PolicySection
        id="eula"
        eyebrow="End-User Licence Agreement"
        title="Terms for using the marketplace and AI features"
        summary="These clauses explain how this prototype should be used and where responsibility still stays with the user, the operator, and outside providers."
        clauses={eulaClauses}
      />

      <PolicySection
        id="privacy"
        eyebrow="Privacy Policy"
        title="How data moves through the system"
        summary="These clauses describe what data the current build needs, what it does with that data, and where extra care is needed when outside services are involved."
        clauses={privacyClauses}
      />

      <section className="rounded-[28px] border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] sm:p-7">
        <h2 className="m-0 font-display text-[clamp(22px,2.5vw,30px)] font-bold">For the presentation</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
          This page covers the legal and privacy part of the project. The written presentation notes also cover the
          historical background, design evolution, user impact, inclusion risks, and ethics discussion for the video.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
          For an academic project, this page should be presented as transparent project documentation. If the system is
          ever deployed beyond coursework, the policy text should be reviewed again for the real operating context.
        </p>
        <div className="mt-4">
          <Link
            to="/"
            className="inline-flex items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
          >
            Return to welcome page
          </Link>
        </div>
      </section>
    </section>
  );
};

export default LegalHub;
