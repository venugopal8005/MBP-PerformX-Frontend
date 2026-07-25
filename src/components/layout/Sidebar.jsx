import {
  BarChart3,
  Users,
  Activity,
  ListChecks,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { NavLink, useNavigate } from "react-router-dom";

import { signout } from "../../Features/Auth/UserSlice";
import ReviewSummaryBadge from "../reviews/ReviewSummaryBadge";
import useReviewSummary from "../../hooks/useReviewSummary";

const links = [
  {
    label: "Reports",
    icon: BarChart3,
    path: "/reports",
  },
  {
    label: "Clients",
    icon: Users,
    path: "/clients",
  },
  {
    label: "Review",
    icon: ListChecks,
    path: "/reviews",
  },
  {
    label: "Activity",
    icon: Activity,
    path: "/activity",
  },
  {
    label: "Settings",
    icon: Settings,
    path: "/settings",
  },
];

// Brand row alignment controls. Match nav icon size/gap to align logo + text.
const brandHeaderClass = "flex h-16 items-center px-4.5";
const brandWordmarkClass =
  "flex items-center gap-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50";
const brandLogoClass = "h-8 w-8 shrink-0 rounded-[4px]";
const brandTextClass = "leading-none " ;

export default function Sidebar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const { status, user } = useSelector((state) => state.user);
  const isLoggingOut = status === "loading";
  const reviewSummary = useReviewSummary();
  const agencyName = user?.agency?.name || "Agency workspace";
  const agencyLogo = user?.agency?.logo_url || user?.agency?.logoUrl;
  const agencyInitials = agencyName
    ? agencyName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "AG";

  const handleLogout = async () => {
    await dispatch(signout());
    setIsLogoutDialogOpen(false);
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    if (!isLogoutDialogOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsLogoutDialogOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLogoutDialogOpen]);

  return (
    <>
      <aside className="flex w-55 flex-col border-r border-slate-200/80 bg-[#F2F2F0] dark:border-slate-800 dark:bg-slate-950">
        <div className={brandHeaderClass}>
          <h1 className={brandWordmarkClass}>
            <img
              src="/narrative-icon.svg"
              alt=""
              aria-hidden="true"
              className={brandLogoClass}
            />
            <span className={brandTextClass}>arrative</span>
          </h1>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {links.map((link) => {
            const Icon = link.icon;

            return (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  `
                  flex items-center gap-3 rounded-xl border px-3 py-2 text-[15px] font-medium transition-colors
                  ${
                    isActive
                      ? "border-slate-200 bg-white text-slate-950 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
                      : "border-transparent text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900/70 dark:hover:text-slate-100"
                  }
                `
                }
              >
                <Icon size={20} />
                <span>{link.label}</span>
                {link.path === "/reviews" && <ReviewSummaryBadge summary={reviewSummary.summary} />}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-200/80 p-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {agencyLogo ? (
              <img
                src={agencyLogo}
                alt={agencyName}
                className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-950">
                {agencyInitials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-950 dark:text-slate-100">
                {agencyName}
              </div>

              <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                {user?.agency?.slug || "Agency profile"}
              </div>
            </div>

            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => setIsLogoutDialogOpen(true)}
              disabled={isLoggingOut}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {isLogoutDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setIsLogoutDialogOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            className="w-full max-w-[380px] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                  <LogOut size={19} />
                </div>

                <div>
                  <h2
                    id="logout-dialog-title"
                    className="text-base font-semibold text-slate-900 dark:text-slate-100"
                  >
                    Sign out?
                  </h2>

                  <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                    You will need to sign in again to access this workspace.
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setIsLogoutDialogOpen(false)}
                disabled={isLoggingOut}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsLogoutDialogOpen(false)}
                disabled={isLoggingOut}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
              >
                {isLoggingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
