import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import { getStoredInviteToken, invitePath, inviteTokenFromSearch } from "./utils/inviteFlow";

export default function PublicRoute({ children }) {
  const { isAuthenticated } = useSelector((state) => state.user);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const inviteToken = inviteTokenFromSearch(searchParams) || getStoredInviteToken();
  const redirectTo = inviteToken ? invitePath(inviteToken) : searchParams.get("redirect") || "/reports";

  if (isAuthenticated && inviteToken) {
    return children;
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
