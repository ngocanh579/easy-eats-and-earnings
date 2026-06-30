/**
 * Smart Budget Suggestions based on 50/30/20 rule and common Vietnamese expenses
 * Allocates monthly income across different spending categories
 */

export interface BudgetSuggestion {
  categoryName: string;
  categoryIcon: string;
  percentage: number;
  amount: number;
  description: string;
}

const DEFAULT_ALLOCATIONS = [
  {
    categoryName: "Nhà ở / Thuê nhà",
    categoryIcon: "🏠",
    percentage: 25,
    description: "Tiền thuê nhà, điện, nước, gas",
  },
  {
    categoryName: "Ăn uống",
    categoryIcon: "🍽️",
    percentage: 25,
    description: "Chi phí ăn hàng ngày",
  },
  {
    categoryName: "Di chuyển",
    categoryIcon: "🚗",
    percentage: 7,
    description: "Xăng, phí đỗ xe, công cộng",
  },
  {
    categoryName: "Y tế",
    categoryIcon: "⚕️",
    percentage: 5,
    description: "Khám bệnh, thuốc, bảo hiểm",
  },
  {
    categoryName: "Giáo dục",
    categoryIcon: "📚",
    percentage: 5,
    description: "Học tập, phát triển kỹ năng",
  },
  {
    categoryName: "Giải trí",
    categoryIcon: "🎬",
    percentage: 10,
    description: "Phim, games, sở thích",
  },
  {
    categoryName: "Mua sắm",
    categoryIcon: "🛍️",
    percentage: 8,
    description: "Quần áo, đồ dùng",
  },
  {
    categoryName: "Tiết kiệm",
    categoryIcon: "💰",
    percentage: 12,
    description: "Dự phòng, tài chính",
  },
  {
    categoryName: "Khác",
    categoryIcon: "📦",
    percentage: 3,
    description: "Chi phí khác",
  },
];

export function generateBudgetSuggestions(monthlyIncome: number): BudgetSuggestion[] {
  return DEFAULT_ALLOCATIONS.map((alloc) => ({
    ...alloc,
    amount: Math.round((monthlyIncome * alloc.percentage) / 100),
  }));
}

export function getAllocations() {
  return DEFAULT_ALLOCATIONS;
}
