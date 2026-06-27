import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

import api from "../api/axios";
import { authSuccess } from "../Features/Auth/UserSlice";
import {
  acceptInviteToken,
  clearStoredInviteToken,
  inviteErrorMessage,
  loginInvitePath,
  rememberInviteToken,
  signupInvitePath,
} from "../utils/inviteFlow";

const formatDateTime = (value) => {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const canAttemptInvite = (status) => status === "pending" || status === "accepted";

export default function AcceptInvite() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.user);
  const token = params.token || searchParams.get("token") || searchParams.get("inviteToken") || "";
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const hasAttemptedAccept = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!token) {
        setError("Invitation token is missing.");
        setLoading(false);
        return;
      }

      rememberInviteToken(token);

      try {
        const res = await api.get(`/invites/${encodeURIComponent(token)}`);

        if (!cancelled) {
          const inviteData = res.data.invite || null;
          setInvite(inviteData);

          if (!inviteData) {
            setError("This invitation is no longer available.");
          } else if (inviteData.status === "expired") {
            setError("This invitation has expired. Ask the owner to resend it.");
          } else if (inviteData.status === "revoked") {
            setError("This invitation was revoked. Ask the owner for a new invite.");
          } else if (inviteData.status === "accepted" && !isAuthenticated) {
            setError("This invitation has already been accepted.");
          } else {
            setError("");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || "Could not verify invitation.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (
      loading ||
      accepting ||
      hasAttemptedAccept.current ||
      !token ||
      !invite ||
      !canAttemptInvite(invite.status) ||
      !isAuthenticated
    ) {
      return;
    }

    if (user?.email && user.email.toLowerCase() !== invite.email) {
      setError("This invite was sent to another email.");
      return;
    }

    hasAttemptedAccept.current = true;
    setAccepting(true);
    setError("");

    acceptInviteToken(token)
      .then((data) => {
        dispatch(authSuccess(data.user));
        clearStoredInviteToken();
        navigate("/reports", { replace: true });
      })
      .catch((err) => {
        setError(inviteErrorMessage(err));
      })
      .finally(() => {
        setAccepting(false);
      });
  }, [accepting, dispatch, invite, isAuthenticated, loading, navigate, token, user?.email]);

  const acceptInvite = async () => {
    setAccepting(true);
    setError("");

    try {
      const data = await acceptInviteToken(token);
      dispatch(authSuccess(data.user));
      clearStoredInviteToken();
      navigate("/reports", { replace: true });
    } catch (err) {
      setError(inviteErrorMessage(err));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F7F6] px-4 dark:bg-slate-950">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-[var(--shadow-card)] dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950">
          {loading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          Accept workspace invitation
        </h1>

        {loading ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Checking this invitation...</p>
        ) : invite ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <p className="text-sm text-slate-500 dark:text-slate-400">Workspace</p>
            <p className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
              {invite.workspace?.name || "Narrative workspace"}
            </p>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
              <div>
                <span className="block text-xs text-slate-400 dark:text-slate-500">Invited email</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{invite.email}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400 dark:text-slate-500">Expires</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {formatDateTime(invite.expires_at)}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {error && (
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <ShieldAlert size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && invite && canAttemptInvite(invite.status) && (
          <div className="mt-5">
            {isAuthenticated ? (
              <>
                {user?.email && user.email.toLowerCase() !== invite.email ? (
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    This invitation was sent to{" "}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{invite.email}</span>.
                    Please sign in with that email to accept it.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={acceptInvite}
                    disabled={accepting}
                    className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                  >
                    {accepting ? "Joining workspace..." : "Accept invitation"}
                  </button>
                )}
              </>
            ) : invite.status === "pending" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  to={loginInvitePath(token)}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                >
                  Sign in
                </Link>
                <Link
                  to={signupInvitePath(token, invite.email)}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Create account
                </Link>
              </div>
            ) : null}
          </div>
        )}

        <p className="mt-5 text-xs leading-5 text-slate-400 dark:text-slate-500">
          Only the email address that received this invite can accept it.
        </p>
      </div>
    </div>
  );
}
