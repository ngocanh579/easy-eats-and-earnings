// Convert raw errors (including Supabase/Postgres) into safe user-facing messages.
// Never expose constraint names, RLS policy names, schema details, or stack info.
export function friendlyError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  const msg = raw.toLowerCase();

  if (!msg) return "Đã xảy ra lỗi không xác định. Vui lòng thử lại.";

  if (msg.includes("network") || msg.includes("fetch")) {
    return "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.";
  }
  if (msg.includes("unauthorized") || msg.includes("jwt") || msg.includes("auth")) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }
  if (
    msg.includes("row-level security") ||
    msg.includes("rls") ||
    msg.includes("permission denied")
  ) {
    return "Bạn không có quyền thực hiện thao tác này.";
  }
  if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("constraint")) {
    return "Dữ liệu đã tồn tại hoặc không hợp lệ.";
  }
  if (msg.includes("not found")) {
    return "Không tìm thấy dữ liệu.";
  }
  return "Đã xảy ra lỗi. Vui lòng thử lại.";
}
