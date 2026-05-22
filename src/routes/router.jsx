import { createBrowserRouter } from "react-router-dom";

import AppLayout from "../layouts/AppLayout";

import Reports from "../pages/Reports";
import Clients from "../pages/Clients";
import Activity from "../pages/Activity";
import Settings from "../pages/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Reports />,
      },
      {
        path: "clients",
        element: <Clients />,
      },
      {
        path: "activity",
        element: <Activity />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
    ],
  },
]);