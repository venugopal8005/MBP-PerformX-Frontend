import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import "./css/Loader.css"

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, status } = useSelector((state) => state.user);

  if (status === "loading") {
    return (
      <div className="flex h-[100svh] w-full items-center justify-center bg-[#070709]">
        <span className="loader"></span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
