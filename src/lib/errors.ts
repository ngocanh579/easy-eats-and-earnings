// Map raw errors (including Supabase/Postgres ones) to safe, user-friendly Vietnamese messages.
// Never surface raw error.message to end users — it can leak schema/RLS/constraint details.

const GENERIC = "Đã có lỗi xảy ra. Vui lòng thử lại.";

const PATTERNS: Array<{ test: RegExp; msg: string }> = [
  { test: /duplicate key|already exists|unique constraint/i, msg: "Dữ liệu đã tồn tại." },
  { test: /violates foreign key|foreign key constraint/i, msg: "Dữ liệu đang được sử dụng, không thể thao tác." },
  { test: /violates not-null|null value/i, msg: "Vui lòng nhập đầy đủ thông tin." },
  { test: /row-level security|permission denied|rls/i, msg: "Bạn không có quyền thực hiện thao tác này." },
  { test: /jwt|unauthorized|not authenticated/i, msg: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." },
  { test: /network|failed to fetch|timeout/i, msg: "Lỗi kết nối. Vui lòng thử lại." },
  { test: /invalid login credentials/i, msg: "Email hoặc mật khẩu không đúng." },
  { test: /user already registered/i, msg: "Email đã được đăng ký." },
  { test: /password.*(short|length|characters)/i, msg: "Mật khẩu phải có ít nhất 6 ký tự." },
];

export function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (raw) {
    // Log raw error for debugging — never shown to user.
    // eslint-disable-next-line no-console
    console.error("[error]", raw);
    for (const { test, msg } of PATTERNS) {
      if (test.test(raw)) return msg;
    }
  }
  return GENERIC;
}
