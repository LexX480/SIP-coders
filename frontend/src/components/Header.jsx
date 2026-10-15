import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import EmergencyContacts from "./EmergencyContacts";

const RESPONDER_LINKS_LOGGED_IN = [
  { path: "/", label: "Home" },
  { path: "/responder/home", label: "Responder Portal" },
  { path: "/responder/log", label: "Log Distribution" },
  { path: "/responder/distributions", label: "My Distributions" },
  { path: "/dropoff", label: "Drop Off Materials" },
  { path: "/transparency", label: "Public Transparency" },
];

// What an anonymous visitor (landing page, public need-reporting, etc.) sees
const RESPONDER_LINKS_LOGGED_OUT = [
  { path: "/", label: "Home" },
  { path: "/responder/home", label: "Responder Portal" },
  { path: "/dropoff", label: "Drop Off Materials" },
  { path: "/transparency", label: "Public Transparency" },
];

const COORDINATION_LINKS = [
  { path: "/coordination/dashboard", label: "Dashboard" },
  { path: "/coordination/alerts", label: "Duplication Alerts" },
  { path: "/coordination/warehouses", label: "Warehouses" },
  { path: "/coordination/analytics", label: "Analytics" },
];

// variant: "responder" (vermilion, top nav across the community/responder
// side) or "coordination" (indigo, top nav across the govt console)
export default function Header({ variant = "responder" }) {
  const location = useLocation();
  const { user, logout, isCoordination, isResponder } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the login dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (variant === "coordination") {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-md shadow-[0_1px_8px_rgba(20,20,20,0.04)]">
        <div className="h-16 max-w-[1120px] mx-auto px-margin-mobile lg:px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <img src="/logo-icon.png" alt="SaajhaRahat" className="w-9 h-9 object-contain rounded-md" />
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-primary tracking-tight">
                SaajhaRahat Coordination Console
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Ward &amp; Cluster Response
              </span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-space-md">
            {COORDINATION_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={
                  location.pathname === link.path
                    ? "transition-colors bg-primary-container text-on-primary font-label-md text-label-md rounded-lg px-space-xs py-1"
                    : "font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-space-sm">
            {isCoordination && (
              <div className="hidden sm:flex items-center gap-space-xs bg-surface-container-high px-space-sm py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" />
                <span className="font-label-sm text-label-sm text-on-surface">
                  {user?.fullName || "Coordinator"}
                </span>
              </div>
            )}
            <EmergencyContacts />
            <button
              onClick={logout}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
              title="Log out"
            >
              <span className="material-symbols-outlined text-on-primary text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </header>
    );
  }

  const links = isResponder ? RESPONDER_LINKS_LOGGED_IN : RESPONDER_LINKS_LOGGED_OUT;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
      <div className="h-16 max-w-[1120px] mx-auto px-gutter flex items-center justify-between">
        <Link to="/" className="flex items-center gap-space-sm">
          <img src="/logo-icon.png" alt="SaajhaRahat" className="w-9 h-9 object-contain rounded-md" />
          <span className="font-headline-sm text-headline-sm text-primary tracking-tight">SaajhaRahat</span>
        </Link>
        <nav className="hidden md:flex items-center gap-space-xs">
          {links.map((link) => (
            <Fragment key={link.path}>
              <Link
                to={link.path}
                className={
                  location.pathname === link.path
                    ? "px-3 py-2 transition-colors bg-primary-container text-on-primary font-label-md text-label-md rounded-lg"
                    : "px-3 py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
                }
              >
                {link.label}
              </Link>
              {link.path === "/responder/home" && <EmergencyContacts />}
            </Fragment>
          ))}
        </nav>
        <div className="flex items-center gap-space-sm">
          {user ? (
            <button
              onClick={logout}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
              title="Log out"
            >
              <span className="material-symbols-outlined text-on-primary text-[18px]">logout</span>
            </button>
          ) : (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
                title="Login"
              >
                <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-surface-container-lowest border border-surface-container-highest rounded-lg shadow-md py-1 z-50">
                  <Link
                    to="/responder/auth"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 font-body-sm text-body-sm text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-secondary">groups</span>
                    Responder Login
                  </Link>
                  <Link
                    to="/coordination/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 font-body-sm text-body-sm text-on-surface hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-primary">account_balance</span>
                    Government / Ward Committee Login
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}