import api from "../api";

/**
 * Logs in with the given credentials, populates AuthContext + localStorage,
 * and redirects to the correct dashboard based on the account's role.
 * Throws on failure so callers can show their own error message.
 */
export async function loginAndRedirect(username, password, { setToken, setRole, setUsernameState }, navigate) {
  const res = await api.post("token/", { username, password });
  const { access } = res.data;
  localStorage.setItem("token", access);

  const userRes = await api.get("user/me/", {
    headers: { Authorization: `Bearer ${access}` },
  });
  const role = userRes.data.role;
  const finalName =
    userRes.data.first_name ||
    userRes.data.username ||
    userRes.data.name ||
    "Student";

  localStorage.setItem("role", role);
  localStorage.setItem("username", finalName);

  setToken(access);
  setRole(role);
  if (setUsernameState) setUsernameState(finalName);

  const normalizedRole = role ? role.toLowerCase() : "";
  if (normalizedRole === "student") {
    navigate("/dashboard", { replace: true });
  } else if (normalizedRole === "teacher") {
    navigate("/teacher-dashboard", { replace: true });
  } else {
    throw new Error("Unauthorized system profile role detected.");
  }
}
