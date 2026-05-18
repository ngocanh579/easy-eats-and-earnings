import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
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
  GraduationCap,
  Calendar,
  Calculator,
  Compass,
  ArrowRight,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
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
  { note: "Mua thức ăn tuần 1", category_name: "Ăn uống", kind: "expense", amount: 850000, occurred_at: "2026-05-02" },
  { note: "Ăn trưa văn phòng", category_name: "Ăn uống", kind: "expense", amount: 150000, occurred_at: "2026-05-05" },
  { note: "Đi chợ siêu thị Co.opmart", category_name: "Ăn uống", kind: "expense", amount: 1200000, occurred_at: "2026-05-10" },
  { note: "Ăn tối cùng gia đình", category_name: "Ăn uống", kind: "expense", amount: 650000, occurred_at: "2026-05-12" },
  // Nhà ở
  { note: "Tiền thuê nhà tháng 5", category_name: "Nhà ở", kind: "expense", amount: 4800000, occurred_at: "2026-05-01" },
  { note: "Sửa vòi nước bồn tắm", category_name: "Nhà ở", kind: "expense", amount: 200000, occurred_at: "2026-05-08" },
  // Đi lại
  { note: "Đổ xăng xe máy", category_name: "Đi lại", kind: "expense", amount: 90000, occurred_at: "2026-05-03" },
  { note: "Đặt Grab đi công tác", category_name: "Đi lại", kind: "expense", amount: 180000, occurred_at: "2026-05-07" },
  { note: "Vé xe buýt tháng", category_name: "Đi lại", kind: "expense", amount: 100000, occurred_at: "2026-05-09" },
  // Hóa đơn
  { note: "Tiền điện sinh hoạt", category_name: "Hoá đơn", kind: "expense", amount: 1150000, occurred_at: "2026-05-05" },
  { note: "Tiền nước", category_name: "Hoá đơn", kind: "expense", amount: 120000, occurred_at: "2026-05-05" },
  { note: "Cước Internet cáp quang", category_name: "Hoá đơn", kind: "expense", amount: 250000, occurred_at: "2026-05-06" },

  // --- Wants (Mong muốn - Target: 6,600,000) ---
  // Cafe
  { note: "Họp nhóm Highland Coffee", category_name: "Cafe", kind: "expense", amount: 120000, occurred_at: "2026-05-03" },
  { note: "Cà phê sữa đá sáng", category_name: "Cafe", kind: "expense", amount: 450000, occurred_at: "2026-05-15" }, // Tổng nhiều lần
  // Mua sắm
  { note: "Mua áo thun Polo", category_name: "Mua sắm", kind: "expense", amount: 350000, occurred_at: "2026-05-04" },
  { note: "Giày Sneaker Adidas", category_name: "Mua sắm", kind: "expense", amount: 2200000, occurred_at: "2026-05-11" },
  { note: "Mỹ phẩm skincare", category_name: "Mua sắm", kind: "expense", amount: 950000, occurred_at: "2026-05-14" },
  // Giải trí
  { note: "Vé xem phim CGV & Bắp nước", category_name: "Giải trí", kind: "expense", amount: 260000, occurred_at: "2026-05-09" },
  { note: "Đăng ký Spotify Premium", category_name: "Giải trí", kind: "expense", amount: 59000, occurred_at: "2026-05-10" },
  { note: "Nạp thẻ game giải trí", category_name: "Giải trí", kind: "expense", amount: 200000, occurred_at: "2026-05-13" },
  // Du lịch
  { note: "Vé máy bay đi Đà Nẵng hè", category_name: "Du lịch", kind: "expense", amount: 2300000, occurred_at: "2026-05-12" },
  { note: "Đặt phòng Homestay Đà Nẵng", category_name: "Du lịch", kind: "expense", amount: 1200000, occurred_at: "2026-05-13" },

  // --- Savings (Tiết kiệm - Target: 4,400,000) ---
  // Quỹ dự phòng
  { note: "Trích quỹ khẩn cấp định kỳ", category_name: "Quỹ dự phòng", kind: "savings", amount: 2000000, occurred_at: "2026-05-02" },
  // Tiết kiệm
  { note: "Gửi tiết kiệm tích luỹ app ngân hàng", category_name: "Tiết kiệm", kind: "savings", amount: 1500000, occurred_at: "2026-05-05" },
  // Đầu tư
  { note: "Mua chứng chỉ quỹ VinaCapital", category_name: "Đầu tư", kind: "savings", amount: 1000000, occurred_at: "2026-05-10" },
];

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
      })
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
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("created_at");
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
      "Cafe": 0,
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
        } else if (name.includes("đầu tư") || name.includes("chứng khoán") || name.includes("invest")) {
          details["Đầu tư"] += amt;
        } else {
          details["Tiết kiệm"] += amt;
        }
        continue;
      }

      // Find category details for expenses/debts
      const cat = realCats.find((c) => c.id === t.category_id);
      if (!cat) {
        // Fallback: uncategorized expenses go to wants
        wantsTotal += amt;
        details["Chi phí Khác"] += amt;
        continue;
      }

      const catName = cat.name;
      const lowerName = catName.toLowerCase();

      // smart checks
      const needsRegex = /ăn uống|đi lại|nhà ở|hoá đơn|hóa đơn|điện|nước|internet|cước|gas|thuê nhà|phòng|xăng|học phí|y tế|sức khoẻ|sức khỏe|thuốc/i;
      const wantsRegex = /cafe|cà phê|mua sắm|giải trí|du lịch|xem phim|mua đồ|spa|làm đẹp|chơi game|quần áo|giày|mỹ phẩm|tiệc tùng|nhậu/i;
      const savingsRegex = /tiết kiệm|đầu tư|quỹ khẩn cấp|dự phòng|tích luỹ|heo đất|chứng khoán|vàng|bảo hiểm/i;

      if (needsRegex.test(lowerName)) {
        needsTotal += amt;
        if (lowerName.includes("ăn") || lowerName.includes("food")) details["Ăn uống"] += amt;
        else if (lowerName.includes("ở") || lowerName.includes("thuê") || lowerName.includes("nhà") || lowerName.includes("rent")) details["Nhà ở"] += amt;
        else if (lowerName.includes("đi") || lowerName.includes("xăng") || lowerName.includes("grab") || lowerName.includes("bus") || lowerName.includes("traffic")) details["Đi lại"] += amt;
        else details["Hoá đơn"] += amt;
      } else if (wantsRegex.test(lowerName)) {
        wantsTotal += amt;
        if (lowerName.includes("cafe") || lowerName.includes("cà phê") || lowerName.includes("coffee")) details["Cafe"] += amt;
        else if (lowerName.includes("sắm") || lowerName.includes("đồ") || lowerName.includes("quần") || lowerName.includes("shopping")) details["Mua sắm"] += amt;
        else if (lowerName.includes("trí") || lowerName.includes("phim") || lowerName.includes("game") || lowerName.includes("spotify")) details["Giải trí"] += amt;
        else details["Du lịch"] += amt;
      } else if (savingsRegex.test(lowerName) || cat.kind === "savings") {
        savingsTotal += amt;
        if (lowerName.includes("dự phòng") || lowerName.includes("khẩn cấp") || lowerName.includes("emergency")) details["Quỹ dự phòng"] += amt;
        else if (lowerName.includes("đầu tư") || lowerName.includes("chứng") || lowerName.includes("invest")) details["Đầu tư"] += amt;
        else details["Tiết kiệm"] += amt;
      } else {
        // Fallback for expenses is Wants
        wantsTotal += amt;
        details["Chi phí Khác"] += amt;
      }
    }

    return {
      actualIncome: incomeSum,
      needsTotal,
      wantsTotal,
      savingsTotal,
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
      return classifiedRealData.actualIncome || 0;
    }
    return parseFloat(incomeInput) || 22000000;
  }, [demoMode, incomeSource, incomeInput, classifiedRealData.actualIncome]);

  const activeData = useMemo(() => {
    if (demoMode) {
      const details = {
        "Ăn uống": 0, "Nhà ở": 0, "Đi lại": 0, "Hoá đơn": 0,
        "Cafe": 0, "Mua sắm": 0, "Giải trí": 0, "Du lịch": 0, "Chi phí Khác": 0,
        "Quỹ dự phòng": 0, "Tiết kiệm": 0, "Đầu tư": 0,
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
        details,
      };
    }

    return {
      needsTotal: classifiedRealData.needsTotal,
      wantsTotal: classifiedRealData.wantsTotal,
      savingsTotal: classifiedRealData.savingsTotal,
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
      return [
        { name: "Chưa chi tiêu", value: 1, color: "var(--color-muted)" }
      ];
    }
    return [
      { name: "Thiết yếu", value: activeData.needsTotal, color: "var(--color-primary)" },
      { name: "Mong muốn", value: activeData.wantsTotal, color: "var(--color-warning)" },
      { name: "Tiết kiệm", value: activeData.savingsTotal, color: "var(--color-success)" },
    ];
  }, [activeData]);

  // ----------------------------------------------------
  // FORECASTING & WARNING GENERATOR
  // ----------------------------------------------------
  const forecasts = useMemo(() => {
    const list: { type: "danger" | "warning" | "info" | "success"; text: string; subText?: string }[] = [];

    // Daily velocities
    const dailyNeedsVel = activeData.needsTotal / currentDay;
    const dailyWantsVel = activeData.wantsTotal / currentDay;
    const dailyExpensesVel = (activeData.needsTotal + activeData.wantsTotal) / currentDay;
    
    // Projected end of month amounts
    const projectedNeeds = dailyNeedsVel * daysInMonth;
    const projectedWants = dailyWantsVel * daysInMonth;
    const projectedExpenses = dailyExpensesVel * daysInMonth;
    const projectedSavings = activeData.savingsTotal; // Savings doesn't necessarily scale linearly but let's assume current saved is what we have

    // 1. Food specific check (Ăn uống)
    const foodSpent = activeData.details["Ăn uống"];
    const suggestedFoodLimit = targetNeeds * 0.4; // Suggest 40% of Needs is for Food
    const dailyFoodVel = foodSpent / currentDay;
    const projectedFood = dailyFoodVel * daysInMonth;
    if (projectedFood > suggestedFoodLimit * 1.15) {
      const overPct = Math.round(((projectedFood - suggestedFoodLimit) / suggestedFoodLimit) * 100);
      list.push({
        type: "warning",
        text: `Bạn đang chi tiêu Ăn uống cao hơn mức đề xuất hợp lý ${overPct}%`,
        subText: `Dự kiến cả tháng chi ${formatVND(projectedFood)} (Hạn mức đề xuất cho ăn uống là ${formatVND(suggestedFoodLimit)}).`,
      });
    }

    // 2. Budget deficit warning (Âm tiền cuối tháng)
    if (projectedExpenses > activeIncome) {
      const deficit = projectedExpenses - activeIncome;
      list.push({
        type: "danger",
        text: `Nếu tiếp tục chi tiêu hiện tại, cuối tháng bạn có thể âm ${formatVND(deficit)}!`,
        subText: `Tổng dự kiến chi tiêu (${formatVND(projectedExpenses)}) đang vượt tổng thu nhập (${formatVND(activeIncome)}).`,
      });
    }

    // 3. Savings deficit warning (Thiếu hụt tiết kiệm)
    if (activeData.savingsTotal < targetSavings) {
      const missing = targetSavings - activeData.savingsTotal;
      list.push({
        type: "info",
        text: `Bạn còn thiếu ${formatVND(missing)} để đạt mục tiêu tiết kiệm tối thiểu 20%`,
        subText: `Hiện tại đã trích lũy ${formatVND(activeData.savingsTotal)} trên tổng mục tiêu ${formatVND(targetSavings)}.`,
      });
    } else {
      list.push({
        type: "success",
        text: `Xuất sắc! Bạn đã hoàn thành 100% mục tiêu tiết kiệm tích lũy 20% cho tháng này!`,
        subText: `Đã gửi tích lũy và đầu tư ${formatVND(activeData.savingsTotal)} (Mục tiêu tối thiểu ${formatVND(targetSavings)}).`,
      });
    }

    return list;
  }, [activeData, activeIncome, currentDay, daysInMonth, targetNeeds, targetSavings]);

  // ----------------------------------------------------
  // SMART FINANCIAL ADVICE ENGINE
  // ----------------------------------------------------
  const smartSuggestions = useMemo(() => {
    const list: string[] = [];

    // Rule 1: Low Income advice
    if (activeIncome < 8000000) {
      list.push("Thu nhập của bạn đang ở mức cơ bản (< 8 triệu). Hãy tạm thời hoãn các khoản chi tiêu cho 'Mong muốn' (Wants) xuống dưới 15% để ưu tiên tối đa xây dựng 'Quỹ khẩn cấp' (Emergency Fund) 3 tháng chi tiêu trước.");
    } else if (activeIncome >= 25000000) {
      list.push("Thu nhập của bạn ở mức tốt (> 25 triệu). Ngoài việc đảm bảo 20% tiết kiệm thông thường, bạn nên cân nhắc trích thêm 5-10% từ nhóm Mong muốn để đẩy mạnh các kênh đầu tư dài hạn như Chứng chỉ quỹ hoặc Cổ phiếu tích sản.");
    }

    // Rule 2: Overspending in Wants
    const wantsPct = (activeData.wantsTotal / activeIncome) * 100;
    if (wantsPct > 35) {
      list.push(`Tỷ trọng chi tiêu 'Mong muốn' của bạn đang khá cao (${wantsPct.toFixed(1)}% so với đề xuất 30%). Hãy thực hiện thử thách '3 ngày không mua sắm tự do' hoặc chuyển sang pha cà phê tại nhà thay vì ngồi quán ngoại tuần tới.`);
    }

    // Rule 3: High rent / Housing
    const rentSpent = activeData.details["Nhà ở"];
    const rentPct = (rentSpent / activeIncome) * 100;
    if (rentPct > 25) {
      list.push(`Chi phí Nhà ở (Thuê nhà, dịch vụ) đang chiếm tới ${rentPct.toFixed(1)}% thu nhập của bạn. Theo chuyên gia, mức an toàn tối đa cho nhà ở là 20-25%. Bạn nên tìm cách chia sẻ tiền phòng hoặc tìm giải pháp tiết kiệm điện nước để giảm bớt gánh nặng.`);
    }

    // Rule 4: General positive nudge
    if (activeData.needsTotal <= targetNeeds && activeData.wantsTotal <= targetWants && activeData.savingsTotal >= targetSavings) {
      list.push("Chúc mừng bạn! Mọi chỉ số phân bổ tài chính của bạn đang cực kỳ lý tưởng theo chuẩn 50/30/20. Đây là thói quen của các nhà quản lý tài chính thông minh xuất sắc.");
    } else {
      list.push("Hãy áp dụng nguyên tắc: 'Pay yourself first' - Trích ngay lập tức 20% thu nhập để gửi tiết kiệm/đầu tư ngay khi nhận lương, phần còn lại mới chia vào các ví chi tiêu hàng ngày.");
    }

    return list;
  }, [activeIncome, activeData, targetNeeds, targetWants, targetSavings]);

  // ----------------------------------------------------
  // PERSONALIZED AUTO MONTH RECOMMENDATIONS
  // ----------------------------------------------------
  const nextMonthRecommendation = useMemo(() => {
    // If we have actual spending, we nudge them slowly
    const currentNeedsPct = (activeData.needsTotal / activeIncome) * 100;
    const currentWantsPct = (activeData.wantsTotal / activeIncome) * 100;
    const currentSavingsPct = (activeData.savingsTotal / activeIncome) * 100;

    let suggestedNeedsPct = 50;
    let suggestedWantsPct = 30;
    let suggestedSavingsPct = 20;

    // Nudging formula: if Needs is 60%, suggest 55% for next month
    if (currentNeedsPct > 55) {
      suggestedNeedsPct = Math.round(currentNeedsPct - 5);
      suggestedWantsPct = 30;
      suggestedSavingsPct = 100 - suggestedNeedsPct - suggestedWantsPct;
    } else if (currentWantsPct > 35) {
      suggestedWantsPct = Math.round(currentWantsPct - 5);
      suggestedNeedsPct = 50;
      suggestedSavingsPct = 100 - suggestedNeedsPct - suggestedWantsPct;
    }

    return {
      needs: { pct: suggestedNeedsPct, amt: activeIncome * (suggestedNeedsPct / 100) },
      wants: { pct: suggestedWantsPct, amt: activeIncome * (suggestedWantsPct / 100) },
      savings: { pct: suggestedSavingsPct, amt: activeIncome * (suggestedSavingsPct / 100) },
      hasDeviated: currentNeedsPct > 55 || currentWantsPct > 35,
    };
  }, [activeData, activeIncome]);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header section with Premium design */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
              <Sparkles className="h-4.5 w-4.5 animate-pulse" />
            </div>
            <h1 className="font-display text-2xl font-semibold lg:text-3xl">
              Kế hoạch chi tiêu 50/30/20
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Tự động tối ưu tài chính cá nhân thông minh và dự báo chi tiêu tháng tiếp theo.
          </p>
        </div>

        {/* Demo switches */}
        <div className="flex flex-wrap items-center gap-3 bg-muted/40 p-1.5 rounded-xl border border-border/60 self-start md:self-center">
          <button
            onClick={handleDemoModeToggle}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
              demoMode
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Compass className="h-3.5 w-3.5" />
            Dữ liệu mẫu (Demo)
          </button>
        </div>
      </div>

      {/* Control panel for Income Input */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] flex flex-col justify-between">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <DollarSign className="h-4.5 w-4.5 text-primary" />
              Thiết lập thu nhập hàng tháng (Chuẩn 50/30/20)
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Hệ thống hỗ trợ song song 2 nguồn thu nhập. Click chọn thẻ tương ứng để áp dụng phân bổ kế hoạch:
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            {/* Card 1: Thu nhập thực tế */}
            <div 
              onClick={() => {
                setIncomeSource("actual");
                saveSettings(incomeInput, "actual", demoMode);
                toast.success("Đã áp dụng Thu nhập Thực tế vào phân bổ 50/30/20!");
              }}
              className={cn(
                "rounded-2xl border p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 relative overflow-hidden group select-none hover:scale-[1.015]",
                incomeSource === "actual" 
                  ? "border-success bg-success/5 ring-1 ring-success/20" 
                  : "border-border/60 bg-muted/20 hover:border-success/40"
              )}
            >
              {incomeSource === "actual" && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-success" />
              )}
              
              <div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "grid h-7 w-7 place-items-center rounded-lg text-xs",
                    incomeSource === "actual" ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                  )}>
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
                <span>
                  {demoMode ? "Demo: Lương + Freelance" : "Từ các ví/tài khoản thực"}
                </span>
                <span className={cn(
                  "font-bold text-[9px] px-2 py-0.5 rounded border uppercase tracking-wider",
                  incomeSource === "actual" 
                    ? "bg-success text-success-foreground border-success" 
                    : "bg-muted text-muted-foreground border-border/80 group-hover:text-success"
                )}>
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
                "rounded-2xl border p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 relative overflow-hidden group select-none hover:scale-[1.015]",
                incomeSource === "custom" 
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                  : "border-border/60 bg-muted/20 hover:border-primary/40"
              )}
            >
              {incomeSource === "custom" && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
              )}

              <div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "grid h-7 w-7 place-items-center rounded-lg text-xs",
                    incomeSource === "custom" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
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
                      className="w-full rounded-lg border border-input bg-background pl-2.5 pr-8 py-1.5 outline-none focus:ring-1 focus:ring-ring font-display font-bold text-sm"
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
                <span className={cn(
                  "font-bold text-[9px] px-2 py-0.5 rounded border uppercase tracking-wider",
                  incomeSource === "custom" 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-muted text-muted-foreground border-border/80 group-hover:text-primary"
                )}>
                  {incomeSource === "custom" ? "Đang dùng" : "Chọn dùng"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Highlight Stats Card */}
        <div className="rounded-2xl border border-border bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-soft)] flex flex-col justify-between text-card-foreground">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Chi tiêu an toàn còn lại</p>
              <h2 className="font-display text-2xl lg:text-3xl font-bold mt-1 tracking-tight">
                {remainingSafeToSpend >= 0 ? "+" : ""}
                {formatVND(remainingSafeToSpend)}
              </h2>
            </div>
            <span className={cn(
              "grid h-8 w-8 place-items-center rounded-lg text-xs font-bold",
              remainingSafeToSpend >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}>
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

      {/* Bento Grid Row 2: Charts and Suggestions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recharts Pie Chart comparing Target vs Actual */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] lg:col-span-2">
          <h3 className="font-display text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4.5 w-4.5 text-primary" />
            Cơ cấu ngân sách 50/30/20
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            So sánh tỷ lệ phân bổ Mục tiêu đề xuất với Chi tiêu Thực tế của bạn trong tháng này.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 h-60">
            {/* Target Pie Chart */}
            <div className="flex flex-col items-center justify-center relative">
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
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />Thiết yếu 50%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" />Mong muốn 30%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" />Tiết kiệm 20%</span>
              </div>
            </div>

            {/* Actual Pie Chart */}
            <div className="flex flex-col items-center justify-center relative">
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
                <div className="text-[10px] text-muted-foreground font-semibold">Chưa phát sinh giao dịch</div>
              ) : (
                <div className="flex gap-4 text-[10px] font-semibold">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />Thiết yếu</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" />Mong muốn</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" />Tiết kiệm</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Smart Suggestions Panel */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] flex flex-col justify-between">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-warning" />
              Gợi ý Thông minh
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lời khuyên tài chính cá nhân hóa từ hệ thống phân tích thói quen.
            </p>

            <ul className="mt-4 space-y-3.5">
              {smartSuggestions.map((advice, i) => (
                <li key={i} className="flex gap-3 text-xs text-muted-foreground leading-relaxed align-top">
                  <span className="mt-0.5 text-warning flex-shrink-0">
                    <Info className="h-4 w-4" />
                  </span>
                  <span>{advice}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 border-t border-border/60 pt-3">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Nguyên tắc cốt lõi:</span>
            <p className="text-[11px] text-muted-foreground mt-1">
              "Hãy tiết kiệm trước khi chi tiêu, chứ không phải chi tiêu rồi mới tiết kiệm phần còn lại."
            </p>
          </div>
        </div>
      </div>

      {/* Forecasting Alerts Panel (Dự đoán và cảnh báo) */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-destructive" />
              Dự báo tài chính cuối tháng & Cảnh báo sớm
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hệ thống dựa trên thói quen hiện tại để dự phóng ngân sách cuối tháng.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-lg flex items-center gap-1">
            Ngày trôi qua: {currentDay}/{daysInMonth}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {forecasts.map((fc, i) => {
            const tone = {
              danger: "bg-destructive/10 text-destructive border-destructive/20",
              warning: "bg-warning/10 text-warning-foreground border-warning/20",
              info: "bg-primary/10 text-primary border-primary/20",
              success: "bg-success/10 text-success border-success/20",
            }[fc.type];

            const icon = {
              danger: <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />,
              warning: <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />,
              info: <Info className="h-5 w-5 text-primary flex-shrink-0" />,
              success: <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />,
            }[fc.type];

            return (
              <div
                key={i}
                className={cn(
                  "rounded-xl border p-4 flex gap-3 transition-all duration-200 hover:scale-[1.01]",
                  tone
                )}
              >
                {icon}
                <div className="min-w-0">
                  <h4 className="text-xs font-bold leading-tight truncate-2-lines">{fc.text}</h4>
                  {fc.subText && <p className="text-[10px] opacity-80 mt-1 font-medium leading-relaxed">{fc.subText}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Groups Details Dashboard */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2">
          <h3 className="font-display text-base font-semibold">Phân tích chi tiết 3 nhóm chi tiêu</h3>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground font-medium">Đang liên kết nguồn:</span>
            <span className={cn(
              "px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border transition-all duration-300",
              incomeSource === "actual" 
                ? "bg-success/10 text-success border-success/20" 
                : "bg-primary/10 text-primary border-primary/20"
            )}>
              {incomeSource === "actual" ? "1. Thực tế" : "2. Dự kiến"} ({formatVND(activeIncome)})
            </span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* NEEDS CARD */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] flex flex-col justify-between">
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
                  <span className={cn(
                    activeData.needsTotal > targetNeeds ? "text-destructive" : "text-primary"
                  )}>
                    {((activeData.needsTotal / targetNeeds) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      activeData.needsTotal > targetNeeds ? "bg-destructive" : "bg-primary"
                    )}
                    style={{ width: `${Math.min((activeData.needsTotal / targetNeeds) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>{formatVND(activeData.needsTotal)}</span>
                  <span>
                    {remainingNeeds >= 0 ? `Còn lại: ${formatVND(remainingNeeds)}` : `Vượt: ${formatVND(Math.abs(remainingNeeds))}`}
                  </span>
                </div>
              </div>

              {/* Sub-category list */}
              <div className="mt-6 space-y-3.5 border-t border-border/60 pt-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Danh mục cụ thể:</h4>
                
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
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] flex flex-col justify-between">
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
                  <span className={cn(
                    activeData.wantsTotal > targetWants ? "text-destructive" : "text-warning-foreground"
                  )}>
                    {((activeData.wantsTotal / targetWants) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      activeData.wantsTotal > targetWants ? "bg-destructive" : "bg-warning"
                    )}
                    style={{ width: `${Math.min((activeData.wantsTotal / targetWants) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>{formatVND(activeData.wantsTotal)}</span>
                  <span>
                    {remainingWants >= 0 ? `Còn lại: ${formatVND(remainingWants)}` : `Vượt: ${formatVND(Math.abs(remainingWants))}`}
                  </span>
                </div>
              </div>

              {/* Sub-category list */}
              <div className="mt-6 space-y-3.5 border-t border-border/60 pt-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Danh mục cụ thể:</h4>
                
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
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] flex flex-col justify-between">
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
                    style={{ width: `${Math.min((activeData.savingsTotal / targetSavings) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>{formatVND(activeData.savingsTotal)}</span>
                  <span>
                    {activeData.savingsTotal >= targetSavings ? "Đạt mục tiêu 🎉" : `Còn thiếu: ${formatVND(targetSavings - activeData.savingsTotal)}`}
                  </span>
                </div>
              </div>

              {/* Sub-category list */}
              <div className="mt-6 space-y-3.5 border-t border-border/60 pt-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Danh mục cụ thể:</h4>
                
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

      {/* Personalized Next Month Recommendations */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <h3 className="font-display text-base font-semibold flex items-center gap-2">
          <Compass className="h-4.5 w-4.5 text-primary" />
          Đề xuất ngân sách tháng sau tự động
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tối ưu hạn mức cho các nhóm dựa trên thói quen và phản hồi thực tế.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {/* Rec 1 */}
          <div className="rounded-xl border border-border p-4 bg-muted/20">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Nhu cầu thiết yếu</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-display text-xl font-bold text-primary">{nextMonthRecommendation.needs.pct}%</span>
              <span className="text-xs text-muted-foreground">thu nhập</span>
            </div>
            <p className="text-xs font-semibold text-foreground mt-1.5">
              Hạn mức đề xuất: {formatVND(nextMonthRecommendation.needs.amt)}
            </p>
          </div>

          {/* Rec 2 */}
          <div className="rounded-xl border border-border p-4 bg-muted/20">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Mong muốn cá nhân</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-display text-xl font-bold text-warning-foreground">{nextMonthRecommendation.wants.pct}%</span>
              <span className="text-xs text-muted-foreground">thu nhập</span>
            </div>
            <p className="text-xs font-semibold text-foreground mt-1.5">
              Hạn mức đề xuất: {formatVND(nextMonthRecommendation.wants.amt)}
            </p>
          </div>

          {/* Rec 3 */}
          <div className="rounded-xl border border-border p-4 bg-muted/20">
            <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Tiết kiệm tích lũy</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-display text-xl font-bold text-success">{nextMonthRecommendation.savings.pct}%</span>
              <span className="text-xs text-muted-foreground">thu nhập</span>
            </div>
            <p className="text-xs font-semibold text-foreground mt-1.5">
              Hạn mức đề xuất: {formatVND(nextMonthRecommendation.savings.amt)}
            </p>
          </div>
        </div>

        {nextMonthRecommendation.hasDeviated && (
          <div className="mt-4 flex gap-2.5 items-start bg-primary/5 p-3.5 rounded-xl border border-primary/10">
            <Sparkles className="h-4.5 w-4.5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Gợi ý thích ứng thông minh:</strong> Hệ thống nhận thấy bạn có xu hướng chi tiêu lệch chuẩn trong tháng này. 
              Chúng tôi đã tự động điều chỉnh phân bổ tháng tiếp theo để giúp bạn thích ứng từ từ mà không tạo áp lực quá lớn cho chi tiêu sinh hoạt.
            </p>
          </div>
        )}
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
            isOver ? "bg-destructive" : "bg-foreground/20"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
