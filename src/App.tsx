import { useEffect, useState } from "react";
import Auth from "./components/Auth";
import FarmerDashboard from "./components/FarmerDashboard";
import ProduceInventory from "./components/ProduceInventory";
import QualityScan from "./components/QualityScan";
import AIDiagnosis from "./components/AIDiagnosis";
import BatchCreation from "./components/BatchCreation";
import Welcome from "./components/Welcome";
import type { ThemeMode, UserRole, ViewMode } from "./types";

const getInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return "dark";
};

const App = () => {
  const [role, setRole] = useState<UserRole>("farmer");
  const [view, setView] = useState<ViewMode>("welcome");
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className="min-h-screen px-6 py-6 sm:px-10 sm:py-8 lg:px-12 lg:py-10 flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-display text-[clamp(20px,2.4vw,28px)] font-bold tracking-[0.3px]">
            D2P Agriculture
          </span>
          <span className="text-sm text-[var(--muted)]">Secure trade for Rwanda's farmers and buyers</span>
        </div>
        <button
          type="button"
          className="rounded-full border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-transform duration-200 hover:-translate-y-0.5"
          onClick={toggleTheme}
          aria-pressed={theme === "dark"}
        >
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </header>

      <main className="flex justify-center">
        {view === "welcome" && (
          <Welcome role={role} onRoleChange={setRole} onGetStarted={() => setView("auth")} />
        )}
        {view === "auth" && (
          <Auth
            role={role}
            onRoleChange={setRole}
            onBack={() => setView("welcome")}
            onLoginSuccess={() => setView("farmer-dashboard")}
          />
        )}
        {view === "farmer-dashboard" && (
          <FarmerDashboard onLogout={() => setView("welcome")} onNavigate={setView} />
        )}
        {view === "inventory" && (
          <ProduceInventory onNavigate={setView} />
        )}
        {view === "quality-scan" && (
          <QualityScan onNavigate={setView} />
        )}
        {view === "ai-diagnosis" && (
          <AIDiagnosis onNavigate={setView} />
        )}
        {view === "batch-creation" && (
          <BatchCreation onNavigate={setView} />
        )}
      </main>
    </div>
  );
};

export default App;
