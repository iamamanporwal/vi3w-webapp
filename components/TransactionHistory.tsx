"use client";

import { useState, useMemo } from "react";
import { Transaction } from "@/lib/client-api";
import { Calendar, CreditCard, Zap, CheckCircle, XCircle, Clock } from "lucide-react";
import { SkeletonText } from "./SkeletonLoader";

interface Props {
  transactions: Transaction[];
  loading?: boolean;
}

export default function TransactionHistory({ transactions, loading }: Props) {
  const [filterType, setFilterType] = useState<"all" | "purchase" | "usage">("all");

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (filterType === "all") return transactions;
    return transactions.filter((t) => t.type === filterType);
  }, [transactions, filterType]);

  // Sort by date (newest first)
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      const aTime = a.created_at?.toMillis?.() || a.created_at?.seconds * 1000 || 0;
      const bTime = b.created_at?.toMillis?.() || b.created_at?.seconds * 1000 || 0;
      return bTime - aTime;
    });
  }, [filteredTransactions]);

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return "Unknown";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const getStatusIcon = (status: Transaction["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: Transaction["type"]) => {
    return type === "purchase" ? (
      <CreditCard className="w-4 h-4" />
    ) : (
      <Zap className="w-4 h-4" />
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white/5 border border-white/10 rounded-lg p-4 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-white/10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-32" />
                  <div className="h-3 bg-white/10 rounded w-24" />
                </div>
                <div className="text-right space-y-2">
                  <div className="h-5 bg-white/10 rounded w-16" />
                  <div className="h-3 bg-white/10 rounded w-12" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-white/60 p-4 text-center">
        No transactions yet. Your transaction history will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterType("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterType === "all"
              ? "bg-white/10 text-white"
              : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
        >
          All
        </button>
        <button
          onClick={() => setFilterType("purchase")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${filterType === "purchase"
              ? "bg-white/10 text-white"
              : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
        >
          <CreditCard className="w-4 h-4" />
          Purchases
        </button>
        <button
          onClick={() => setFilterType("usage")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${filterType === "usage"
              ? "bg-white/10 text-white"
              : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
        >
          <Zap className="w-4 h-4" />
          Usage
        </button>
      </div>

      {/* Transactions List */}
      <div className="space-y-2">
        {sortedTransactions.map((transaction) => (
          <div
            key={transaction.id}
            className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {/* Type Icon */}
                <div
                  className={`p-2 rounded-lg ${transaction.type === "purchase"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-blue-500/20 text-blue-400"
                    }`}
                >
                  {getTypeIcon(transaction.type)}
                </div>

                {/* Transaction Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">
                      {transaction.type === "purchase" ? "Credit Purchase" : "3D Generation"}
                    </span>
                    {getStatusIcon(transaction.status)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(transaction.created_at)}</span>
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right">
                  <div
                    className={`text-lg font-semibold ${transaction.type === "purchase"
                        ? "text-green-400"
                        : "text-white"
                      }`}
                  >
                    {transaction.type === "purchase" ? "+" : "-"}
                    {transaction.amount.toLocaleString()}
                  </div>
                  <div className="text-xs text-white/60">credits</div>
                </div>
              </div>
            </div>

            {/* Status Badge */}
            {transaction.status === "failed" && (
              <div className="mt-2 text-xs text-red-400">
                Transaction failed
              </div>
            )}
            {transaction.status === "pending" && (
              <div className="mt-2 text-xs text-yellow-400">
                Processing...
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State for Filtered Results */}
      {sortedTransactions.length === 0 && (
        <div className="text-white/60 p-8 text-center">
          No {filterType === "purchase" ? "purchases" : filterType === "usage" ? "usage transactions" : "transactions"} found.
        </div>
      )}
    </div>
  );
}

