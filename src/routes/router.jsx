import { createBrowserRouter } from "react-router-dom";
import ProtectedRoute from "../ProtectedRoute";
import PublicRoute from "../PublicRoute";
import AppLayout from "../layouts/AppLayout";

import Reports from "../pages/Reports";
import ReportDetail from "../pages/ReportDetail";
import ArchivedReports from "../pages/ArchivedReports";
import ReportHistory from "../pages/ReportHistory";
import ReportRunDetail from "../pages/ReportRunDetail";
import Clients from "../pages/Clients";
import ClientDetail from "../pages/ClientDetail";
import ArchivedClients from "../pages/ArchivedClients";
import ClientHistory from "../pages/ClientHistory";
import Activity from "../pages/Activity";
import Settings from "../pages/Settings";
import AcceptInvite from "../pages/AcceptInvite";
import Login from "../components/auth/Login";
import Signup from "../components/auth/Signup";

export const router = createBrowserRouter([
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "/reports",
        element: <Reports />,
      },
      {
        path: "/reports/archived",
        element: <ArchivedReports />,
      },
      {
        path: "/reports/:reportId/history",
        element: <ReportHistory />,
      },
      {
        path: "/report-runs/:reportRunId",
        element: <ReportRunDetail />,
      },
      {
        path: "/reports/:reportId",
        element: <ReportDetail />,
      },
      {
        path: "/clients",
        element: <Clients />,
      },
      {
        path: "/clients/archived",
        element: <ArchivedClients />,
      },
      {
        path: "/clients/:clientId/history",
        element: <ClientHistory />,
      },
      {
        path: "/clients/:clientId",
        element: <ClientDetail />,
      },
      {
        path: "/activity",
        element: <Activity />,
      },
      {
        path: "/settings",
        element: <Settings />,
      },
    ],
  },
  {
    path: "/invite/:token",
    element: <AcceptInvite />,
  },
  {
    path: "/accept-invite",
    element: <AcceptInvite />,
  },
  {
    path: "/",
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    path: "/login",
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    path: "/auth/login",
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    path: "/signup",
    element: (
      <PublicRoute>
        <Signup />
      </PublicRoute>
    ),
  },
  {
    path: "/auth/signup",
    element: (
      <PublicRoute>
        <Signup />
      </PublicRoute>
    ),
  },
]);
