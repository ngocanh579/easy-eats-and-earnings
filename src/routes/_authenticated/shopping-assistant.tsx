import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingBag,
  Sparkles,
  Heart,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  DollarSign,
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight,
  Truck,
  PackageCheck,
  CreditCard,
  X,
  Star,
  Info,
  Calendar,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatVND, parseAmountShortcut } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/shopping-assistant")({
  component: ShoppingAssistantPage,
});

// Interfaces
interface IntendedPurchase {
  id: string;
  name: string;
  price: number;
  categoryName: string;
  categoryId: string | null;
  link: string;
  notes: string;
  rating: number; // 1-5 stars
  createdAt: string;
  waitTimerStartedAt: string | null; // ISO string for the 24h delay
}

interface UnpaidOrder {
  id: string;
  shopName: string;
  name: string;
  price: number;
  categoryName: string;
  categoryId: string | null;
  status: "pending" | "delivered" | "paid"; // Đang chờ hàng, Đã nhận hàng, Đã thanh toán
  createdAt: string;
}

interface Wallet {
  id: string;
  name: string;
  initial_balance: number;
}

interface Category {
  id: string;
  name: string;
  kind: "expense" | "income" | "debt" | "savings";
}

// ----------------------------------------------------
// HIGH-FIDELITY DEMO DATA
// ----------------------------------------------------
const DEFAULT_PURCHASES: IntendedPurchase[] = [
  {
    id: "purchase-1",
    name: "Bàn phím cơ AKKO 3098B",
    price: 1200000,
    categoryName: "Mua sắm",
    categoryId: null,
    link: "https://shopee.vn/ban-phim-co-akko",
    notes: "Dùng để gõ phím êm tai hơn lúc làm việc văn phòng buổi tối.",
    rating: 4,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    waitTimerStartedAt: null,
  },
  {
    id: "purchase-2",
    name: "Giày Sneaker Nike Air Max",
    price: 2100000,
    categoryName: "Mua sắm",
    categoryId: null,
    link: "",
    notes: "Phối màu xám trắng cực đẹp, đi chơi đi làm đều hợp.",
    rating: 3,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    waitTimerStartedAt: null,
  },
  {
    id: "purchase-3",
    name: "Trà sữa Phúc Long size L",
    price: 70000,
    categoryName: "Cafe",
    categoryId: null,
    link: "",
    notes: "Đang xem phim buổi tối tự nhiên thèm ngọt bốc đồng.",
    rating: 1,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    waitTimerStartedAt: null,
  },
  {
    id: "purchase-4",
    name: "Máy pha cà phê Delonghi Espresso",
    price: 4500000,
    categoryName: "Mua sắm",
    categoryId: null,
    link: "https://tiki.vn/may-pha-ca-phe-delonghi",
    notes: "Muốn tự pha Espresso chuẩn Ý mỗi sáng thay vì mua quán.",
    rating: 2,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    waitTimerStartedAt: null,
  },
];

const DEFAULT_ORDERS: UnpaidOrder[] = [
  {
    id: "order-1",
    shopName: "Shopee",
    name: "Ốp lưng chống sốc iPhone 15",
    price: 150000,
    categoryName: "Mua sắm",
    categoryId: null,
    status: "pending",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "order-2",
    shopName: "TikTok Shop",
    name: "Áo thun Oversize Unisex local brand",
    price: 320000,
    categoryName: "Mua sắm",
    categoryId: null,
    status: "delivered",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const parseMoneyInput = (value: string) => {
  const parsed = parseAmountShortcut(value);
  if (parsed !== null) return parsed;
  return Number(value.replace(/[^0-9]/g, "")) || 0;
};

const normalizeSavedOrder = (order: UnpaidOrder): UnpaidOrder => {
  const price = Number(order.price);

  // Older builds parsed formatted values like "4.000" as 4. COD prices below
  // 1,000 VND are not practical in this app, so migrate them back to thousands.
  if (price > 0 && price < 1000) {
    return { ...order, price: price * 1000 };
  }

  return { ...order, price };
};

function ShoppingAssistantPage() {
  const queryClient = useQueryClient();

  // ----------------------------------------------------
  // LOCAL STATES & PERSISTENCE
  // ----------------------------------------------------
  const [activeTab, setActiveTab] = useState<"assistant" | "orders">("assistant");
  const [purchases, setPurchases] = useState<IntendedPurchase[]>([]);
  const [orders, setOrders] = useState<UnpaidOrder[]>([]);
  const [demoMode, setDemoMode] = useState<boolean>(true);
  const [timeTicker, setTimeTicker] = useState<number>(Date.now());

  // Modal open states
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  // Form values
  const [newPurchase, setNewPurchase] = useState({
    name: "",
    price: "",
    categoryName: "Mua sắm",
    link: "",
    notes: "",
    rating: 3,
  });

  const [newOrder, setNewOrder] = useState({
    shopName: "Shopee",
    name: "",
    price: "",
    categoryName: "Mua sắm",
  });

  // Pay Modal sync state
  const [selectedPayOrder, setSelectedPayOrder] = useState<UnpaidOrder | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  // Confetti / Congratulatory State when skipping an impulse buy
  const [savedAmount, setSavedAmount] = useState<number | null>(null);
  const [savedItemName, setSavedItemName] = useState<string>("");

  const parsedPurchasePricePreview = useMemo(() => {
    const hasLetters = /[a-zA-Z]/g.test(newPurchase.price);
    if (!hasLetters) return null;
    const parsed = parseAmountShortcut(newPurchase.price);
    if (parsed !== null && parsed > 0) {
      return formatVND(parsed);
    }
    return null;
  }, [newPurchase.price]);

  const handlePurchasePriceBlur = () => {
    const parsed = parseAmountShortcut(newPurchase.price);
    if (parsed !== null && parsed > 0) {
      setNewPurchase({ ...newPurchase, price: parsed.toLocaleString("vi-VN") });
    } else {
      const clean = newPurchase.price.replace(/[^0-9]/g, "");
      if (clean) {
        const num = parseFloat(clean);
        setNewPurchase({ ...newPurchase, price: num.toLocaleString("vi-VN") });
      }
    }
  };

  const parsedOrderPricePreview = useMemo(() => {
    const hasLetters = /[a-zA-Z]/g.test(newOrder.price);
    if (!hasLetters) return null;
    const parsed = parseAmountShortcut(newOrder.price);
    if (parsed !== null && parsed > 0) {
      return formatVND(parsed);
    }
    return null;
  }, [newOrder.price]);

  const handleOrderPriceBlur = () => {
    const parsed = parseAmountShortcut(newOrder.price);
    if (parsed !== null && parsed > 0) {
      setNewOrder({ ...newOrder, price: parsed.toLocaleString("vi-VN") });
    } else {
      const clean = newOrder.price.replace(/[^0-9]/g, "");
      if (clean) {
        const num = parseFloat(clean);
        setNewOrder({ ...newOrder, price: num.toLocaleString("vi-VN") });
      }
    }
  };

  // Periodically refresh countdown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTicker(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load and initialize data from localStorage
  useEffect(() => {
    const savedPurchases = localStorage.getItem("easy_eats_intended_purchases");
    const savedOrders = localStorage.getItem("easy_eats_pending_orders");
    const savedDemo = localStorage.getItem("easy_eats_shopping_demo");

    if (savedDemo !== null) {
      setDemoMode(JSON.parse(savedDemo));
    }

    if (savedPurchases) {
      setPurchases(JSON.parse(savedPurchases));
    } else {
      setPurchases(DEFAULT_PURCHASES);
      localStorage.setItem("easy_eats_intended_purchases", JSON.stringify(DEFAULT_PURCHASES));
    }

    if (savedOrders) {
      const normalizedOrders = (JSON.parse(savedOrders) as UnpaidOrder[]).map(normalizeSavedOrder);
      setOrders(normalizedOrders);
      localStorage.setItem("easy_eats_pending_orders", JSON.stringify(normalizedOrders));
    } else {
      setOrders(DEFAULT_ORDERS);
      localStorage.setItem("easy_eats_pending_orders", JSON.stringify(DEFAULT_ORDERS));
    }
  }, []);

  const savePurchasesState = (updated: IntendedPurchase[]) => {
    setPurchases(updated);
    localStorage.setItem("easy_eats_intended_purchases", JSON.stringify(updated));
  };

  const saveOrdersState = (updated: UnpaidOrder[]) => {
    setOrders(updated);
    localStorage.setItem("easy_eats_pending_orders", JSON.stringify(updated));
  };

  const handleDemoModeToggle = () => {
    const next = !demoMode;
    setDemoMode(next);
    localStorage.setItem("easy_eats_shopping_demo", JSON.stringify(next));
    if (next) {
      // Restore defaults
      savePurchasesState(DEFAULT_PURCHASES);
      saveOrdersState(DEFAULT_ORDERS);
      toast.success("Đã bật Dữ liệu mẫu (Demo) cho Trợ lý mua sắm!");
    } else {
      toast.info("Đã chuyển sang chế độ cá nhân.");
    }
  };

  // ----------------------------------------------------
  // REAL DATABASE QUERY SYNCING (via React Query)
  // ----------------------------------------------------
  const walletsQuery = useQuery({
    queryKey: ["wallets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wallets").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Wallet[];
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("kind", "expense")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const txsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const dbWallets = walletsQuery.data ?? [];
  const dbCategories = categoriesQuery.data ?? [];
  const dbTxs = txsQuery.data ?? [];

  // Initialize selected values for Payment dialog
  useEffect(() => {
    if (dbWallets.length > 0 && !selectedWalletId) {
      setSelectedWalletId(dbWallets[0].id);
    }
    if (dbCategories.length > 0 && !selectedCategoryId) {
      // Find default categories
      const shopping = dbCategories.find(c => c.name.toLowerCase().includes("sắm"));
      setSelectedCategoryId(shopping ? shopping.id : dbCategories[0].id);
    }
  }, [dbWallets, dbCategories, selectedWalletId, selectedCategoryId]);

  // Compute total wallet balances
  const totalWalletBalance = useMemo(() => {
    // If in demo mode we can assume a comfortable balance like 5,000,000 to keep calculations realistic,
    // otherwise sum actual db wallets. If db wallets is empty, fallback to 5,000,000.
    if (demoMode) {
      return 5000000;
    }
    return dbWallets.reduce((sum, w) => sum + Number(w.initial_balance), 0) || 5000000;
  }, [dbWallets, demoMode]);

  // ----------------------------------------------------
  // MUTATION: CONVERT COD ORDER TO ACTUAL SUPABASE TX
  // ----------------------------------------------------
  const payOrderMutation = useMutation({
    mutationFn: async ({ order, walletId, categoryId }: { order: UnpaidOrder; walletId: string; categoryId: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Chưa đăng nhập");
      // Insert transaction; wallet balance is derived from transactions via RLS-scoped queries elsewhere.
      const { error: txError } = await supabase.from("transactions").insert({
        user_id: u.user.id,
        wallet_id: walletId,
        category_id: categoryId,
        kind: "expense",
        amount: order.price,
        note: `[Trợ lý kiểm soát] Nhận hàng COD: ${order.name} (${order.shopName})`,
        occurred_at: new Date().toISOString(),
      });
      if (txError) throw txError;

      return { walletId, amount: order.price };
    },
    onSuccess: (_, variables) => {
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });

      // Update local storage status
      const updated = orders.map((o) =>
        o.id === variables.order.id ? { ...o, status: "paid" as const } : o
      );
      saveOrdersState(updated);

      toast.success(`Đã thanh toán thành công đơn hàng! Đã ghi nhận chi tiêu ${formatVND(variables.order.price)}.`);
      setIsPayModalOpen(false);
    },
    onError: (err) => {
      console.error(err);
      toast.error("Không thể ghi nhận giao dịch vào Supabase. Vui lòng kiểm tra lại kết nối.");
    },
  });

  // ----------------------------------------------------
  // RULES ENGINE: DYNAMIC ADVICE & LABELS
  // ----------------------------------------------------
  const getAnalysis = (item: IntendedPurchase) => {
    const warnings: string[] = [];
    let label: "should_buy" | "consider" | "dont_buy" = "should_buy";
    let labelName = "Nên mua";
    let colorClass = "bg-success/10 text-success border-success/20";
    let reason = "";

    const price = item.price;
    const isNeed = ["ăn uống", "nhà ở", "đi lại", "hóa đơn", "y tế", "học tập"].includes(item.categoryName.toLowerCase()) ||
      /phở|cơm|bánh|điện|nước|xăng|cước|học|thuốc/i.test(item.name.toLowerCase());

    // Recent purchases logic (emotional duplicate checks)
    const recentSimilarTxs = dbTxs.filter((t: any) => {
      const note = (t.note || "").toLowerCase();
      const catName = dbCategories.find(c => c.id === t.category_id)?.name.toLowerCase() || "";
      const queryName = item.name.toLowerCase().split(" ")[0];
      return note.includes(queryName) || catName.includes(item.categoryName.toLowerCase());
    });

    const recentSimilarCount = recentSimilarTxs.length + (demoMode ? 1 : 0); // Add simulated similar count in demo

    // Price compared to wallet balance
    const walletRatio = price / totalWalletBalance;

    // Rule 1: CRITICAL CASH OUTFLOW (Price > 50% of balance)
    if (walletRatio > 0.5) {
      label = "dont_buy";
      labelName = "Không nên mua lúc này";
      colorClass = "bg-destructive/10 text-destructive border-destructive/20";
      reason = `Giá tiền chiếm tới ${(walletRatio * 100).toFixed(0)}% tổng số dư các ví hiện có. Rất nguy hiểm cho dòng tiền của bạn.`;
      warnings.push("Khoản này vượt quá 50% khả năng thanh khoản hiện tại của bạn.");
    }
    // Rule 2: Emotional Want + Low self-control (Rating <= 3)
    else if (!isNeed && item.rating <= 3) {
      if (walletRatio > 0.15) {
        label = "consider";
        labelName = "Cân nhắc kỹ";
        colorClass = "bg-warning/10 text-warning border-warning/20";
        reason = "Đây là món đồ giải trí/cảm xúc có giá trị lớn. Bạn nên kích hoạt trì hoãn 24 giờ suy nghĩ trước.";
        warnings.push("Vượt hạn mức tự do cho đồ ngẫu hứng.");
      } else {
        label = "consider";
        labelName = "Cân nhắc";
        colorClass = "bg-warning/10 text-warning border-warning/20";
        reason = "Mức độ khát khao của bạn với món này khá thấp. Bạn đang muốn mua do bốc đồng?";
        warnings.push("Điểm mong muốn thấp (chỉ đạt " + item.rating + " sao).");
      }
    }
    // Rule 3: High duplicate warning
    else if (recentSimilarCount >= 3) {
      label = "dont_buy";
      labelName = "Không nên mua";
      colorClass = "bg-destructive/10 text-destructive border-destructive/20";
      reason = `Bạn đã mua ${recentSimilarCount} món tương tự hoặc chi tiêu nhiều trong danh mục ${item.categoryName} tháng này!`;
      warnings.push(`Cảnh báo: Đã phát hiện ${recentSimilarCount} chi tiêu cùng loại thời gian gần đây.`);
    }
    // Rule 4: Ample funds, Essentials or highly prioritized want
    else {
      label = "should_buy";
      labelName = "Nên mua";
      colorClass = "bg-success/10 text-success border-success/20";
      reason = isNeed
        ? "Món thiết yếu cơ bản, mức giá phù hợp với ngân sách hiện tại của bạn."
        : "Khoản mong muốn lành mạnh. Có điểm khao khát cao và chiếm tỷ trọng nhỏ trong ví.";
    }

    // Checking if budget limits are reached
    if (price > 1000000 && !isNeed && totalWalletBalance < 3000000) {
      label = "dont_buy";
      labelName = "Không nên mua lúc này";
      colorClass = "bg-destructive/10 text-destructive border-destructive/20";
      reason = "Số dư ví hiện tại đang ở mức báo động (< 3 triệu). Nên hoãn các khoản chi ngẫu hứng.";
      warnings.push("Số dư dự trữ trong ví còn quá thấp.");
    }

    const impactScore = Math.min(
      100,
      Math.max(
        6,
        Math.round(walletRatio * 100 + (item.rating <= 2 ? 18 : 0) + (recentSimilarCount >= 3 ? 20 : 0))
      )
    );

    return { label, labelName, colorClass, reason, warnings, impactScore };
  };

  // ----------------------------------------------------
  // METRICS & DASHBOARD STATS
  // ----------------------------------------------------
  const stats = useMemo(() => {
    const totalIntended = purchases.reduce((sum, p) => sum + p.price, 0);
    const totalUnpaidOrders = orders
      .filter((o) => o.status !== "paid")
      .reduce((sum, o) => sum + o.price, 0);

    // Calculate Emotional Spending Index (ESI): % of purchases with stars <= 3 that are NOT essential categories
    const emotionalWants = purchases.filter(
      (p) =>
        p.rating <= 3 &&
        !["ăn uống", "nhà ở", "đi lại", "hóa đơn", "y tế"].includes(p.categoryName.toLowerCase())
    );
    const emotionalWantsVal = emotionalWants.reduce((sum, p) => sum + p.price, 0);

    const emotionalIndex = totalIntended > 0 ? Math.round((emotionalWantsVal / totalIntended) * 100) : 0;

    let emotionalIndexTone: "safe" | "warning" | "danger" = "safe";
    let emotionalIndexText = "An toàn";
    let emotionalColor = "text-success border-success/20 bg-success/5";

    if (emotionalIndex >= 60) {
      emotionalIndexTone = "danger";
      emotionalIndexText = "Nguy hiểm";
      emotionalColor = "text-destructive border-destructive/20 bg-destructive/5";
    } else if (emotionalIndex >= 30) {
      emotionalIndexTone = "warning";
      emotionalIndexText = "Cảnh giác";
      emotionalColor = "text-warning border-warning/20 bg-warning/5";
    }

    return {
      totalIntended,
      totalUnpaidOrders,
      emotionalIndex,
      emotionalIndexTone,
      emotionalIndexText,
      emotionalColor,
    };
  }, [purchases, orders]);

  // ----------------------------------------------------
  // DYNAMIC AI INSIGHTS
  // ----------------------------------------------------
  const aiInsights = useMemo(() => {
    const list: string[] = [];

    // Insight 1: COD liability warning
    if (stats.totalUnpaidOrders > 1000000) {
      list.push(
        `Dư nợ đơn hàng online đang chờ thanh toán (COD) là ${formatVND(stats.totalUnpaidOrders)}. Hãy đảm bảo tài khoản ngân hàng hoặc ví mặt còn đủ để thanh toán khi shipper giao hàng!`
      );
    } else {
      list.push("Hạn mức đơn hàng COD của bạn đang ở mức rất an toàn dưới 1 triệu.");
    }

    // Insight 2: Impulse buying micro transactions
    const smallImpulses = purchases.filter((p) => p.price < 150000 && p.rating <= 2);
    if (smallImpulses.length >= 2) {
      const sumSmall = smallImpulses.reduce((sum, p) => sum + p.price, 0);
      list.push(
        `Phát hiện thói quen mua sắm ngẫu hứng giá rẻ (Trà sữa, Cafe,...). Tổng các khoản bốc đồng nhỏ này đang ngốn ${formatVND(sumSmall)} tháng này. Hãy tập thói quen gom tiền lại tiết kiệm.`
      );
    }

    // Insight 3: Impulsive index warning
    if (stats.emotionalIndex >= 60) {
      list.push(
        `Chỉ số mua sắm cảm xúc của bạn đang rất cao (${stats.emotionalIndex}%). Hãy kích hoạt ngay bộ chống mua ngẫu hứng 24 giờ cho các sản phẩm 3 sao trở xuống để tránh thâm hụt ví.`
      );
    } else {
      list.push(
        "Chỉ số kiểm soát mua sắm cảm xúc của bạn rất tốt! Tiếp tục phát huy thói quen suy nghĩ thấu đáo."
      );
    }

    return list;
  }, [stats, purchases]);

  // ----------------------------------------------------
  // ACTION HANDLERS
  // ----------------------------------------------------

  // 1. ADD NEW INTENDED PURCHASE
  const handleAddPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPurchase.name || !newPurchase.price) {
      toast.error("Vui lòng nhập tên và giá tiền sản phẩm!");
      return;
    }

    const priceNum = parseMoneyInput(newPurchase.price);
    if (priceNum <= 0) {
      toast.error("Giá tiền phải lớn hơn 0!");
      return;
    }

    const item: IntendedPurchase = {
      id: `purchase-${Date.now()}`,
      name: newPurchase.name,
      price: priceNum,
      categoryName: newPurchase.categoryName,
      categoryId: null,
      link: newPurchase.link,
      notes: newPurchase.notes,
      rating: newPurchase.rating,
      createdAt: new Date().toISOString(),
      waitTimerStartedAt: null,
    };

    const updated = [item, ...purchases];
    savePurchasesState(updated);
    toast.success(`Đã thêm món "${item.name}" vào danh sách cân nhắc mua sắm!`);
    setIsAddPurchaseOpen(false);

    // Reset form
    setNewPurchase({
      name: "",
      price: "",
      categoryName: "Mua sắm",
      link: "",
      notes: "",
      rating: 3,
    });
  };

  // 2. ADD NEW COD ORDER
  const handleAddOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.name || !newOrder.price) {
      toast.error("Vui lòng nhập đầy đủ thông tin đơn hàng!");
      return;
    }

    const priceNum = parseMoneyInput(newOrder.price);
    if (priceNum <= 0) {
      toast.error("Giá tiền phải lớn hơn 0!");
      return;
    }

    const item: UnpaidOrder = {
      id: `order-${Date.now()}`,
      shopName: newOrder.shopName,
      name: newOrder.name,
      price: priceNum,
      categoryName: newOrder.categoryName,
      categoryId: null,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const updated = [item, ...orders];
    saveOrdersState(updated);
    toast.success(`Đã ghi nhận đơn hàng COD của ${item.shopName}!`);
    setIsAddOrderOpen(false);

    // Reset form
    setNewOrder({
      shopName: "Shopee",
      name: "",
      price: "",
      categoryName: "Mua sắm",
    });
  };

  // 3. REMOVE PRODUCT
  const handleDeletePurchase = (id: string) => {
    const updated = purchases.filter((p) => p.id !== id);
    savePurchasesState(updated);
    toast.info("Đã xóa sản phẩm khỏi danh sách cân cân nhắc.");
  };

  // 4. ACTIVATE 24H DELAY TIMEOUT
  const handleActivateWait = (id: string) => {
    const updated = purchases.map((p) =>
      p.id === id ? { ...p, waitTimerStartedAt: new Date().toISOString() } : p
    );
    savePurchasesState(updated);
    toast.warning("🔒 Đã khóa sản phẩm trong 24 giờ để suy nghĩ. Hãy tránh mua sắm bốc đồng!");
  };

  // 5. SIMULATE ELAPSE 24H TIMER (Fast-Forward Test Button)
  const handleFastForward24h = (id: string) => {
    // Subtract 24.1 hours into the past to trigger completion
    const pastTime = new Date(Date.now() - 24.1 * 60 * 60 * 1000).toISOString();
    const updated = purchases.map((p) =>
      p.id === id ? { ...p, waitTimerStartedAt: pastTime } : p
    );
    savePurchasesState(updated);
    toast.success("⚡ Đã tua nhanh giả lập 24h trôi qua! Mời bạn đánh giá lại mong muốn.");
  };

  // 6. CONFIRM PURCHASE STILL WANTED (Move from Intended to COD Pending)
  const handleStillWantToBuy = (item: IntendedPurchase) => {
    // 1. Remove from intended
    const updatedPurchases = purchases.filter((p) => p.id !== item.id);
    savePurchasesState(updatedPurchases);

    // 2. Add to Unpaid COD list
    const newCod: UnpaidOrder = {
      id: `order-${Date.now()}`,
      shopName: "Khác",
      name: item.name,
      price: item.price,
      categoryName: item.categoryName,
      categoryId: item.categoryId,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    saveOrdersState([newCod, ...orders]);
    toast.success(`Đã thêm "${item.name}" vào danh sách COD Đơn hàng online để chờ nhận hàng!`);
  };

  // 7. CANCEL / ABANDON IMPULSE PRODUCT (VICTORY OVER TEMPTATION!)
  const handleAbandonPurchase = (item: IntendedPurchase) => {
    // Remove from intended
    const updatedPurchases = purchases.filter((p) => p.id !== item.id);
    savePurchasesState(updatedPurchases);

    // Show congratulations and total saved
    setSavedAmount(item.price);
    setSavedItemName(item.name);
  };

  // 8. UPDATE ORDER STATUS
  const handleUpdateOrderStatus = (id: string, newStatus: "pending" | "delivered" | "paid") => {
    if (newStatus === "paid") {
      // Must open modal to pick Wallet & Category first to subtract money correctly!
      const target = orders.find((o) => o.id === id);
      if (target) {
        setSelectedPayOrder(target);
        setIsPayModalOpen(true);
      }
      return;
    }

    const updated = orders.map((o) => (o.id === id ? { ...o, status: newStatus } : o));
    saveOrdersState(updated);
    toast.info("Đã cập nhật trạng thái đơn hàng.");
  };

  // 9. REMOVE COD ORDER
  const handleDeleteOrder = (id: string) => {
    const updated = orders.filter((o) => o.id !== id);
    saveOrdersState(updated);
    toast.info("Đã xóa đơn hàng.");
  };

  // 10. PAY THE ORDER (SUPABASE INTEGRATION CONFIRMATION)
  const handleConfirmOrderPaymentSubmit = () => {
    if (!selectedPayOrder) return;
    payOrderMutation.mutate({
      order: selectedPayOrder,
      walletId: selectedWalletId,
      categoryId: selectedCategoryId,
    });
  };

  const recommendationCounts = purchases.reduce(
    (acc, item) => {
      const label = getAnalysis(item).label;
      acc[label] += 1;
      return acc;
    },
    { should_buy: 0, consider: 0, dont_buy: 0 },
  );

  return (
    <div className="space-y-5 animate-fade-in pb-8 sm:space-y-6">
      {/* Header section with Premium design */}
      <div className="flex flex-col gap-4 rounded-[1.75rem] bg-card/80 p-4 shadow-[var(--shadow-soft)] sm:p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
              <ShoppingBag className="h-4.5 w-4.5" />
            </div>
            <h1 className="font-display text-xl font-semibold sm:text-2xl lg:text-3xl">
              Trợ lý Kiểm soát mua sắm
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Ức chế mua sắm ngẫu hứng, quản lý đơn hàng online COD và tối ưu chi tiêu cảm xúc.
          </p>
        </div>

        {/* Demo and Switchers */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDemoModeToggle}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200",
              demoMode
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            )}
          >
            <Compass className="h-3.5 w-3.5" />
            Nạp Dữ liệu mẫu (Demo)
          </button>
        </div>
      </div>

      {/* Confetti Reward Success Overlay Card */}
      {savedAmount !== null && (
        <div className="rounded-[1.5rem] bg-success/10 p-5 flex flex-col md:flex-row items-center justify-between gap-4 animate-scale-in">
          <div className="flex items-start gap-4 text-center md:text-left">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-success/20 text-success mx-auto md:mx-0 flex-shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-success">
                Chiến thắng Cám dỗ mua sắm thành công! 🎉
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
                Tuyệt vời! Bạn đã vượt qua 24h suy nghĩ thấu đáo và quyết định hủy bỏ ý định mua món đồ ngẫu hứng: <strong>"{savedItemName}"</strong>.
                Bạn vừa tự giữ lại cho tài khoản ví của mình <strong>{formatVND(savedAmount)}</strong>!
              </p>
            </div>
          </div>
          <button
            onClick={() => setSavedAmount(null)}
            className="px-4 py-2 bg-success text-success-foreground text-xs font-semibold rounded-xl shadow-sm hover:opacity-90 transition-all self-center"
          >
            Nhận lời khích lệ & Tiếp tục
          </button>
        </div>
      )}

      {/* Dashboard Bento Grid of Purchases Control */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Metric 1: Intended total */}
        <div className="rounded-[1.5rem] bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5 flex flex-col justify-between">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Tổng giá trị định mua</p>
          <div className="mt-2">
            <h2 className="font-display text-2xl font-bold">{formatVND(stats.totalIntended)}</h2>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              Gồm {purchases.length} sản phẩm đang chờ cân nhắc.
            </p>
          </div>
        </div>

        {/* Metric 2: Pending COD orders */}
        <div className="rounded-[1.5rem] bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5 flex flex-col justify-between">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Tổng đơn chưa trả tiền (COD)</p>
          <div className="mt-2">
            <h2 className="font-display text-2xl font-bold text-warning-foreground">
              {formatVND(stats.totalUnpaidOrders)}
            </h2>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              Sắp phải thanh toán khi nhận hàng.
            </p>
          </div>
        </div>

        {/* Metric 3: Emotional Spending Index */}
        <div className="rounded-[1.5rem] bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Tỷ trọng chi tiêu cảm xúc</p>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold">{stats.emotionalIndex}%</h2>
                <span className={cn(
                  "inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5 border",
                  stats.emotionalColor
                )}>
                  {stats.emotionalIndexText}
                </span>
              </div>
              <div className="relative h-14 w-14">
                {/* Circular indicator */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="28" cy="28" r="23" stroke="var(--color-muted)" strokeWidth="4" fill="transparent" />
                  <circle cx="28" cy="28" r="23" stroke={stats.emotionalIndexTone === "danger" ? "var(--color-destructive)" : stats.emotionalIndexTone === "warning" ? "var(--color-warning)" : "var(--color-success)"} strokeWidth="4" fill="transparent"
                    strokeDasharray={2 * Math.PI * 23}
                    strokeDashoffset={2 * Math.PI * 23 * (1 - stats.emotionalIndex / 100)}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">ESI</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Insight Box */}
        <div className="rounded-[1.5rem] bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-warning" />
              AI Insight kiểm soát
            </span>
            <ul className="space-y-1.5 text-[10px] text-muted-foreground leading-normal font-medium">
              {aiInsights.slice(0, 2).map((ins, i) => (
                <li key={i} className="list-disc pl-1 list-inside truncate-2-lines">{ins}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-1.5">
        <button
          onClick={() => setActiveTab("assistant")}
          className={cn(
            "min-h-11 rounded-xl px-3 py-2 font-display text-xs font-semibold transition-all duration-200 sm:text-sm",
            activeTab === "assistant"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          🛒 Cân nhắc mua sắm ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={cn(
            "min-h-11 rounded-xl px-3 py-2 font-display text-xs font-semibold transition-all duration-200 sm:text-sm",
            activeTab === "orders"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          📦 Đơn hàng COD & Sắp giao ({orders.filter(o => o.status !== "paid").length})
        </button>
      </div>

      {/* ----------------------------------------------------
          TAB 1: SHOPPING CONSIDERATIONS ASSISTANT
         ---------------------------------------------------- */}
      {activeTab === "assistant" && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-success/10 p-4 text-success">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Nên mua</span>
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold">{recommendationCounts.should_buy}</p>
            </div>
            <div className="rounded-2xl bg-warning/10 p-4 text-warning-foreground">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Cân nhắc</span>
                <AlertTriangle className="h-4 w-4" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold">{recommendationCounts.consider}</p>
            </div>
            <div className="rounded-2xl bg-destructive/10 p-4 text-destructive">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Không nên mua</span>
                <AlertCircle className="h-4 w-4" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold">{recommendationCounts.dont_buy}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-display text-base font-semibold">Danh sách phân tích sản phẩm</h3>
            <button
              onClick={() => setIsAddPurchaseOpen(true)}
              className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Thêm món định mua
            </button>
          </div>

          {purchases.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-card/70 p-8 text-center sm:p-12">
              <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-60" />
              <h4 className="font-display text-sm font-semibold">Chưa có sản phẩm nào đang cân nhắc</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Khi bạn nảy sinh ý định mua bất kỳ món đồ giải trí hay ngẫu hứng nào, hãy bấm thêm vào đây để Trợ lý phân tích trước khi mua!
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {purchases.map((item) => {
                const analysis = getAnalysis(item);

                // Countdown logic
                let isWaiting = false;
                let timerCompleted = false;
                let timerString = "";

                if (item.waitTimerStartedAt !== null) {
                  isWaiting = true;
                  const startMs = new Date(item.waitTimerStartedAt).getTime();
                  const totalWaitMs = 24 * 60 * 60 * 1000;
                  const elapsedMs = timeTicker - startMs;
                  const remainingMs = totalWaitMs - elapsedMs;

                  if (remainingMs <= 0) {
                    timerCompleted = true;
                  } else {
                    // Convert to hh:mm:ss
                    const hrs = Math.floor(remainingMs / (60 * 60 * 1000));
                    const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
                    const secs = Math.floor((remainingMs % (60 * 1000)) / 1000);
                    timerString = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
                  }
                }

                return (
                  <div
                    key={item.id}
                    className="rounded-[1.5rem] bg-card p-4 shadow-[var(--shadow-soft)] flex flex-col justify-between relative transition-all duration-300 sm:p-5 active:scale-[0.99] sm:hover:scale-[1.01]"
                  >
                    <div>
                      {/* Top labels and ratings */}
                      <div className="flex justify-between items-start gap-2">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                          analysis.colorClass
                        )}>
                          {analysis.labelName}
                        </span>

                        {/* 1-5 Stars visualization */}
                        <div className="flex items-center gap-0.5 text-warning">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "h-3.5 w-3.5",
                                i < item.rating ? "fill-warning" : "text-muted opacity-45"
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Info & Price */}
                      <div className="mt-3.5">
                        <h4 className="font-display text-sm font-semibold truncate" title={item.name}>
                          {item.name}
                        </h4>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="font-display text-base font-extrabold text-foreground">
                            {formatVND(item.price)}
                          </span>
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            ({item.categoryName})
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl bg-muted/45 p-3">
                        <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          <span>Ảnh hưởng tài chính</span>
                          <span>{analysis.impactScore}%</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-background">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              analysis.label === "dont_buy"
                                ? "bg-destructive"
                                : analysis.label === "consider"
                                  ? "bg-warning"
                                  : "bg-success",
                            )}
                            style={{ width: `${analysis.impactScore}%` }}
                          />
                        </div>
                      </div>

                      {/* Description & Link */}
                      {item.notes && (
                        <p className="text-xs text-muted-foreground mt-2 font-medium leading-relaxed italic">
                          " {item.notes} "
                        </p>
                      )}

                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-primary hover:underline"
                        >
                          Xem liên kết sản phẩm <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}

                      {/* Rule Engine Warnings */}
                      {analysis.warnings.length > 0 && (
                        <div className="mt-4 border-t border-dashed border-border/80 pt-3 space-y-1.5">
                          {analysis.warnings.map((warn, i) => (
                            <p key={i} className="text-[10px] text-destructive font-semibold flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {warn}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Advisor Explanation Text */}
                      <p className="text-[11px] font-medium text-muted-foreground mt-3 bg-muted/30 p-2.5 rounded-xl border border-border/60">
                        <strong>Lời khuyên:</strong> {analysis.reason}
                      </p>
                    </div>

                    {/* Bottom Actions based on impulse inhibitors */}
                    <div className="mt-5 border-t border-border/60 pt-4 flex flex-col gap-2">
                      {/* Scenario A: Cool-down Timer in active progress */}
                      {isWaiting && !timerCompleted && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-warning-foreground bg-warning/5 border border-warning/10 p-2.5 rounded-xl">
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 animate-spin" /> Trì hoãn 24h:
                            </span>
                            <span className="font-mono tracking-wider">{timerString}</span>
                          </div>

                          {/* Fast-forward Simulator for Developer & User testing */}
                          <button
                            onClick={() => handleFastForward24h(item.id)}
                            className="w-full py-1.5 bg-muted hover:bg-muted/70 text-[10px] font-bold rounded-lg border border-border/80 text-muted-foreground hover:text-foreground transition-all uppercase tracking-wider"
                          >
                            ⚡ Giả lập Tua nhanh 24h (Test)
                          </button>
                        </div>
                      )}

                      {/* Scenario B: 24h Cool-down has finished! Evaluates decision */}
                      {isWaiting && timerCompleted && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center space-y-2.5">
                          <p className="text-[11px] font-bold text-foreground">
                            🌟 Đã hết 24h suy nghĩ! Bạn thực sự cần món này chứ?
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleAbandonPurchase(item)}
                              className="py-1.5 bg-destructive text-destructive-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-all"
                            >
                              Bỏ qua (Không mua)
                            </button>
                            <button
                              onClick={() => handleStillWantToBuy(item)}
                              className="py-1.5 bg-success text-success-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-all"
                            >
                              Vẫn muốn mua
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Scenario C: Clean Item, waiting for delay to be enabled */}
                      {!isWaiting && (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          {analysis.label !== "should_buy" && (
                            <button
                              onClick={() => handleActivateWait(item.id)}
                              className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-2xl bg-warning px-3 py-2 text-xs font-bold text-warning-foreground shadow-sm transition-all hover:opacity-90"
                            >
                              <Clock className="h-3.5 w-3.5" />
                              Chờ 24h suy nghĩ
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (analysis.label === "dont_buy") {
                                toast.error("Bộ phân tích cảnh báo KHÔNG NÊN mua lúc này. Hãy kích hoạt trì hoãn để suy nghĩ!");
                                return;
                              }
                              // Otherwise let them buy: move to COD Order list
                              handleStillWantToBuy(item);
                            }}
                            className={cn(
                              "min-h-11 flex-1 rounded-2xl px-3 py-2 text-xs font-bold shadow-sm transition-all",
                              analysis.label === "dont_buy"
                                ? "bg-muted text-muted-foreground cursor-not-allowed"
                                : "bg-primary text-primary-foreground hover:opacity-90"
                            )}
                          >
                            Duyệt Mua ngay
                          </button>

                          <button
                            onClick={() => handleDeletePurchase(item.id)}
                            className="min-h-11 rounded-2xl border border-border/70 px-3 text-muted-foreground transition-all hover:bg-muted hover:text-destructive"
                            title="Xóa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------
          TAB 2: COD PENDING ORDERS
         ---------------------------------------------------- */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">Khoản COD & Đơn hàng online chưa trả tiền</h3>
            <button
              onClick={() => setIsAddOrderOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:opacity-90 shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              Ghi nhận đơn hàng online
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-60 animate-bounce" />
              <h4 className="font-display text-sm font-semibold">Chưa có đơn hàng online COD nào</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Lưu trữ các đơn mua online chưa thanh toán tại đây. Khi hàng về, bấm duyệt chuyển giao dịch thật để tự động ghi nhận số liệu.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[var(--shadow-soft)]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-xs font-bold text-muted-foreground">
                      <th className="p-4">Đơn hàng</th>
                      <th className="p-4">Nền tảng</th>
                      <th className="p-4">Số tiền</th>
                      <th className="p-4">Danh mục</th>
                      <th className="p-4">Trạng thái</th>
                      <th className="p-4 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs font-medium">
                    {orders.map((order) => {
                      const isPaid = order.status === "paid";
                      return (
                        <tr
                          key={order.id}
                          className={cn(
                            "transition-all",
                            isPaid ? "opacity-60 bg-muted/10" : "hover:bg-muted/10"
                          )}
                        >
                          <td className="p-4">
                            <span className="font-bold text-foreground block">{order.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              Ghi nhận ngày {new Date(order.createdAt).toLocaleDateString("vi-VN")}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "inline-block px-2 py-0.5 rounded text-[10px] font-bold border",
                              order.shopName === "Shopee" ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                                order.shopName === "TikTok Shop" ? "bg-slate-900/10 text-foreground border-slate-900/20" :
                                  "bg-primary/10 text-primary border-primary/20"
                            )}>
                              {order.shopName}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-base text-foreground">
                            {formatVND(order.price)}
                          </td>
                          <td className="p-4 uppercase tracking-wider text-[10px] font-bold text-muted-foreground">
                            {order.categoryName}
                          </td>
                          <td className="p-4">
                            <select
                              disabled={isPaid}
                              value={order.status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as any)}
                              className={cn(
                                "rounded-lg border px-2 py-1 text-xs font-bold outline-none cursor-pointer focus:ring-1 focus:ring-ring disabled:opacity-75 disabled:cursor-not-allowed",
                                order.status === "pending" ? "bg-yellow-500/15 text-warning-foreground border-yellow-500/30" :
                                  order.status === "delivered" ? "bg-primary/10 text-primary border-primary/20" :
                                    "bg-success/10 text-success border-success/20"
                              )}
                            >
                              <option value="pending" className="bg-card text-foreground font-bold">🛒 Chờ hàng (Shipper)</option>
                              <option value="delivered" className="bg-card text-foreground font-bold">📦 Đã giao (COD)</option>
                              <option value="paid" className="bg-card text-foreground font-bold" disabled>🎉 Đã thanh toán</option>
                            </select>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!isPaid && (
                                <button
                                  onClick={() => handleUpdateOrderStatus(order.id, "paid")}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-success text-success-foreground font-semibold rounded-lg hover:opacity-90 shadow-sm transition-all"
                                >
                                  <CreditCard className="h-3.5 w-3.5" />
                                  Chuyển thành chi tiêu
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteOrder(order.id)}
                                className="p-2 border border-border text-muted-foreground hover:text-destructive hover:bg-muted/40 rounded-lg transition-all"
                                title="Xóa"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL 1: ADD NEW INTENDED PURCHASE FORM
         ---------------------------------------------------- */}
      {isAddPurchaseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-display text-base font-bold flex items-center gap-1.5">
                <ShoppingBag className="h-4.5 w-4.5 text-primary" />
                Thêm dự định mua mới
              </h3>
              <button
                onClick={() => setIsAddPurchaseOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleAddPurchase} className="mt-4 space-y-4">
              {/* Product name */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Tên sản phẩm *</label>
                <input
                  required
                  type="text"
                  value={newPurchase.name}
                  onChange={(e) => setNewPurchase({ ...newPurchase, name: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Ví dụ: Bàn phím cơ AKKO"
                />
              </div>

              {/* Price */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Giá tiền (VND) *</label>
                <input
                  required
                  type="text"
                  value={newPurchase.price}
                  onChange={(e) => setNewPurchase({ ...newPurchase, price: e.target.value })}
                  onBlur={handlePurchasePriceBlur}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring font-semibold"
                  placeholder="Ví dụ: 1.2tr, 33k..."
                />
                {parsedPurchasePricePreview && (
                  <span className="text-[10px] text-success font-semibold mt-1 block animate-pulse">
                    = {parsedPurchasePricePreview}
                  </span>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Loại danh mục</label>
                <select
                  value={newPurchase.categoryName}
                  onChange={(e) => setNewPurchase({ ...newPurchase, categoryName: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="Mua sắm">🛍️ Mua sắm (Muốn/Wants)</option>
                  <option value="Cafe">☕ Cafe & Trà sữa (Muốn/Wants)</option>
                  <option value="Giải trí">🎮 Giải trí (Muốn/Wants)</option>
                  <option value="Du lịch">✈️ Du lịch (Muốn/Wants)</option>
                  <option value="Ăn uống">🍜 Ăn uống (Thiết yếu/Needs)</option>
                  <option value="Đi lại">🚕 Đi lại (Thiết yếu/Needs)</option>
                  <option value="Hoá đơn">🧾 Hóa đơn điện nước (Thiết yếu/Needs)</option>
                </select>
              </div>

              {/* Want rating (1-5 stars) */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Độ thèm muốn bốc đồng (1-5 sao)</label>
                <div className="flex items-center gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setNewPurchase({ ...newPurchase, rating: i + 1 })}
                      className="text-warning transition-all hover:scale-110"
                    >
                      <Star
                        className={cn(
                          "h-6 w-6",
                          i < newPurchase.rating ? "fill-warning" : "text-muted opacity-45"
                        )}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-muted-foreground ml-2">
                    {newPurchase.rating === 1 ? "☕ Rất ngẫu hứng" :
                      newPurchase.rating === 3 ? "🤔 Bình thường" :
                        "🔥 Khao khát sở hữu"}
                  </span>
                </div>
              </div>

              {/* Link */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Đường dẫn liên kết (Nếu có)</label>
                <input
                  type="url"
                  value={newPurchase.link}
                  onChange={(e) => setNewPurchase({ ...newPurchase, link: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="https://shopee.vn/product-url..."
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Ghi chú suy nghĩ</label>
                <textarea
                  value={newPurchase.notes}
                  onChange={(e) => setNewPurchase({ ...newPurchase, notes: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-ring h-16 resize-none"
                  placeholder="Món đồ này có thực sự thiết thực? Ghi lại suy nghĩ của bạn..."
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddPurchaseOpen(false)}
                  className="flex-1 py-2.5 bg-muted text-foreground text-xs font-semibold rounded-xl border hover:opacity-90"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-xl shadow-sm hover:opacity-90"
                >
                  Lưu vào bộ nhớ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL 2: ADD NEW ONLINE COD ORDER FORM
         ---------------------------------------------------- */}
      {isAddOrderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-display text-base font-bold flex items-center gap-1.5">
                <Truck className="h-4.5 w-4.5 text-primary" />
                Ghi nhận đơn hàng online COD
              </h3>
              <button
                onClick={() => setIsAddOrderOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleAddOrder} className="mt-4 space-y-4">
              {/* Product name */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Tên món hàng online *</label>
                <input
                  required
                  type="text"
                  value={newOrder.name}
                  onChange={(e) => setNewOrder({ ...newOrder, name: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Ví dụ: Áo thun local brand"
                />
              </div>

              {/* Shop Platform */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Nền tảng mua hàng</label>
                <select
                  value={newOrder.shopName}
                  onChange={(e) => setNewOrder({ ...newOrder, shopName: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="Shopee">🍊 Shopee Platform</option>
                  <option value="TikTok Shop">🎵 TikTok Shop</option>
                  <option value="Lazada">💙 Lazada Platform</option>
                  <option value="Khác">📦 Cửa hàng / Nền tảng khác</option>
                </select>
              </div>

              {/* Price */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Giá tiền thanh toán khi nhận (VND) *</label>
                <input
                  required
                  type="text"
                  value={newOrder.price}
                  onChange={(e) => setNewOrder({ ...newOrder, price: e.target.value })}
                  onBlur={handleOrderPriceBlur}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring font-semibold"
                  placeholder="Ví dụ: 350k, 1.2tr..."
                />
                {parsedOrderPricePreview && (
                  <span className="text-[10px] text-success font-semibold mt-1 block animate-pulse">
                    = {parsedOrderPricePreview}
                  </span>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Danh mục hạch toán</label>
                <select
                  value={newOrder.categoryName}
                  onChange={(e) => setNewOrder({ ...newOrder, categoryName: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="Mua sắm">🛍️ Mua sắm (Quần áo, Đồ dùng)</option>
                  <option value="Ăn uống">🍜 Ăn uống (Thực phẩm online)</option>
                  <option value="Cafe">☕ Đồ uống & Ăn vặt</option>
                  <option value="Giải trí">🎮 Đồ công nghệ / Game</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOrderOpen(false)}
                  className="flex-1 py-2.5 bg-muted text-foreground text-xs font-semibold rounded-xl border hover:opacity-90"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-xl shadow-sm hover:opacity-90"
                >
                  Ghi nhận đơn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL 3: PAY ONLINE ORDER (SUPABASE ACCOUNT SELECTION)
         ---------------------------------------------------- */}
      {isPayModalOpen && selectedPayOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-display text-base font-bold flex items-center gap-1.5">
                <CreditCard className="h-4.5 w-4.5 text-success" />
                Hạch toán & Thanh toán chi tiêu
              </h3>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="mt-4 bg-muted/40 p-4 rounded-xl border border-border/60 text-xs">
              <p className="text-muted-foreground uppercase font-bold text-[10px]">Tóm tắt đơn hàng:</p>
              <div className="flex justify-between items-baseline mt-2">
                <span className="font-bold text-foreground text-sm">{selectedPayOrder.name}</span>
                <span className="font-mono text-base font-extrabold text-foreground">{formatVND(selectedPayOrder.price)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Nền tảng mua: {selectedPayOrder.shopName}</p>
            </div>

            <div className="mt-4 space-y-4">
              {/* Pick Wallet */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Dùng tiền từ ví nào? *</label>
                {dbWallets.length === 0 ? (
                  <p className="text-xs text-destructive italic">Chưa tìm thấy ví thanh toán nào trong tài khoản. Hãy tạo một ví trước.</p>
                ) : (
                  <select
                    value={selectedWalletId}
                    onChange={(e) => setSelectedWalletId(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs outline-none font-semibold focus:ring-2 focus:ring-ring"
                  >
                    {dbWallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        💳 {w.name} (Số dư đầu: {formatVND(w.initial_balance)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Pick Category */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Hạch toán vào danh mục nào? *</label>
                {dbCategories.length === 0 ? (
                  <p className="text-xs text-destructive italic">Chưa tìm thấy danh mục chi tiêu nào trong tài khoản.</p>
                ) : (
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs outline-none font-semibold focus:ring-2 focus:ring-ring"
                  >
                    {dbCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        🏷️ {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="flex-1 py-2.5 bg-muted text-foreground text-xs font-semibold rounded-xl border hover:opacity-90"
                >
                  Quay lại
                </button>
                <button
                  onClick={handleConfirmOrderPaymentSubmit}
                  disabled={payOrderMutation.isPending || dbWallets.length === 0}
                  className="flex-1 py-2.5 bg-success text-success-foreground text-xs font-semibold rounded-xl shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {payOrderMutation.isPending ? (
                    <span>Đang cập nhật ví...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Xác nhận thanh toán
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
