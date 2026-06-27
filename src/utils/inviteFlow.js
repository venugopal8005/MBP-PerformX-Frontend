import api from "../api/axios";

const INVITE_TOKEN_KEY = "pendingInviteToken";
const LEGACY_INVITE_TOKEN_KEY = "narrative.pendingInviteToken";

export const normalizeInviteToken = (token = "") => String(token || "").trim();

export const rememberInviteToken = (token) => {
  const normalized = normalizeInviteToken(token);
  if (!normalized) return "";

  window.sessionStorage.setItem(INVITE_TOKEN_KEY, normalized);
  window.localStorage.setItem(INVITE_TOKEN_KEY, normalized);
  window.sessionStorage.setItem(LEGACY_INVITE_TOKEN_KEY, normalized);
  window.localStorage.setItem(LEGACY_INVITE_TOKEN_KEY, normalized);
  return normalized;
};

export const getStoredInviteToken = () =>
  normalizeInviteToken(
    window.sessionStorage.getItem(INVITE_TOKEN_KEY) ||
      window.sessionStorage.getItem(LEGACY_INVITE_TOKEN_KEY) ||
      window.localStorage.getItem(INVITE_TOKEN_KEY) ||
      window.localStorage.getItem(LEGACY_INVITE_TOKEN_KEY) ||
      ""
  );

export const clearStoredInviteToken = () => {
  window.sessionStorage.removeItem(INVITE_TOKEN_KEY);
  window.sessionStorage.removeItem(LEGACY_INVITE_TOKEN_KEY);
  window.localStorage.removeItem(INVITE_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_INVITE_TOKEN_KEY);
};

export const inviteTokenFromSearch = (searchParams) =>
  normalizeInviteToken(searchParams.get("inviteToken") || searchParams.get("token") || "");

export const invitePath = (token) => `/invite/${encodeURIComponent(token)}`;

export const loginInvitePath = (token) =>
  `/auth/login?inviteToken=${encodeURIComponent(token)}&redirect=${encodeURIComponent(
    invitePath(token)
  )}`;

export const signupInvitePath = (token, email = "") => {
  const params = new URLSearchParams({
    inviteToken: token,
    redirect: invitePath(token),
  });

  if (email) params.set("email", email);

  return `/auth/signup?${params.toString()}`;
};

export const acceptInviteToken = async (token) => {
  const normalized = normalizeInviteToken(token);
  if (!normalized) throw new Error("Invite token is missing.");

  const res = await api.post(`/invites/${encodeURIComponent(normalized)}/accept`);
  return res.data;
};

export const inviteErrorMessage = (err) => {
  const message = err?.response?.data?.message || err?.message || "";
  if (/another email/i.test(message) || /sent to/i.test(message)) {
    return "This invite was sent to another email.";
  }

  return message || "Could not accept this invitation.";
};
