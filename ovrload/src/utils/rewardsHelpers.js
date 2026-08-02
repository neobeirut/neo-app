import { useMemo } from "react";
import { Gift, Star, Coffee, ShoppingBag } from "lucide-react-native";

export const formatMoney = (n) => {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "$0.00";
  return `$${v.toFixed(2)}`;
};

export const useTierBadgeColor = (membershipTier) => {
  return useMemo(() => {
    if (membershipTier === "Platinum") return { bg: "#7C3AED", fg: "white" };
    if (membershipTier === "Gold") return { bg: "#F59E0B", fg: "white" };
    if (membershipTier === "Silver") return { bg: "#64748B", fg: "white" };
    return { bg: "#C2410C", fg: "white" };
  }, [membershipTier]);
};

export const useTierBenefits = (membershipTier) => {
  return useMemo(() => {
    if (membershipTier === "Platinum") {
      return [
        { icon: Gift, text: "Monthly perk (Platinum treat)" },
        { icon: Star, text: "Quarterly perk (tasting plate)" },
        { icon: Gift, text: "Birthday reward (free dessert)" },
      ];
    }

    if (membershipTier === "Silver" || membershipTier === "Gold") {
      return [
        { icon: Coffee, text: "Monthly perk (coffee upgrade / add-on)" },
        { icon: Gift, text: "Birthday reward (free dessert)" },
      ];
    }

    return [{ icon: Gift, text: "Birthday reward (free mini pastry)" }];
  }, [membershipTier]);
};

export const formatActivityItem = (transaction) => {
  const date = new Date(transaction.created_at);
  const isToday = date.toDateString() === new Date().toDateString();
  const isYesterday =
    date.toDateString() === new Date(Date.now() - 86400000).toDateString();

  let dateStr;
  if (isToday) {
    dateStr = `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } else if (isYesterday) {
    dateStr = `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } else {
    dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const icon =
    transaction.transaction_type === "redeemed"
      ? Gift
      : transaction.transaction_type === "bonus"
        ? Star
        : ShoppingBag;

  return {
    id: transaction.created_at,
    type: transaction.transaction_type,
    points: transaction.points,
    description: transaction.description,
    date: dateStr,
    icon,
  };
};
