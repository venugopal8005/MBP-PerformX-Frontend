// src/auth/pages/Login.jsx
import { useEffect, useRef, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { authSuccess, googleAuth, signin } from "../../Features/Auth/UserSlice";
import { isValidEmail, normalizeEmail } from "../../utils/authValidation";
import GoogleAuthButton from "./GoogleAuthButton";
import {
  acceptInviteToken,
  clearStoredInviteToken,
  getStoredInviteToken,
  inviteErrorMessage,
  inviteTokenFromSearch,
  rememberInviteToken,
  signupInvitePath,
} from "../../utils/inviteFlow";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = inviteTokenFromSearch(searchParams) || getStoredInviteToken();
  const redirectTo = searchParams.get("redirect") || "/reports";
  const [email, setemail] = useState("");
  const [password, setpassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");
  const [pendingGoogleAccessToken, setPendingGoogleAccessToken] = useState("");
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState(null);
  const [googleAgencyName, setGoogleAgencyName] = useState("");
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const hasAttemptedInviteAccept = useRef(false);
  const { isAuthenticated, status, error } = useSelector(
    (state) => state.user,
  );
  const isLoading = status === "loading";

  const handleSignin = (e) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      setLocalError("Enter a valid work email.");
      return;
    }

    if (!password) {
      setLocalError("Enter your password.");
      return;
    }

    setLocalError("");
    if (inviteToken) rememberInviteToken(inviteToken);
    dispatch(
      signin({
        email: normalizedEmail,
        password,
      }),
    );
  };

  const handleGoogleSuccess = async (tokenResponse) => {
    const accessToken = tokenResponse?.access_token;

    if (!accessToken) {
      setLocalError("Google sign in did not return an access token.");
      return;
    }

    setLocalError("");
    if (inviteToken) rememberInviteToken(inviteToken);

    try {
      await dispatch(googleAuth({ accessToken, inviteToken })).unwrap();
    } catch (err) {
      if (err?.requiresAgencyName) {
        setPendingGoogleAccessToken(accessToken);
        setPendingGoogleProfile(err.profile || null);
        setGoogleAgencyName("");
        return;
      }

      setLocalError(err?.message || "Google sign in failed.");
    }
  };

  const startGoogleSignin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => setLocalError("Google sign in failed."),
    scope: "openid email profile",
  });

  const handleGoogleAgencySubmit = async (e) => {
    e.preventDefault();
    const trimmedAgencyName = googleAgencyName.trim();

    if (!trimmedAgencyName) {
      setLocalError("Enter your agency name.");
      return;
    }

    if (!pendingGoogleAccessToken) {
      setLocalError("Start Google sign in again.");
      return;
    }

    setLocalError("");
    if (inviteToken) rememberInviteToken(inviteToken);

    try {
      await dispatch(
        googleAuth({
          accessToken: pendingGoogleAccessToken,
          agencyName: trimmedAgencyName,
          inviteToken,
        }),
      ).unwrap();
      setPendingGoogleAccessToken("");
      setPendingGoogleProfile(null);
      setGoogleAgencyName("");
    } catch (err) {
      setLocalError(err?.message || "Google sign in failed.");
    }
  };

  useEffect(() => {
    if (inviteToken) {
      rememberInviteToken(inviteToken);
    }
  }, [inviteToken]);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (!inviteToken) {
      navigate(redirectTo, { replace: true });
      return;
    }

    if (hasAttemptedInviteAccept.current) return;

    hasAttemptedInviteAccept.current = true;
    setIsAcceptingInvite(true);
    setLocalError("");

    acceptInviteToken(inviteToken)
      .then((data) => {
        dispatch(authSuccess(data.user));
        clearStoredInviteToken();
        navigate("/reports", { replace: true });
      })
      .catch((err) => {
        setLocalError(inviteErrorMessage(err));
      })
      .finally(() => {
        setIsAcceptingInvite(false);
      });
  }, [dispatch, inviteToken, isAuthenticated, navigate, redirectTo]);

  return (
    <div className="min-h-screen bg-[#F7F7F6] dark:bg-slate-950">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* LEFT SIDE */}
        <div className="relative hidden overflow-hidden border-r border-slate-200 bg-[#F8F8F7] dark:border-slate-800 dark:bg-slate-950 lg:flex">
          {/* DOT GRID */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: "radial-gradient(#878787 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative flex w-full flex-col justify-between p-12">
            {/* TOP */}
            <div>
              <h1 className="text-[38px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Narrative
              </h1>

              <p className="mt-2 max-w-sm text-[17px] leading-8 text-slate-500 dark:text-slate-400">
                Intelligence for performance marketing teams.
              </p>
            </div>

            {/* SIGNALS */}
            <div className="max-w-[500px]">
              <p className="mb-5 text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
                Live Signals 
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="flex items-center gap-4">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-400" />

                    <p className="text-[15px] text-slate-700 dark:text-slate-200">
                      CTR decline detected in retargeting segment.
                    </p>
                  </div>

                  <span className="text-sm text-slate-400">2m ago</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="flex items-center gap-4">
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />

                    <p className="text-[15px] text-slate-700 dark:text-slate-200">
                      Creative fatigue emerging in UGC campaign.
                    </p>
                  </div>

                  <span className="text-sm text-slate-400">5m ago</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="flex items-center gap-4">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />

                    <p className="text-[15px] text-slate-700 dark:text-slate-200">
                      ROAS stabilized after audience consolidation.
                    </p>
                  </div>

                  <span className="text-sm text-slate-400">12m ago</span>
                </div>
              </div>
            </div>

            {/* BOTTOM */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-200 text-xs text-slate-600">
                  AG
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-200 text-xs text-slate-600">
                  MB
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-200 text-xs text-slate-600">
                  PF
                </div>
              </div>

              <div className="rounded-full border border-slate-200 bg-white px-5 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  Live monitoring active · 24 signals today
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex flex-col items-center justify-center bg-[#F2F2F0] px-8 dark:bg-slate-950">
          <div className="w-full max-w-[530px]">
            <div>
              <h2 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Welcome back
              </h2>

              <p className="mt-2 text-[15px] text-slate-500 dark:text-slate-400">
                Sign in to Narrative
              </p>
            </div>

            <form
              className="mt-8 space-y-3"
              onSubmit={handleSignin}
              autoComplete="on"
            >
              <div>
                <label
                  htmlFor="login-email"
	                  className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Work Email
                </label>

                <input
                  id="login-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setemail(e.target.value)}
                  placeholder="name@agency.com"
                  required
                  autoComplete="email"
                  inputMode="email"
	                  className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-700"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
	                  className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>

                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setpassword(e.target.value)}
                  required
                  autoComplete="current-password"
	                  className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-700"
                />

                <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
	                    className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    {showPassword ? "Hide password" : "Show password"}
                  </button>
                </div>
              </div>

              {(localError || error) && (
                <p className="text-sm font-medium text-red-500">
                  {localError || error}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading || isAcceptingInvite}
                className="h-14 w-full rounded-xl bg-[#0B132B] text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading || isAcceptingInvite
                  ? isAcceptingInvite
                    ? "Joining workspace..."
                    : "Signing in..."
                  : "Continue"}
              </button>

              <div className="flex items-center gap-4">
	                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />

	                <span className="text-sm text-slate-400 dark:text-slate-500">or</span>

	                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>

              <GoogleAuthButton
                label="Sign in with Google"
                missingLabel={
                  googleClientId
                    ? ""
                    : "Add VITE_GOOGLE_CLIENT_ID to enable Google sign in."
                }
                disabled={!googleClientId || isLoading || isAcceptingInvite}
                onClick={() => {
                  if (inviteToken) rememberInviteToken(inviteToken);
                  startGoogleSignin();
                }}
              />
            </form>

            <div className="mt-5">
              <Link
                to={inviteToken ? signupInvitePath(inviteToken) : "/auth/signup"}
	                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                New to Narrative? Create a workspace →
              </Link>
            </div>

            
          </div>
          <div className="absolute bottom-10"><p className="mb-0 text-center text-xs text-slate-400">
              Built for modern performance marketing teams.
            </p></div>
        </div>
      </div>
      {pendingGoogleAccessToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
	          <form
	            onSubmit={handleGoogleAgencySubmit}
	            className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
	              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {pendingGoogleProfile?.email || "Google sign in"}
              </p>
	              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Name your workspace
              </h3>
            </div>

            <div className="mt-5">
              <label
                htmlFor="login-google-agency-name"
	                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Agency Name
              </label>
              <input
                id="login-google-agency-name"
                type="text"
                value={googleAgencyName}
                onChange={(e) => setGoogleAgencyName(e.target.value)}
                placeholder="Acme Digital"
                autoComplete="organization"
                autoFocus
	                className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-700"
              />
            </div>

            {(localError || error) && (
              <p className="mt-3 text-sm font-medium text-red-500">
                {localError || error}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setPendingGoogleAccessToken("");
                  setPendingGoogleProfile(null);
                  setGoogleAgencyName("");
                  setLocalError("");
                }}
	                className="h-12 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || isAcceptingInvite}
                className="h-12 flex-1 rounded-xl bg-[#0B132B] text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isAcceptingInvite ? "Joining..." : isLoading ? "Creating..." : "Continue"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
