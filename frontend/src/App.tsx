import { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import Auth from "./components/Auth";
import FarmerDashboard from "./components/FarmerDashboard";
import ProduceInventory from "./components/ProduceInventory";
import FarmerMarket from "./components/FarmerMarket";
import QualityScan from "./components/QualityScan";
import BatchCreation from "./components/BatchCreation";
import BatchTracker from "./components/BatchTracker";
import Wallet from "./components/Wallet";
import FarmerProfile from "./components/FarmerProfile";
import BuyerMarketplace from "./components/BuyerMarketplace";
import BuyerBatchDetails from "./components/BuyerBatchDetails";
import OrderReview from "./components/OrderReview";
import OrderTracking from "./components/OrderTracking";
import BuyerOrderHistory from "./components/BuyerOrderHistory";
import BuyerProfile from "./components/BuyerProfile";
import AdminEscrowAudit from "./components/admin/AdminEscrowAudit";
import AdminHubDisputes from "./components/admin/AdminHubDisputes";
import AdminOverview from "./components/admin/AdminOverview";
import Welcome from "./components/Welcome";
import type { ThemeMode, UserRole } from "./types";
import { logout, fromApiRole, type ApiUser } from "./api/auth";
import {
  clearStoredUser,
  clearTokens,
  getRefreshToken,
  getStoredUser,
  setStoredUser,
} from "./utils/authStorage";

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
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [isRestoring, setIsRestoring] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const currentStoredUser = getStoredUser() as ApiUser | null;
  const currentUserRole: UserRole | null = currentStoredUser ? fromApiRole(currentStoredUser.role) : null;

  const routeForRole = (role: UserRole) => {
    if (role === "farmer") return "/farmer/dashboard";
    if (role === "buyer") return "/buyer/marketplace";
    return "/admin/overview";
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const restoreSession = () => {
      const storedUser = getStoredUser() as ApiUser | null;
      const refreshToken = getRefreshToken();

      if (storedUser && refreshToken) {
        const userRole = fromApiRole(storedUser.role);
        if (location.pathname === "/" || location.pathname.startsWith("/auth")) {
          navigate(routeForRole(userRole));
        }
      }
      setIsRestoring(false);
    };
    restoreSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleLogout = async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await logout(refreshToken);
      } catch (error) {
        // ignore logout errors
      }
    }
    clearTokens();
    clearStoredUser();
    navigate("/");
  };

  const handleLoginSuccess = (nextRole: UserRole, user?: unknown) => {
    if (user) {
      setStoredUser(user);
    }
    navigate(routeForRole(nextRole));
  };

  const handleNavigateToAuth = (tab: "login" | "register") => {
    navigate(`/auth/${tab}`);
  };

  const navigateBuyerView = (view: string) => {
    const normalized = view.startsWith("buyer-") ? view.slice("buyer-".length) : view;
    navigate(`/buyer/${normalized}`);
  };

  const navigateAdminView = (view: string) => {
    const normalized = view.startsWith("admin-") ? view.slice("admin-".length) : view;
    navigate(`/admin/${normalized}`);
  };

  const isAdminRoute = location.pathname.startsWith("/admin");
  const adminRouteFallback = currentUserRole ? routeForRole(currentUserRole) : "/auth/login";

  if (isRestoring) {
    return null; // Or a loading spinner
  }

  return (
    <div className={`min-h-screen flex flex-col ${isAdminRoute ? "px-4 py-4 sm:px-6 sm:py-6 gap-4" : "px-6 py-6 sm:px-10 sm:py-8 lg:px-12 lg:py-10 gap-6 sm:gap-8"}`}>
      {!isAdminRoute && (
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-display text-[clamp(20px,2.4vw,28px)] font-bold tracking-[0.3px]">
              IsokoLink
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
      )}

      <main className="flex justify-center">
        <Routes>
          <Route
            path="/"
            element={<Welcome onGetStarted={handleNavigateToAuth} />}
          />
          <Route
            path="/auth/login"
            element={
              <Auth
                initialTab="login"
                onBack={() => navigate("/")}
                onLoginSuccess={handleLoginSuccess}
              />
            }
          />
          <Route
            path="/auth/register"
            element={
              <Auth
                initialTab="register"
                onBack={() => navigate("/")}
                onLoginSuccess={handleLoginSuccess}
              />
            }
          />

          {/* Farmer Routes */}
          <Route
            path="/farmer/dashboard"
            element={<FarmerDashboard onLogout={handleLogout} onNavigate={(view) => navigate(`/farmer/${view}`)} />}
          />
          <Route path="/farmer/inventory" element={<ProduceInventory onNavigate={(view) => navigate(`/farmer/${view}`)} />} />
          <Route path="/farmer/market" element={<FarmerMarket onNavigate={(view) => navigate(`/farmer/${view}`)} />} />
          <Route path="/farmer/quality-scan" element={<QualityScan onNavigate={(view) => navigate(`/farmer/${view}`)} />} />
          <Route path="/farmer/batch-creation" element={<BatchCreation onNavigate={(view) => navigate(`/farmer/${view}`)} />} />
          <Route path="/farmer/batch-tracker/:id" element={<BatchTracker onNavigate={(view) => navigate(`/farmer/${view}`)} />} />
          <Route path="/farmer/wallet" element={<Wallet onNavigate={(view) => navigate(`/farmer/${view}`)} />} />
          <Route path="/farmer/profile" element={<FarmerProfile onNavigate={(view) => navigate(`/farmer/${view}`)} onLogout={handleLogout} />} />

          {/* Buyer Routes */}
          <Route
            path="/buyer/marketplace"
            element={<BuyerMarketplace onNavigate={navigateBuyerView} />}
          />
          <Route path="/buyer/batch-details" element={<BuyerBatchDetails onNavigate={navigateBuyerView} />} />
          <Route path="/buyer/order-review" element={<OrderReview onNavigate={navigateBuyerView} />} />
          <Route path="/buyer/order-tracking" element={<OrderTracking onNavigate={navigateBuyerView} />} />
          <Route path="/buyer/order-history" element={<BuyerOrderHistory onNavigate={navigateBuyerView} />} />
          <Route path="/buyer/profile" element={<BuyerProfile onNavigate={navigateBuyerView} onLogout={handleLogout} />} />

          {/* Admin Routes */}
          <Route path="/admin" element={currentUserRole === "admin" ? <Navigate to="/admin/overview" replace /> : <Navigate to={adminRouteFallback} replace />} />
          <Route path="/admin/overview" element={currentUserRole === "admin" ? <AdminOverview onNavigate={navigateAdminView} /> : <Navigate to={adminRouteFallback} replace />} />
          <Route path="/admin/escrow" element={currentUserRole === "admin" ? <AdminEscrowAudit onNavigate={navigateAdminView} /> : <Navigate to={adminRouteFallback} replace />} />
          <Route path="/admin/hubs-disputes" element={currentUserRole === "admin" ? <AdminHubDisputes onNavigate={navigateAdminView} /> : <Navigate to={adminRouteFallback} replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;

