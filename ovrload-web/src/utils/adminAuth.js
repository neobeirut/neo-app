export function getAdminHeaders() {
  try {
    const adminToken = localStorage.getItem("admin_token");
    const adminId = localStorage.getItem("admin_id");
    if (!adminToken || !adminId) return {};
    return {
      "x-admin-token": adminToken,
      "x-admin-id": adminId,
    };
  } catch (e) {
    return {};
  }
}
