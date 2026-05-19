export function formatVND(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!isFinite(v)) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(v);
}

export function formatNumber(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return new Intl.NumberFormat("vi-VN").format(v);
}

// Parse Vietnamese amount shortcuts: "20k", "1tr", "1.5tr", "4.000", "1.200.000".
export function parseAmountShortcut(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s/g, "");
  const m = s.match(/^([0-9.,]+)(k|tr|m|ty|b|tỷ)?$/i);
  if (!m) return null;

  const rawNumber = m[1];
  const unit = m[2];

  if (!unit) {
    const digits = rawNumber.replace(/[^0-9]/g, "");
    return digits ? Number(digits) : null;
  }

  const num = parseFloat(rawNumber.replace(/,/g, "."));
  if (!isFinite(num)) return null;
  if (unit === "k") return num * 1_000;
  if (unit === "m" || unit === "tr") return num * 1_000_000;
  if (unit === "ty" || unit === "tỷ" || unit === "b") return num * 1_000_000_000;
  return num;
}

// Parse a quick add like "20k cafe" or "1.5tr lương".
export function parseQuickAdd(
  text: string,
): { amount: number; note: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^([0-9.,]+(?:k|tr|m|ty|b|tỷ)?)\s*(.*)$/i);
  if (!m) return null;
  const amount = parseAmountShortcut(m[1]);
  if (amount === null) return null;
  return { amount, note: m[2].trim() };
}
