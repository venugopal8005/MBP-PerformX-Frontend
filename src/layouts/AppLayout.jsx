import { Outlet } from "react-router-dom";

import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-main)]">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-hidden bg-[var(--bg-app)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
