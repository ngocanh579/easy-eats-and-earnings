import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  TrendingUp,
  PiggyBank,
  CheckCircle2,
  DollarSign,
  Coffee,
  ShoppingBag,
  Tv,
  Plane,
  Utensils,
  Home,
  Car,
  FileText,
  ShieldAlert,
  Calendar,
  Compass,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatVND, parseAmountShortcut } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/smart-plan")({
  component: SmartPlanPage,
});

type Tx = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  kind: "expense" | "income" | "debt" | "savings";
  amount: number;
  note: string | null;
  occurred_at: string;
};

type Category = {
  id: string;
  name: string;
  kind: "expense" | "income" | "debt" | "savings";
  icon: string | null;
  color: string | null;
  parent_id: string | null;
};

// ----------------------------------------------------
// HIGH-FIDELITY DEMO DATA (Vietnamese Localized)
// ----------------------------------------------------
const DEMO_INCOME = 22000000; // 22 Million VND

const DEMO_TXS = [
  // --- Needs (Thiết yếu - Target: 11,000,000) ---
  // Ăn uống
  {
    note: "Mua thức ăn tuần 1",
    category_name: "Ăn uống",
    kind: "expense",
    amount: 850000,
    occurred_at: "2026-05-02",
  },
  {
    note: "Ăn trưa văn phòng",
    category_name: "Ăn uống",
    kind: "expense",
    amount: 150000,
    occurred_at: "2026-05-05",
  },
  {
    note: "Đi chợ siêu thị Co.opmart",
    category_name: "Ăn uống",
    kind: "expense",
    amount: 1200000,
    occurred_at: "2026-05-10",
  },
  {
    note: "Ăn tối cùng gia đình",
    category_name: "Ăn uống",
    kind: "expense",
    amount: 650000,
    occurred_at: "2026-05-12",
  },
  // Nhà ở
  {
    note: "Tiền thuê nhà tháng 5",
    category_name: "Nhà ở",
    kind: "expense",
    amount: 4800000,
    occurred_at: "2026-05-01",
  },
  {
    note: "Sửa vòi nước bồn tắm",
    category_name: "Nhà ở",
    kind: "expense",
    amount: 200000,
    occurred_at: "2026-05-08",
  },
  // Đi lại
  {
    note: "Đổ xăng xe máy",
    category_name: "Đi lại",
    kind: "expense",
    amount: 90000,
    occurred_at: "2026-05-03",
  },
  {
    note: "Đặt Grab đi công tác",
    category_name: "Đi lại",
    kind: "expense",
    amount: 180000,
    occurred_at: "2026-05-07",
  },
  {
    note: "Vé xe buýt tháng",
    category_name: "Đi lại",
    kind: "expense",
    amount: 100000,
    occurred_at: "2026-05-09",
  },
  // Hóa đơn
  {
    note: "Tiền điện sinh hoạt",
    category_name: "Hoá đơn",
    kind: "expense",
    amount: 1150000,
    occurred_at: "2026-05-05",
  },
  {
    note: "Tiền nước",
    category_name: "Hoá đơn",
    kind: "expense",
    amount: 120000,
    occurred_at: "2026-05-05",
  },
  {
    note: "Cước Internet cáp quang",
    category_name: "Hoá đơn",
    kind: "expense",
    amount: 250000,
    occurred_at: "2026-05-06",
  },

  // --- Wants (Mong muốn - Target: 6,600,000) ---
  // Cafe
  {
    note: "Họp nhóm Highland Coffee",
    category_name: "Cafe",
    kind: "expense",
    amount: 120000,
    occurred_at: "2026-05-03",
  },
  {
    note: "Cà phê sữa đá sáng",
    category_name: "Cafe",
    kind: "expense",
    amount: 450000,
    occurred_at: "2026-05-15",
  }, // Tổng nhiều lần
  // Mua sắm
  {
    note: "Mua áo thun Polo",
    category_name: "Mua sắm",
    kind: "expense",
    amount: 350000,
    occurred_at: "2026-05-04",
  },
  {
    note: "Giày Sneaker Adidas",
    category_name: "Mua sắm",
    kind: "expense",
    amount: 2200000,
    occurred_at: "2026-05-11",
  },
  {
    note: "Mỹ phẩm skincare",
    category_name: "Mua sắm",
    kind: "expense",
    amount: 950000,
    occurred_at: "2026-05-14",
  },
  // Giải trí
  {
    note: "Vé xem phim CGV & Bắp nước",
    category_name: "Giải trí",
    kind: "expense",
    amount: 260000,
    occurred_at: "2026-05-09",
  },
  {
    note: "Đăng ký Spotify Premium",
    category_name: "Giải trí",
    kind: "expense",
    amount: 59000,
    occurred_at: "2026-05-10",
  },
  {
    note: "Nạp thẻ game giải trí",
    category_name: "Giải trí",
    kind: "expense",
    amount: 200000,
    occurred_at: "2026-05-13",
  },
  // Du lịch
  {
    note: "Vé máy bay đi Đà Nẵng hè",
    category_name: "Du lịch",
    kind: "expense",
    amount: 2300000,
    occurred_at: "2026-05-12",
  },
  {
    note: "Đặt phòng Homestay Đà Nẵng",
    category_name: "Du lịch",
    kind: "expense",
    amount: 1200000,
    occurred_at: "2026-05-13",
  },

  // --- Savings (Tiết kiệm - Target: 4,400,000) ---
  // Quỹ dự phòng
  {
    note: "Trích quỹ khẩn cấp định kỳ",
    category_name: "Quỹ dự phòng",
    kind: "savings",
    amount: 2000000,
    occurred_at: "2026-05-02",
  },
  // Tiết kiệm
  {
    note: "Gửi tiết kiệm tích luỹ app ngân hàng",
    category_name: "Tiết kiệm",
    kind: "savings",
    amount: 1500000,
    occurred_at: "2026-05-05",
  },
  // Đầu tư
  {
    note: "Mua chứng chỉ quỹ VinaCapital",
    category_name: "Đầu tư",
    kind: "savings",
    amount: 1000000,
    occurred_at: "2026-05-10",
  },
];

const DEFAULT_CATEGORY_MAPPING: Record<string, "needs" | "wants" | "savings"> = {
  "ăn uống": "needs",
  "đi lại": "needs",
  "nhà ở": "needs",
  "tiền thuê nhà": "needs",
  "tiền nhà": "needs",
  "điện nước": "needs",
  internet: "needs",
  cước: "needs",
  gas: "needs",
  phòng: "needs",
  "chung cư": "needs",
  "biệt thự": "needs",
  "căn hộ": "needs",
  "hoá đơn": "needs",
  "hóa đơn": "needs",
  điện: "needs",
  nước: "needs",
  xăng: "needs",
  "học phí": "needs",
  "y tế": "needs",
  "sức khoẻ": "needs",
  "sức khỏe": "needs",
  thuốc: "needs",

  cafe: "wants",
  "cà phê": "wants",
  coffee: "wants",
  "mua sắm": "wants",
  shopping: "wants",
  "giải trí": "wants",
  "du lịch": "wants",
  "xem phim": "wants",
  game: "wants",
  spotify: "wants",
  "chơi game": "wants",
  "quần áo": "wants",
  giày: "wants",
  "mỹ phẩm": "wants",
  "tiệc tùng": "wants",
  nhậu: "wants",

  "tiết kiệm": "savings",
  "đầu tư": "savings",
  "quỹ dự phòng": "savings",
  "quỹ khẩn cấp": "savings",
  "dự phòng": "savings",
  "tích luỹ": "savings",
  "heo đất": "savings",
  "chứng khoán": "savings",
  vàng: "savings",
  "bảo hiểm": "savings",
};

function SmartPlanPage() {
  // ----------------------------------------------------
  // SETTINGS & LOCAL STORAGE
  // ----------------------------------------------------
  const [incomeInput, setIncomeInput] = useState<string>("22000000");
  const [inputValue, setInputValue] = useState<string>("22.000.000");
  const [incomeSource, setIncomeSource] = useState<"actual" | "custom">("custom");
  const [demoMode, setDemoMode] = useState<boolean>(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("easy_eats_smart_plan_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.income === "number") {
          setIncomeInput(parsed.income.toString());
          setInputValue(parsed.income.toLocaleString("vi-VN"));
        }
        if (parsed.incomeSource === "actual" || parsed.incomeSource === "custom") {
          setIncomeSource(parsed.incomeSource);
        }
        if (typeof parsed.demoMode === "boolean") setDemoMode(parsed.demoMode);
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    } else {
      setInputValue((22000000).toLocaleString("vi-VN"));
    }
  }, []);

  // Save settings on changes
  const saveSettings = (inc: string, source: "actual" | "custom", demo: boolean) => {
    localStorage.setItem(
      "easy_eats_smart_plan_settings",
      JSON.stringify({
        income: parseFloat(inc) || 22000000,
        incomeSource: source,
        demoMode: demo,
      }),
    );
  };

  const handleInputChange = (val: string) => {
    setInputValue(val);

    // 1. Try parsing Vietnamese amount shortcuts (like "33k", "1.5tr", "10tr", etc.)
    const parsed = parseAmountShortcut(val);
    if (parsed !== null && parsed > 0) {
      setIncomeInput(parsed.toString());
      saveSettings(parsed.toString(), "custom", demoMode);
    } else {
      // 2. Fallback to clean numeric string
      const cleanVal = val.replace(/[^0-9]/g, "");
      if (cleanVal) {
        setIncomeInput(cleanVal);
        saveSettings(cleanVal, "custom", demoMode);
      }
    }
  };

  const handleInputBlur = () => {
    // Re-format the display value cleanly based on parsed numeric incomeInput
    const num = parseFloat(incomeInput);
    if (!isNaN(num)) {
      setInputValue(num.toLocaleString("vi-VN"));
    }
  };

  const handleDemoModeToggle = () => {
    const next = !demoMode;
    setDemoMode(next);
    saveSettings(incomeInput, incomeSource, next);
    if (next) {
      toast.success("Đã bật Dữ liệu mẫu (Demo) để dễ dàng kiểm thử giao diện!");
    } else {
      toast.info("Đã chuyển về Dữ liệu thực tế của tài khoản của bạn.");
    }
  };

  // ----------------------------------------------------
  // DATA FETCHING (Supabase Queries via React Query)
  // ----------------------------------------------------
  const txsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Tx[];
    },
    enabled: !demoMode,
  });

  const catsQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
    enabled: !demoMode,
  });

  const realTxs = txsQuery.data ?? [];
  const realCats = catsQuery.data ?? [];

  // ----------------------------------------------------
  // SMART CATEGORY CLASSIFIER & CALCULATIONS
  // ----------------------------------------------------
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = Math.min(now.getDate(), daysInMonth);

  // Classify real transactions into 50/30/20 groups
  const classifiedRealData = useMemo(() => {
    let incomeSum = 0;

    // Subcategory details tracking
    const details = {
      // Needs
      "Ăn uống": 0,
      "Nhà ở": 0,
      "Đi lại": 0,
      "Hoá đơn": 0,
      // Wants
      Cafe: 0,
      "Mua sắm": 0,
      "Giải trí": 0,
      "Du lịch": 0,
      "Chi phí Khác": 0,
      // Savings
      "Quỹ dự phòng": 0,
      "Tiết kiệm": 0,
      "Đầu tư": 0,
    };

    let needsTotal = 0;
    let wantsTotal = 0;
    let savingsTotal = 0;
    let unclassifiedTotal = 0;

    for (const t of realTxs) {
      // Only process transactions of current month
      const tMonth = t.occurred_at.slice(0, 7);
      if (tMonth !== currentMonthKey) continue;

      const amt = Number(t.amount);

      // Handle actual incomes
      if (t.kind === "income") {
        incomeSum += amt;
        continue;
      }

      // Handle actual savings
      if (t.kind === "savings") {
        savingsTotal += amt;

        // Match specific subcategories
        const cat = realCats.find((c) => c.id === t.category_id);
        const name = cat?.name.toLowerCase() || "";
        if (name.includes("khẩn cấp") || name.includes("dự phòng") || name.includes("emergency")) {
          details["Quỹ dự phòng"] += amt;
        } else if (
          name.includes("đầu tư") ||
          name.includes("chứng khoán") ||
          name.includes("invest")
        ) {
          details["Đầu tư"] += amt;
        } else {
          details["Tiết kiệm"] += amt;
        }
        continue;
      }

      if (t.kind !== "expense") {
        continue;
      }

      // Find category details for expenses
      const cat = realCats.find((c) => c.id === t.category_id);
      if (!cat) {
        // Fallback: uncategorized expenses go to wants
        unclassifiedTotal += amt;
        details["Chi phí Khác"] += amt;
        continue;
      }

      const catName = cat.name;
      const lowerName = catName.normalize("NFC").toLowerCase();

      // Mapping rules
      const needsRegex =
        /ăn uống|đi lại|nhà ở|nhà|chung cư|biệt thự|căn hộ|hoá đơn|hóa đơn|điện|nước|điện nước|internet|cước|gas|thuê nhà|phòng|xăng|học phí|y tế|sức khoẻ|sức khỏe|thuốc/i;
      const wantsRegex =
        /cafe|cà phê|mua sắm|giải trí|du lịch|xem phim|mua đồ|spa|làm đẹp|chơi game|quần áo|giày|mỹ phẩm|tiệc tùng|nhậu/i;
      const savingsRegex =
        /tiết kiệm|đầu tư|quỹ khẩn cấp|dự phòng|tích luỹ|heo đất|chứng khoán|vàng|bảo hiểm/i;

      let group: "needs" | "wants" | "savings" | null = null;
      if (lowerName in DEFAULT_CATEGORY_MAPPING) {
        group = DEFAULT_CATEGORY_MAPPING[lowerName];
      }

      if (!group) {
        if (needsRegex.test(lowerName)) {
          group = "needs";
        } else if (wantsRegex.test(lowerName)) {
          group = "wants";
        } else if (savingsRegex.test(lowerName) || cat.kind === "savings") {
          group = "savings";
        }
      }

      if (group === "needs") {
        needsTotal += amt;
        if (lowerName.includes("ăn") || lowerName.includes("food")) {
          details["Ăn uống"] += amt;
        } else if (
          lowerName.includes("ở") ||
          lowerName.includes("thuê") ||
          lowerName.includes("nhà") ||
          lowerName.includes("rent") ||
          lowerName.includes("chung cư") ||
          lowerName.includes("căn hộ") ||
          lowerName.includes("phòng")
        ) {
          details["Nhà ở"] += amt;
        } else if (
          lowerName.includes("đi") ||
          lowerName.includes("xăng") ||
          lowerName.includes("grab") ||
          lowerName.includes("bus") ||
          lowerName.includes("traffic")
        ) {
          details["Đi lại"] += amt;
        } else {
          details["Hoá đơn"] += amt;
        }
      } else if (group === "wants") {
        wantsTotal += amt;
        if (
          lowerName.includes("cafe") ||
          lowerName.includes("cà phê") ||
          lowerName.includes("coffee")
        ) {
          details["Cafe"] += amt;
        } else if (
          lowerName.includes("sắm") ||
          lowerName.includes("đồ") ||
          lowerName.includes("quần") ||
          lowerName.includes("shopping")
        ) {
          details["Mua sắm"] += amt;
        } else if (
          lowerName.includes("trí") ||
          lowerName.includes("phim") ||
          lowerName.includes("game") ||
          lowerName.includes("spotify")
        ) {
          details["Giải trí"] += amt;
        } else {
          details["Du lịch"] += amt;
        }
      } else if (group === "savings") {
        savingsTotal += amt;
        if (
          lowerName.includes("dự phòng") ||
          lowerName.includes("khẩn cấp") ||
          lowerName.includes("emergency")
        ) {
          details["Quỹ dự phòng"] += amt;
        } else if (
          lowerName.includes("đầu tư") ||
          lowerName.includes("chứng") ||
          lowerName.includes("invest")
        ) {
          details["Đầu tư"] += amt;
        } else {
          details["Tiết kiệm"] += amt;
        }
      } else {
        // Fallback for completely unclassified categories goes to unclassifiedTotal
        unclassifiedTotal += amt;
        details["Chi phí Khác"] += amt;
      }
    }

    return {
      actualIncome: incomeSum,
      needsTotal,
      wantsTotal,
      savingsTotal,
      unclassifiedTotal,
      details,
    };
  }, [realTxs, realCats, currentMonthKey]);

  // ----------------------------------------------------
  // CONSOLIDATE DATA BASED ON MODE (REAL vs DEMO)
  // ----------------------------------------------------
  const activeIncome = useMemo(() => {
    if (incomeSource === "actual") {
      if (demoMode) {
        return 22000000; // Demo actual total income is exactly 22.000.000đ
      }
      return classifiedRealData.actualIncome || parseFloat(incomeInput) || 22000000;
    }
    return parseFloat(incomeInput) || 22000000;
  }, [demoMode, incomeSource, incomeInput, classifiedRealData.actualIncome]);

  const activeData = useMemo(() => {
    if (demoMode) {
      const details = {
        "Ăn uống": 0,
        "Nhà ở": 0,
        "Đi lại": 0,
        "Hoá đơn": 0,
        Cafe: 0,
        "Mua sắm": 0,
        "Giải trí": 0,
        "Du lịch": 0,
        "Chi phí Khác": 0,
        "Quỹ dự phòng": 0,
        "Tiết kiệm": 0,
        "Đầu tư": 0,
      };
      let needsTotal = 0;
      let wantsTotal = 0;
      let savingsTotal = 0;

      for (const t of DEMO_TXS) {
        const amt = t.amount;
        if (t.kind === "savings") {
          savingsTotal += amt;
          details[t.category_name as keyof typeof details] += amt;
        } else {
          // Check categories
          if (["Ăn uống", "Nhà ở", "Đi lại", "Hoá đơn"].includes(t.category_name)) {
            needsTotal += amt;
            details[t.category_name as keyof typeof details] += amt;
          } else {
            wantsTotal += amt;
            details[t.category_name as keyof typeof details] += amt;
          }
        }
      }

      return {
        needsTotal,
        wantsTotal,
        savingsTotal,
        unclassifiedTotal: 0,
        details,
      };
    }

    return {
      needsTotal: classifiedRealData.needsTotal,
      wantsTotal: classifiedRealData.wantsTotal,
      savingsTotal: classifiedRealData.savingsTotal,
      unclassifiedTotal: classifiedRealData.unclassifiedTotal,
      details: classifiedRealData.details,
    };
  }, [demoMode, classifiedRealData]);

  // ----------------------------------------------------
  // BUDGETS (50/30/20 target breakdown)
  // ----------------------------------------------------
  const targetNeeds = activeIncome * 0.5;
  const targetWants = activeIncome * 0.3;
  const targetSavings = activeIncome * 0.2;

  const totalSpent = activeData.needsTotal + activeData.wantsTotal;
  const totalAllocatedBudget = targetNeeds + targetWants + targetSavings;

  // Remaining safe-to-spend
  const remainingNeeds = targetNeeds - activeData.needsTotal;
  const remainingWants = targetWants - activeData.wantsTotal;
  const remainingSafeToSpend = remainingNeeds + remainingWants;

  const parsedPreview = useMemo(() => {
    const hasLetters = /[a-zA-Z]/g.test(inputValue);
    if (!hasLetters) return null;
    const parsed = parseAmountShortcut(inputValue);
    if (parsed !== null && parsed > 0) {
      return formatVND(parsed);
    }
    return null;
  }, [inputValue]);

  // ----------------------------------------------------
  // CHARTS DATA PREPARATION
  // ----------------------------------------------------
  // Chart 1: Target Allocation (50% / 30% / 20%)
  const targetChartData = [
    { name: "Thiết yếu (50%)", value: targetNeeds, color: "var(--color-primary)" },
    { name: "Mong muốn (30%)", value: targetWants, color: "var(--color-warning)" },
    { name: "Tiết kiệm (20%)", value: targetSavings, color: "var(--color-success)" },
  ];

  // Chart 2: Actual Allocations
  const actualChartData = useMemo(() => {
    const totalActual = activeData.needsTotal + activeData.wantsTotal + activeData.savingsTotal;
    if (totalActual === 0) {
      return [{ name: "Chưa chi tiêu", value: 1, color: "var(--color-muted)" }];
    }
    return [
      { name: "Thiết yếu", value: activeData.needsTotal, color: "var(--color-primary)" },
      { name: "Mong muốn", value: activeData.wantsTotal, color: "var(--color-warning)" },
      { name: "Tiết kiệm", value: activeData.savingsTotal, color: "var(--color-success)" },
    ];
  }, [activeData]);

  return (
    <div className="space-y-5 animate-fade-in pb-8 sm:space-y-6">
      {/* Header section with Premium design */}
      <div className="flex flex-col gap-4 rounded-[1.75rem] bg-card/80 p-4 shadow-[var(--shadow-soft)] sm:p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
              <Sparkles className="h-4.5 w-4.5 animate-pulse" />
            </div>
            <h1 className="font-display text-xl font-semibold sm:text-2xl lg:text-3xl">
              Kế hoạch chi tiêu 50/30/20
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Tự động tối ưu tài chính cá nhân thông minh và dự báo chi tiêu tháng tiếp theo.
          </p>
        </div>

        {/* Demo switches */}
        <div className="flex w-full flex-wrap items-center gap-3 rounded-2xl bg-muted/60 p-1.5 self-start md:w-auto md:self-center">
          <button
            onClick={handleDemoModeToggle}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 md:flex-none",
              demoMode
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Compass className="h-3.5 w-3.5" />
            Dữ liệu mẫu (Demo)
          </button>
        </div>
      </div>

      {/* Control panel for Income Input */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-[1.5rem] bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <DollarSign className="h-4.5 w-4.5 text-primary" />
              Thiết lập thu nhập hàng tháng (Chuẩn 50/30/20)
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Hệ thống hỗ trợ song song 2 nguồn thu nhập. Click chọn thẻ tương ứng để áp dụng phân
              bổ kế hoạch:
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            {/* Card 1: Thu nhập thực tế */}
            <div
              onClick={() => {
                setIncomeSource("actual");
                setDemoMode(false);
                saveSettings(incomeInput, "actual", false);
                toast.success("Đã áp dụng Thu nhập Thực tế vào phân bổ 50/30/20!");
              }}
              className={cn(
                "rounded-[1.35rem] border p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 relative overflow-hidden group select-none active:scale-[0.99] sm:hover:scale-[1.015]",
                incomeSource === "actual"
                  ? "border-success bg-success/5 ring-1 ring-success/20"
                  : "border-border/60 bg-muted/20 hover:border-success/40",
              )}
            >
              {incomeSource === "actual" && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-success" />
              )}

              <div>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-lg text-xs",
                      incomeSource === "actual"
                        ? "bg-success/20 text-success"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="font-display text-xs font-bold text-foreground">
                    1. Thu nhập Thực tế đã nhận
                  </span>
                </div>

                <div className="mt-4">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Tổng đã ghi nhận tháng này
                  </span>
                  <h3 className="font-display text-xl font-extrabold text-foreground mt-0.5">
                    {demoMode ? formatVND(22000000) : formatVND(classifiedRealData.actualIncome)}
                  </h3>
                </div>
              </div>

              <div className="mt-4 pt-2.5 border-t border-border/50 text-[10px] text-muted-foreground flex items-center justify-between">
                <span>{demoMode ? "Demo: Lương + Freelance" : "Từ các ví/tài khoản thực"}</span>
                <span
                  className={cn(
                    "font-bold text-[9px] px-2 py-0.5 rounded border uppercase tracking-wider",
                    incomeSource === "actual"
                      ? "bg-success text-success-foreground border-success"
                      : "bg-muted text-muted-foreground border-border/80 group-hover:text-success",
                  )}
                >
                  {incomeSource === "actual" ? "Đang dùng" : "Chọn dùng"}
                </span>
              </div>
            </div>

            {/* Card 2: Thu nhập dự kiến tự nhập */}
            <div
              onClick={() => {
                if (incomeSource !== "custom") {
                  setIncomeSource("custom");
                  saveSettings(incomeInput, "custom", demoMode);
                  toast.success("Đã áp dụng Thu nhập Dự kiến vào phân bổ 50/30/20!");
                }
              }}
              className={cn(
                "rounded-[1.35rem] border p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 relative overflow-hidden group select-none active:scale-[0.99] sm:hover:scale-[1.015]",
                incomeSource === "custom"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/60 bg-muted/20 hover:border-primary/40",
              )}
            >
              {incomeSource === "custom" && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
              )}

              <div>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-lg text-xs",
                      incomeSource === "custom"
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="font-display text-xs font-bold text-foreground">
                    2. Thu nhập Dự kiến tự thêm
                  </span>
                </div>

                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onBlur={handleInputBlur}
                      className="min-h-11 w-full rounded-xl border border-input bg-background pl-3 pr-10 py-2 outline-none focus:ring-2 focus:ring-ring/30 font-display font-bold text-sm"
                      placeholder="Ví dụ: 15tr, 33k..."
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                      VND
                    </span>
                  </div>
                  {parsedPreview && (
                    <span className="text-[10px] text-success font-semibold mt-1 block animate-pulse">
                      = {parsedPreview}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border/50 text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Ước tính theo nhu cầu</span>
                <span
                  className={cn(
                    "font-bold text-[9px] px-2 py-0.5 rounded border uppercase tracking-wider",
                    incomeSource === "custom"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border/80 group-hover:text-primary",
                  )}
                >
                  {incomeSource === "custom" ? "Đang dùng" : "Chọn dùng"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Highlight Stats Card */}
        <div className="rounded-[1.5rem] bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-soft)] flex flex-col justify-between text-card-foreground">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Chi tiêu an toàn còn lại</p>
              <h2 className="font-display text-2xl lg:text-3xl font-bold mt-1 tracking-tight">
                {remainingSafeToSpend >= 0 ? "+" : ""}
                {formatVND(remainingSafeToSpend)}
              </h2>
            </div>
            <span
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg text-xs font-bold",
                remainingSafeToSpend >= 0
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {remainingSafeToSpend >= 0 ? "OK" : "OVER"}
            </span>
          </div>

          <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Tổng Thu nhập ngân sách:</span>
              <span className="font-semibold">{formatVND(activeIncome)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Đã dùng (Thiết yếu + Mong muốn):</span>
              <span className="font-semibold">{formatVND(totalSpent)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Grid Row 2: Charts */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recharts Pie Chart comparing Target vs Actual */}
        <div className="rounded-[1.5rem] bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5 lg:col-span-3">
          <h3 className="font-display text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4.5 w-4.5 text-primary" />
            Cơ cấu ngân sách 50/30/20
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            So sánh tỷ lệ phân bổ Mục tiêu đề xuất với Chi tiêu Thực tế của bạn trong tháng này.
          </p>

          <div className="mt-5 grid min-h-[30rem] grid-cols-1 gap-5 sm:min-h-[18rem] md:grid-cols-2">
            {/* Target Pie Chart */}
            <div className="relative flex min-h-56 flex-col items-center justify-center rounded-2xl bg-muted/30 p-3">
              <span className="absolute top-2 text-xs font-semibold text-muted-foreground bg-muted/65 px-2 py-0.5 rounded-full">
                MỤC TIÊU PHÂN BỔ
              </span>
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie
                    data={targetChartData}
                    cx="50%"
                    cy="55%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {targetChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatVND(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 text-[10px] font-semibold">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Thiết yếu 50%
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-warning" />
                  Mong muốn 30%
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  Tiết kiệm 20%
                </span>
              </div>
            </div>

            {/* Actual Pie Chart */}
            <div className="relative flex min-h-56 flex-col items-center justify-center rounded-2xl bg-muted/30 p-3">
              <span className="absolute top-2 text-xs font-semibold text-muted-foreground bg-muted/65 px-2 py-0.5 rounded-full">
                CHI TIÊU THỰC TẾ
              </span>
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie
                    data={actualChartData}
                    cx="50%"
                    cy="55%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {actualChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatVND(v)} />
                </PieChart>
              </ResponsiveContainer>
              {activeData.needsTotal + activeData.wantsTotal + activeData.savingsTotal === 0 ? (
                <div className="text-[10px] text-muted-foreground font-semibold">
                  Chưa phát sinh giao dịch
                </div>
              ) : (
                <div className="flex gap-4 text-[10px] font-semibold">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    Thiết yếu
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-warning" />
                    Mong muốn
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    Tiết kiệm
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Groups Details Dashboard */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold">
            Phân tích chi tiết 3 nhóm chi tiêu
          </h3>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground font-medium">Đang liên kết nguồn:</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border transition-all duration-300",
                incomeSource === "actual"
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-primary/10 text-primary border-primary/20",
              )}
            >
              {incomeSource === "actual" ? "1. Thực tế" : "2. Dự kiến"} ({formatVND(activeIncome)})
            </span>
          </div>
        </div>

        {!demoMode && activeData.unclassifiedTotal > 0 && (
          <div className="rounded-2xl bg-warning/10 px-4 py-3 text-xs font-medium text-warning-foreground">
            {formatVND(activeData.unclassifiedTotal)} chưa được đưa vào 3 nhóm vì giao dịch chưa có
            danh mục rõ ràng hoặc không thuộc chi tiêu thường xuyên.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3 lg:gap-6">
          {/* NEEDS CARD */}
          <div className="rounded-[1.5rem] bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  <Home className="h-3.5 w-3.5" /> Thiết yếu (50%)
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold text-right">
                  Hạn mức: {formatVND(targetNeeds)}
                  <span className="block text-[8px] opacity-75 font-normal">
                    (50% của {formatVND(activeIncome)})
                  </span>
                </span>
              </div>

              {/* Major Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>Đã chi tiêu</span>
                  <span
                    className={cn(
                      activeData.needsTotal > targetNeeds ? "text-destructive" : "text-primary",
                    )}
                  >
                    {((activeData.needsTotal / targetNeeds) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      activeData.needsTotal > targetNeeds ? "bg-destructive" : "bg-primary",
                    )}
                    style={{
                      width: `${Math.min((activeData.needsTotal / targetNeeds) * 100, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>{formatVND(activeData.needsTotal)}</span>
                  <span>
                    {remainingNeeds >= 0
                      ? `Còn lại: ${formatVND(remainingNeeds)}`
                      : `Vượt: ${formatVND(Math.abs(remainingNeeds))}`}
                  </span>
                </div>
              </div>

              {/* Sub-category list */}
              <div className="mt-6 space-y-3.5 border-t border-border/60 pt-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Danh mục cụ thể:
                </h4>

                <div className="space-y-2.5">
                  <SubcategoryProgressItem
                    icon={<Utensils className="h-3.5 w-3.5" />}
                    name="Ăn uống"
                    spent={activeData.details["Ăn uống"]}
                    suggestedLimit={targetNeeds * 0.4}
                  />
                  <SubcategoryProgressItem
                    icon={<Home className="h-3.5 w-3.5" />}
                    name="Nhà ở"
                    spent={activeData.details["Nhà ở"]}
                    suggestedLimit={targetNeeds * 0.35}
                  />
                  <SubcategoryProgressItem
                    icon={<Car className="h-3.5 w-3.5" />}
                    name="Đi lại"
                    spent={activeData.details["Đi lại"]}
                    suggestedLimit={targetNeeds * 0.1}
                  />
                  <SubcategoryProgressItem
                    icon={<FileText className="h-3.5 w-3.5" />}
                    name="Hóa đơn"
                    spent={activeData.details["Hoá đơn"]}
                    suggestedLimit={targetNeeds * 0.15}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* WANTS CARD */}
          <div className="rounded-[1.5rem] bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 text-warning-foreground text-xs font-semibold">
                  <Coffee className="h-3.5 w-3.5" /> Mong muốn (30%)
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold text-right">
                  Hạn mức: {formatVND(targetWants)}
                  <span className="block text-[8px] opacity-75 font-normal">
                    (30% của {formatVND(activeIncome)})
                  </span>
                </span>
              </div>

              {/* Major Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>Đã chi tiêu</span>
                  <span
                    className={cn(
                      activeData.wantsTotal > targetWants
                        ? "text-destructive"
                        : "text-warning-foreground",
                    )}
                  >
                    {((activeData.wantsTotal / targetWants) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      activeData.wantsTotal > targetWants ? "bg-destructive" : "bg-warning",
                    )}
                    style={{
                      width: `${Math.min((activeData.wantsTotal / targetWants) * 100, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>{formatVND(activeData.wantsTotal)}</span>
                  <span>
                    {remainingWants >= 0
                      ? `Còn lại: ${formatVND(remainingWants)}`
                      : `Vượt: ${formatVND(Math.abs(remainingWants))}`}
                  </span>
                </div>
              </div>

              {/* Sub-category list */}
              <div className="mt-6 space-y-3.5 border-t border-border/60 pt-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Danh mục cụ thể:
                </h4>

                <div className="space-y-2.5">
                  <SubcategoryProgressItem
                    icon={<Coffee className="h-3.5 w-3.5" />}
                    name="Cafe & Đồ uống"
                    spent={activeData.details["Cafe"]}
                    suggestedLimit={targetWants * 0.15}
                  />
                  <SubcategoryProgressItem
                    icon={<ShoppingBag className="h-3.5 w-3.5" />}
                    name="Mua sắm"
                    spent={activeData.details["Mua sắm"]}
                    suggestedLimit={targetWants * 0.4}
                  />
                  <SubcategoryProgressItem
                    icon={<Tv className="h-3.5 w-3.5" />}
                    name="Giải trí"
                    spent={activeData.details["Giải trí"]}
                    suggestedLimit={targetWants * 0.2}
                  />
                  <SubcategoryProgressItem
                    icon={<Plane className="h-3.5 w-3.5" />}
                    name="Du lịch"
                    spent={activeData.details["Du lịch"]}
                    suggestedLimit={targetWants * 0.25}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SAVINGS CARD */}
          <div className="rounded-[1.5rem] bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-semibold">
                  <PiggyBank className="h-3.5 w-3.5" /> Tích lũy (20%)
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold text-right">
                  Mục tiêu: {formatVND(targetSavings)}
                  <span className="block text-[8px] opacity-75 font-normal">
                    (20% của {formatVND(activeIncome)})
                  </span>
                </span>
              </div>

              {/* Major Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>Đã tích lũy</span>
                  <span className="text-success">
                    {((activeData.savingsTotal / targetSavings) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-success"
                    style={{
                      width: `${Math.min((activeData.savingsTotal / targetSavings) * 100, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>{formatVND(activeData.savingsTotal)}</span>
                  <span>
                    {activeData.savingsTotal >= targetSavings
                      ? "Đạt mục tiêu 🎉"
                      : `Còn thiếu: ${formatVND(targetSavings - activeData.savingsTotal)}`}
                  </span>
                </div>
              </div>

              {/* Sub-category list */}
              <div className="mt-6 space-y-3.5 border-t border-border/60 pt-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Danh mục cụ thể:
                </h4>

                <div className="space-y-2.5">
                  <SubcategoryProgressItem
                    icon={<ShieldAlert className="h-3.5 w-3.5" />}
                    name="Quỹ khẩn cấp"
                    spent={activeData.details["Quỹ dự phòng"]}
                    suggestedLimit={targetSavings * 0.4}
                  />
                  <SubcategoryProgressItem
                    icon={<PiggyBank className="h-3.5 w-3.5" />}
                    name="Tiết kiệm"
                    spent={activeData.details["Tiết kiệm"]}
                    suggestedLimit={targetSavings * 0.3}
                  />
                  <SubcategoryProgressItem
                    icon={<TrendingUp className="h-3.5 w-3.5" />}
                    name="Đầu tư sinh lời"
                    spent={activeData.details["Đầu tư"]}
                    suggestedLimit={targetSavings * 0.3}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// HELPER CONTAINER: Subcategory Item Component
// ----------------------------------------------------
function SubcategoryProgressItem({
  icon,
  name,
  spent,
  suggestedLimit,
}: {
  icon: React.ReactNode;
  name: string;
  spent: number;
  suggestedLimit: number;
}) {
  const pct = Math.min((spent / suggestedLimit) * 100, 100);
  const isOver = spent > suggestedLimit;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground truncate">
          <span className="opacity-80 text-foreground">{icon}</span>
          <span className="truncate">{name}</span>
        </span>
        <span className="font-semibold flex-shrink-0">
          {formatVND(spent)}
          <span className="text-[10px] text-muted-foreground font-normal ml-1">
            / {formatVND(suggestedLimit)}
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isOver ? "bg-destructive" : "bg-foreground/20",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
