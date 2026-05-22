import {
  BarChart3,
  Users,
  Activity,
  Settings,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const links = [
  {
    label: "Reports",
    icon: BarChart3,
    path: "/",
  },
  {
    label: "Clients",
    icon: Users,
    path: "/clients",
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

export default function Sidebar() {
  return (
    <aside className="w-55 border-r bg-white flex flex-col">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-lg font-semibold">
          Narrative
        </h1>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;

          return (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `
                flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
                ${
                  isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-100"
                }
              `
              }
            >
              <Icon size={18} />
              {link.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="text-sm font-medium">
          Apex Media Group
        </div>

        <div className="text-xs text-slate-500">
          Agency workspace
        </div>
      </div>
    </aside>
  );
}