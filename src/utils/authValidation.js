const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (email = "") => email.trim().toLowerCase();

export const isValidEmail = (email = "") => {
  return EMAIL_PATTERN.test(normalizeEmail(email));
};

export const validatePassword = (password = "") => {
  return password.length >= 6;
};
