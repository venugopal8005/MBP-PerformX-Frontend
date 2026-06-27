import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import { checkAuth } from "./Features/Auth/authThunks";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes/router";
import "./css/Loader.css";

export default function AuthBootstrap() {
  const dispatch = useDispatch();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    dispatch(checkAuth()).finally(() => {
      setIsReady(true);
    });
  }, [dispatch]);

  if (!isReady) {
    return (
      <div className="flex h-[100svh] w-full items-center justify-center bg-[#070709]">
        <span className="loader"></span>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}
