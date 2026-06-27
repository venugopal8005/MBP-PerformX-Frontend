import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";

import { Provider } from "react-redux";

import AuthBootstrap from "./AuthBootstrap";
import { store } from "./app/store";
import "./index.css";

const savedTheme = window.localStorage.getItem("narrative-theme") || "light";
document.documentElement.classList.toggle("dark", savedTheme === "dark");
document.documentElement.dataset.theme = savedTheme;

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const app = (
  <Provider store={store}>
    <AuthBootstrap />
  </Provider>
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>
    ) : (
      app
    )}
  </React.StrictMode>
);
