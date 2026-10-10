// Maps a password-change / password-reset API error to a user-facing string.
// Server codes: wrong_current_password, password_too_short, password_too_long,
// password_too_common (see server/src/routes/auth.js passwordErrorBody).
export function passwordErrorText(err, t) {
  const d = err?.data || {};
  const code = d.error || "";
  if (code === "wrong_current_password") return t("wrongCurrentPassword");
  if (code === "password_too_short") return t("pwTooShort").replace("{min}", String(d.min ?? ""));
  if (code === "password_too_long") return t("pwTooLong").replace("{max}", String(d.max ?? ""));
  if (code === "password_too_common") return t("pwTooCommon");
  if (err?.status === 0 || code === "network" || code === "timeout") return t("pwNetworkError");
  return t("pwGenericError");
}
