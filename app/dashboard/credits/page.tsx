"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getDb } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { fetchTransactions, createPaymentOrder, verifyPayment, Transaction } from "@/lib/api";
import { loadRazorpayScript, openRazorpayCheckout } from "@/lib/razorpay";
import TransactionHistory from "@/components/TransactionHistory";
import { CreditCard, Zap, Sparkles, Loader2, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function CreditsPage() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Fetch credit balance
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) {
        setCredits(null);
        setCreditsLoading(false);
        return;
      }

      try {
        setCreditsLoading(true);
        const userDoc = await getDoc(doc(getDb(), 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCredits(userData?.credits || 0);
        } else {
          setCredits(0);
        }
      } catch (error) {
        console.error("Error fetching credits:", error);
        setCredits(0);
      } finally {
        setCreditsLoading(false);
      }
    };

    fetchCredits();
  }, [user]);

  // Fetch transactions
  useEffect(() => {
    const loadTransactions = async () => {
      if (!user) {
        setTransactions([]);
        setTransactionsLoading(false);
        return;
      }

      try {
        setTransactionsLoading(true);
        const fetchedTransactions = await fetchTransactions();
        setTransactions(fetchedTransactions);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        setTransactions([]);
      } finally {
        setTransactionsLoading(false);
      }
    };

    loadTransactions();
  }, [user]);

  // Refresh credits after successful payment
  const refreshCredits = async () => {
    if (!user) return;
    
    try {
      const userDoc = await getDoc(doc(getDb(), 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setCredits(userData?.credits || 0);
      }
      // Also refresh transactions
      const fetchedTransactions = await fetchTransactions();
      setTransactions(fetchedTransactions);
    } catch (error) {
      console.error("Error refreshing credits:", error);
    }
  };

  const handlePayment = async () => {
    if (!user) {
      setPaymentError("Please log in to purchase credits");
      return;
    }

    try {
      setPaymentLoading(true);
      setPaymentError(null);
      setPaymentSuccess(false);

      // Load Razorpay script
      await loadRazorpayScript();

      // Create payment order on backend
      const orderData = await createPaymentOrder();
      const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      if (!razorpayKeyId) {
        throw new Error("Razorpay key not configured");
      }

      // Open Razorpay checkout
      openRazorpayCheckout({
        key: razorpayKeyId,
        amount: orderData.amount, // Already in smallest currency unit (cents/paise) from backend
        currency: orderData.currency || "USD", // Default to USD for $50 payment
        name: "Vi3W",
        description: "Purchase 1,250 credits for 3D generation",
        order_id: orderData.order_id,
        prefill: {
          email: user.email || undefined,
          name: user.displayName || undefined,
        },
        theme: {
          color: "#9333EA", // Purple theme to match Vi3W branding
        },
        handler: async (response) => {
          try {
            // Verify payment on backend (toast notification is handled in verifyPayment function)
            await verifyPayment(
              response.razorpay_payment_id,
              response.razorpay_order_id,
              response.razorpay_signature
            );
            
            setPaymentSuccess(true);
            setPaymentLoading(false);
            
            // Refresh credits and transactions
            await refreshCredits();
            
            // Clear success message after 5 seconds
            setTimeout(() => setPaymentSuccess(false), 5000);
          } catch (error: any) {
            console.error("Payment verification failed:", error);
            const errorMessage = error.message || "Payment verification failed";
            setPaymentError(errorMessage);
            toast.error(errorMessage);
            setPaymentLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
          },
        },
      });
    } catch (error: any) {
      console.error("Error initiating payment:", error);
      const errorMessage = error.message || "Failed to initiate payment";
      setPaymentError(errorMessage);
      toast.error(errorMessage);
      setPaymentLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-3xl font-bold mb-4">Credit Management</h1>
        <p className="text-white/60">Please log in to view your credits and purchase history.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-6xl">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Credit Management</h1>
          <p className="text-white/60">Purchase credits and view your transaction history</p>
        </div>

        {/* Current Balance Card */}
        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white/60 text-sm mb-2">Current Balance</div>
              {creditsLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-white/60" />
                  <span className="text-white/60">Loading...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Sparkles className="w-8 h-8 text-purple-400" />
                  <span className="text-4xl font-bold text-white">
                    {credits?.toLocaleString() || 0}
                  </span>
                  <span className="text-xl text-white/60">credits</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-white/60 text-sm mb-2">Cost per Generation</div>
              <div className="text-2xl font-bold text-white">125 credits</div>
            </div>
          </div>
        </div>

        {/* Payment Section */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Purchase Credits</h2>
            <p className="text-white/60">Buy credits to continue generating 3D models</p>
          </div>

          {/* Payment Details */}
          <div className="bg-white/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-green-400" />
                <span className="text-white">Credit Pack</span>
              </div>
              <span className="text-xl font-bold text-white">$50</span>
            </div>
            <div className="border-t border-white/10 pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Credits:</span>
                <span className="text-white font-medium">1,250 credits</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Per Generation:</span>
                <span className="text-white font-medium">125 credits</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-white/10">
                <span className="text-white/80 font-medium">You Get:</span>
                <span className="text-green-400 font-bold">10 free 3D generations</span>
              </div>
            </div>
          </div>

          {/* Payment Button */}
          <button
            onClick={handlePayment}
            disabled={paymentLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {paymentLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                <span>Pay $50</span>
              </>
            )}
          </button>

          {/* Payment Status Messages */}
          {paymentError && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <div className="font-medium text-red-400">Payment Failed</div>
                <div className="text-sm text-red-300/80">{paymentError}</div>
              </div>
            </div>
          )}

          {paymentSuccess && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div>
                <div className="font-medium text-green-400">Payment Successful!</div>
                <div className="text-sm text-green-300/80">
                  Your account has been credited with 1,250 credits.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Transaction History Section */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="mb-4">
            <h2 className="text-2xl font-bold mb-2">Transaction History</h2>
            <p className="text-white/60">View all your credit purchases and usage</p>
          </div>
          <TransactionHistory transactions={transactions} loading={transactionsLoading} />
        </div>
      </div>
    </div>
  );
}
