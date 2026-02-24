import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Bell, Check, ChevronDown, CircleDollarSign, Copy, CreditCard, Eye, EyeOff, FileText, HandCoins, PiggyBank, QrCode, RefreshCw, Settings, Store, Users } from "lucide-react";
import { format } from "date-fns";
import CurrencySelector from "@/components/CurrencySelector";
import { useCurrency } from "@/contexts/CurrencyContext";
import BrandLogo from "@/components/BrandLogo";
import TransactionReceipt, { type ReceiptData } from "@/components/TransactionReceipt";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getAppCookie, loadUserPreferences, setAppCookie, upsertUserPreferences } from "@/lib/userPreferences";
import { isRemittanceUiEnabled } from "@/lib/remittanceAccess";
import { playUiSound } from "@/lib/appSounds";

interface Transaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  note: string;
  status: string;
  created_at: string;
  other_name?: string;
  other_username?: string;
  other_avatar_url?: string | null;
  is_sent?: boolean;
  is_topup?: boolean;
}

interface UserAccount {
  account_number: string;
  account_name: string;
  account_username: string;
}

type DashboardSection = "wallet" | "savings" | "credit" | "loans" | "cards" | "buy";
type MerchantMode = "sandbox" | "live";
type BuyOnrampProvider = "Pi Payment" | "Ewallet QR PH" | "TransFi" | "Onramp Money" | "Banxa";
type BuyPaymentMethod =
  | "Pi Payment"
  | "Ewallet"
  | "Debit Card"
  | "Credit Card"
  | "Apple Pay"
  | "Google Pay"
  | "PayPal"
  | "Stripe"
  | "Venmo";
const JQRPH_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/QR_Ph_Logo.svg/960px-QR_Ph_Logo.svg.png?20250310160234";
const PI_PAYMENT_ICON_URL = "https://i.ibb.co/BV8PHjB4/Pi-200x200.png";
const E_WALLET_PHP_PER_OUSD = 57;

interface SavingsDashboard {
  wallet_balance: number;
  savings_balance: number;
  apy: number;
}

interface SavingsTransferActivity {
  id: string;
  direction: "wallet_to_savings" | "savings_to_wallet";
  amount: number;
  note: string;
  created_at: string;
}

interface LoanDashboard {
  id: string;
  principal_amount: number;
  outstanding_amount: number;
  monthly_payment_amount: number;
  monthly_fee_rate: number;
  term_months: number;
  paid_months: number;
  credit_score: number;
  status: string;
  next_due_date: string;
  created_at: string;
}

interface LoanApplication {
  id: string;
  requested_amount: number;
  requested_term_months: number;
  credit_score_snapshot: number;
  full_name: string;
  contact_number: string;
  address_line: string;
  city: string;
  country: string;
  openpay_account_number: string;
  openpay_account_username: string;
  agreement_accepted: boolean;
  status: "pending" | "approved" | "rejected" | "cancelled";
  admin_note: string;
  created_at: string;
  reviewed_at: string | null;
}

interface LoanPaymentHistoryRow {
  id: string;
  loan_id: string;
  amount: number;
  principal_component: number;
  fee_component: number;
  payment_method: "wallet" | "pi";
  payment_reference: string | null;
  note: string;
  created_at: string;
}

interface MerchantActivityEntry {
  activity_id: string;
  activity_type: string;
  amount: number;
  currency: string;
  status: string;
  note: string;
  created_at: string;
  source: string;
}

interface MerchantActivityRpcRow {
  activity_id?: string | null;
  activity_type?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  status?: string | null;
  note?: string | null;
  created_at?: string | null;
  source?: string | null;
}

interface MerchantBalanceSnapshot {
  gross_volume: number;
  refunded_total: number;
  transferred_total: number;
  available_balance: number;
  wallet_balance: number;
  savings_balance: number;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const toPreviewText = (value: string, max = 68) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const shortenToken = (token: string, keepStart = 10, keepEnd = 6) => {
    if (token.length <= keepStart + keepEnd + 3) return token;
    return `${token.slice(0, keepStart)}...${token.slice(-keepEnd)}`;
  };

  const tokenShortened = raw
    .replace(/\bopsess_[a-zA-Z0-9_-]+\b/g, (m) => shortenToken(m))
    .replace(/\boplink_[a-zA-Z0-9_-]+\b/g, (m) => shortenToken(m))
    .replace(/\bhttps?:\/\/[^\s]+/gi, (m) => shortenToken(m, 22, 10));

  if (tokenShortened.length <= max) return tokenShortened;
  return `${tokenShortened.slice(0, max - 3)}...`;
};

const Dashboard = () => {
  const remittanceUiEnabled = isRemittanceUiEnabled();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userName, setUserName] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showReceiveOptions, setShowReceiveOptions] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [remittanceFeeIncome, setRemittanceFeeIncome] = useState(0);
  const [remittanceTxCount, setRemittanceTxCount] = useState(0);
  const [remittanceMonthIncome, setRemittanceMonthIncome] = useState(0);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [lastAdRunAt, setLastAdRunAt] = useState<number>(0);
  const [activeSection, setActiveSection] = useState<DashboardSection>("wallet");
  const [savings, setSavings] = useState<SavingsDashboard | null>(null);
  const [savingsTransfers, setSavingsTransfers] = useState<SavingsTransferActivity[]>([]);
  const [creditScore, setCreditScore] = useState(0);
  const [loan, setLoan] = useState<LoanDashboard | null>(null);
  const [loanApplication, setLoanApplication] = useState<LoanApplication | null>(null);
  const [loanPaymentHistory, setLoanPaymentHistory] = useState<LoanPaymentHistoryRow[]>([]);
  const [movingToSavings, setMovingToSavings] = useState(false);
  const [movingToWallet, setMovingToWallet] = useState(false);
  const [requestingLoan, setRequestingLoan] = useState(false);
  const [payingLoan, setPayingLoan] = useState(false);
  const [savingsAmount, setSavingsAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanTermMonths, setLoanTermMonths] = useState("6");
  const [loanPaymentAmount, setLoanPaymentAmount] = useState("");
  const [loanPaymentMethod, setLoanPaymentMethod] = useState<"wallet" | "pi">("wallet");
  const [loanPaymentReference, setLoanPaymentReference] = useState("");
  const [loanAgreementAccepted, setLoanAgreementAccepted] = useState(false);
  const [loanApplicantName, setLoanApplicantName] = useState("");
  const [loanContactNumber, setLoanContactNumber] = useState("");
  const [loanAddressLine, setLoanAddressLine] = useState("");
  const [loanCity, setLoanCity] = useState("");
  const [loanCountry, setLoanCountry] = useState("");
  const [walletView, setWalletView] = useState<"personal" | "merchant">("personal");
  const [merchantMode, setMerchantMode] = useState<MerchantMode>("live");
  const [merchantBalances, setMerchantBalances] = useState<Record<MerchantMode, MerchantBalanceSnapshot | null>>({
    sandbox: null,
    live: null,
  });
  const [merchantActivity, setMerchantActivity] = useState<MerchantActivityEntry[]>([]);
  const [merchantSavingsAmount, setMerchantSavingsAmount] = useState("");
  const [merchantWithdrawAmount, setMerchantWithdrawAmount] = useState("");
  const [movingMerchantToSavings, setMovingMerchantToSavings] = useState(false);
  const [movingMerchantToWallet, setMovingMerchantToWallet] = useState(false);
  const [showMerchantFeatures, setShowMerchantFeatures] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [virtualCardNumber, setVirtualCardNumber] = useState("**** **** **** 4242");
  const [virtualCardActive, setVirtualCardActive] = useState(false);
  const [hideCardPreviewDetails, setHideCardPreviewDetails] = useState(false);
  const [buySpendAmount, setBuySpendAmount] = useState("");
  const buyFiatCurrency = "PI";
  const [buyOnrampProvider, setBuyOnrampProvider] = useState<BuyOnrampProvider>("Pi Payment");
  const [buyPaymentMethod, setBuyPaymentMethod] = useState<BuyPaymentMethod>("Pi Payment");
  const [showOnrampPicker, setShowOnrampPicker] = useState(false);
  const [showPaymentMethodPicker, setShowPaymentMethodPicker] = useState(false);
  const navigate = useNavigate();
  const { format: formatCurrency, currency } = useCurrency();
  const currencyLabel = currency.code === "OUSD" ? "OPEN USD" : currency.code;
  const piCurrencyLabel = currency.code === "OUSD" ? "OPEN USD" : `PI ${currency.code}`;
  const cardCurrencyLabel = currency.code === "PI" ? "PI" : currency.code === "OUSD" ? "OPEN USD" : `π ${currency.code}`;
  const currencyTag = currency.code === "PI" ? "PI" : `${currencyLabel} (Pi rate)`;
  const onboardingSteps = [
    {
      title: "Welcome to OpenPay",
      description: "Use OpenPay as a stable Pi payment experience for daily transfers and business payments.",
    },
    {
      title: "Send Fast and Safely",
      description: "Go to Pay to choose a contact, scan QR, review details, and confirm each transfer.",
    },
    {
      title: "Receive and Request",
      description: "Use Receive and Request Money to collect payments for goods, services, and personal transfers.",
    },
    {
      title: "Grow with Affiliate",
      description: "Invite users from the Affiliate page and claim rewards when your referrals sign up.",
    },
    {
      title: "Where OpenPay Works",
      description: "Open the new OpenPay Guide page to see use cases for restaurants, shops, clothing, and digital services.",
    },
  ];

  const loadSavingsAndLoan = useCallback(async () => {
    try {
      const [{ data: savingsData }, { data: loanData }, { data: creditScoreData }, { data: applicationData }, { data: paymentHistoryData }] = await Promise.all([
        supabase.rpc("get_my_savings_dashboard"),
        supabase.rpc("get_my_latest_loan"),
        (supabase as any).rpc("get_my_credit_score"),
        (supabase as any).rpc("get_my_latest_loan_application"),
        (supabase as any).rpc("get_my_loan_payment_history", { p_loan_id: null, p_limit: 24 }),
      ]);

      const savingsRow = Array.isArray(savingsData) ? savingsData[0] : null;
      const loanRow = Array.isArray(loanData) ? loanData[0] : null;

      setSavings(
        savingsRow
          ? {
              wallet_balance: Number(savingsRow.wallet_balance || 0),
              savings_balance: Number(savingsRow.savings_balance || 0),
              apy: Number(savingsRow.apy || 0),
            }
          : null,
      );

      setLoan(
        loanRow
          ? {
              id: String(loanRow.id),
              principal_amount: Number(loanRow.principal_amount || 0),
              outstanding_amount: Number(loanRow.outstanding_amount || 0),
              monthly_payment_amount: Number(loanRow.monthly_payment_amount || 0),
              monthly_fee_rate: Number(loanRow.monthly_fee_rate || 0),
              term_months: Number(loanRow.term_months || 0),
              paid_months: Number(loanRow.paid_months || 0),
              credit_score: Number(loanRow.credit_score || 0),
              status: String(loanRow.status || "none"),
              next_due_date: String(loanRow.next_due_date || ""),
              created_at: String(loanRow.created_at || ""),
            }
          : null,
      );

      const applicationRow = Array.isArray(applicationData) ? applicationData[0] : applicationData;
      setLoanApplication(
        applicationRow
          ? {
              id: String(applicationRow.id),
              requested_amount: Number(applicationRow.requested_amount || 0),
              requested_term_months: Number(applicationRow.requested_term_months || 0),
              credit_score_snapshot: Number(applicationRow.credit_score_snapshot || 0),
              full_name: String(applicationRow.full_name || ""),
              contact_number: String(applicationRow.contact_number || ""),
              address_line: String(applicationRow.address_line || ""),
              city: String(applicationRow.city || ""),
              country: String(applicationRow.country || ""),
              openpay_account_number: String(applicationRow.openpay_account_number || ""),
              openpay_account_username: String(applicationRow.openpay_account_username || ""),
              agreement_accepted: Boolean(applicationRow.agreement_accepted),
              status: (String(applicationRow.status || "pending") as LoanApplication["status"]),
              admin_note: String(applicationRow.admin_note || ""),
              created_at: String(applicationRow.created_at || ""),
              reviewed_at: applicationRow.reviewed_at ? String(applicationRow.reviewed_at) : null,
            }
          : null,
      );

      const historyRows = Array.isArray(paymentHistoryData) ? paymentHistoryData : [];
      setLoanPaymentHistory(
        historyRows.map((row: any) => ({
          id: String(row.id),
          loan_id: String(row.loan_id),
          amount: Number(row.amount || 0),
          principal_component: Number(row.principal_component || 0),
          fee_component: Number(row.fee_component || 0),
          payment_method: (String(row.payment_method || "wallet") as "wallet" | "pi"),
          payment_reference: row.payment_reference ? String(row.payment_reference) : null,
          note: String(row.note || ""),
          created_at: String(row.created_at || ""),
        })),
      );

      const parsedCreditScore = Number(
        Array.isArray(creditScoreData)
          ? creditScoreData[0]
          : creditScoreData,
      );
      setCreditScore(Number.isFinite(parsedCreditScore) ? parsedCreditScore : 0);
    } catch (error) {
      console.warn("Failed to load savings and loan data", error);
      toast.error("Unable to load savings and loan data");
      setSavings(null);
      setLoan(null);
      setLoanApplication(null);
      setLoanPaymentHistory([]);
      setCreditScore(0);
    }
  }, []);

  const loadMerchantActivity = useCallback(async (mode: MerchantMode) => {
    const db = supabase as unknown as {
      rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: MerchantActivityRpcRow[] | null }>;
    };
    const { data } = await db.rpc("get_my_merchant_activity", { p_mode: mode, p_limit: 10, p_offset: 0 });
    setMerchantActivity(
      (Array.isArray(data) ? data : []).map((row) => ({
        activity_id: String(row.activity_id || ""),
        activity_type: String(row.activity_type || "payment"),
        amount: Number(row.amount || 0),
        currency: String(row.currency || "USD"),
        status: String(row.status || "completed"),
        note: String(row.note || ""),
        created_at: String(row.created_at || ""),
        source: String(row.source || "merchant_portal"),
      })),
    );
  }, []);

  const loadDashboard = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRefreshing(false);
        navigate("/signin");
        return;
      }
      setUserId(user.id);
      const { count: unreadCount } = await supabase
        .from("app_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);
      setUnreadNotifications(Number(unreadCount || 0));

      const { data: claimResult } = await supabase.rpc("claim_welcome_bonus");
      if ((claimResult as { claimed?: boolean } | null)?.claimed) {
        toast.success("Welcome bonus claimed: +1 balance");
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, username, referral_code")
        .eq("id", user.id)
        .single();
      setUserName(profile?.full_name || "");
      setUsername(profile?.username || null);
      if (profile?.full_name) {
        setLoanApplicantName((current) => current || profile.full_name);
      }
      if (profile?.username) {
        setLoanContactNumber((current) => current || profile.username);
      }
      if (profile?.referral_code) {
        setAppCookie(`openpay_ref_code_${user.id}`, profile.referral_code);
      }

      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single();
      setBalance(wallet?.balance || 0);

      const { data: virtualCardRow } = await supabase
        .from("virtual_cards")
        .select("card_number, is_active")
        .eq("user_id", user.id)
        .maybeSingle();
      const cardNumberRaw = String(virtualCardRow?.card_number || "").replace(/\D/g, "");
      if (cardNumberRaw.length >= 4) {
        const grouped = cardNumberRaw.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
        setVirtualCardNumber(grouped);
      } else {
        setVirtualCardNumber("**** **** **** 4242");
      }
      setVirtualCardActive(Boolean(virtualCardRow?.is_active));

      const { data: accountData } = await supabase.rpc("upsert_my_user_account");
      setUserAccount(accountData as unknown as UserAccount);
      const normalizedAccount = accountData as unknown as UserAccount | null;
      if (normalizedAccount?.account_name) {
        setLoanApplicantName((current) => current || normalizedAccount.account_name);
      }
      if (normalizedAccount?.account_username) {
        setLoanContactNumber((current) => current || normalizedAccount.account_username);
      }

      const { data: savingsTransferRows } = await (supabase as any)
        .from("user_savings_transfers")
        .select("id, direction, amount, note, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (Array.isArray(savingsTransferRows)) {
        const recentSavingsTransfers: SavingsTransferActivity[] = savingsTransferRows
          .filter(
            (row: any) =>
              typeof row?.id === "string" &&
              (row?.direction === "wallet_to_savings" || row?.direction === "savings_to_wallet"),
          )
          .map((row: any) => ({
            id: String(row.id),
            direction: row.direction,
            amount: Number(row.amount || 0),
            note: String(row.note || ""),
            created_at: String(row.created_at || ""),
          }));
        setSavingsTransfers(recentSavingsTransfers);
      } else {
        setSavingsTransfers([]);
      }

      const { data: txs } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (txs) {
        const enriched = await Promise.all(
          txs.map(async (tx) => {
            const otherId = tx.sender_id === user.id ? tx.receiver_id : tx.sender_id;
            const { data: p } = await supabase
              .from("profiles")
              .select("full_name, username, avatar_url")
              .eq("id", otherId)
              .single();
            return {
              ...tx,
              other_name: p?.full_name || "Unknown",
              other_username: p?.username || null,
              other_avatar_url: p?.avatar_url || null,
              is_sent: tx.sender_id === user.id,
              is_topup: tx.sender_id === user.id && tx.receiver_id === user.id,
            };
          }),
        );
        setTransactions(enriched);
      }

      const agreementKey = `openpay_usage_agreement_v1_${user.id}`;
      const onboardingKey = `openpay_onboarding_done_v1_${user.id}`;
      const hideBalanceKey = `openpay_hide_balance_v1_${user.id}`;
      const refCookie = getAppCookie(`openpay_ref_code_${user.id}`) || getAppCookie("openpay_last_ref");
      let prefs = {
        hide_balance: false,
        usage_agreement_accepted: false,
        onboarding_completed: false,
        onboarding_step: 0,
      };
      try {
        const loadedPrefs = await loadUserPreferences(user.id);
        prefs = {
          hide_balance: loadedPrefs.hide_balance,
          usage_agreement_accepted: loadedPrefs.usage_agreement_accepted,
          onboarding_completed: loadedPrefs.onboarding_completed,
          onboarding_step: loadedPrefs.onboarding_step,
        };
        const remittanceRaw = loadedPrefs.merchant_onboarding_data?.remittance_center;
        const remittance =
          remittanceRaw && typeof remittanceRaw === "object" && !Array.isArray(remittanceRaw)
            ? (remittanceRaw as Record<string, unknown>)
            : {};
        setRemittanceFeeIncome(typeof remittance.totalFeeIncome === "number" ? remittance.totalFeeIncome : 0);
        setRemittanceMonthIncome(typeof remittance.thisMonthFeeIncome === "number" ? remittance.thisMonthFeeIncome : 0);
        setRemittanceTxCount(typeof remittance.totalRemittanceTxCount === "number" ? remittance.totalRemittanceTxCount : 0);
      } catch {
        setRemittanceFeeIncome(0);
        setRemittanceMonthIncome(0);
        setRemittanceTxCount(0);
      }

      const hasAcceptedAgreement =
        prefs.usage_agreement_accepted ||
        (typeof window !== "undefined" && localStorage.getItem(agreementKey) === "1");
      const hasFinishedOnboarding =
        prefs.onboarding_completed ||
        (typeof window !== "undefined" && localStorage.getItem(onboardingKey) === "1");
      const hideBalance =
        prefs.hide_balance ||
        (typeof window !== "undefined" && localStorage.getItem(hideBalanceKey) === "1");

      if (refCookie && !profile?.referral_code) {
        await upsertUserPreferences(user.id, { reference_code: refCookie }).catch(() => undefined);
      }

      setBalanceHidden(hideBalance);
      setOnboardingStep(prefs.onboarding_step || 0);
      await loadSavingsAndLoan();
      const [sandboxMerchantRes, liveMerchantRes] = await Promise.all([
        (supabase as any).rpc("get_my_merchant_balance_overview", { p_mode: "sandbox" }),
        (supabase as any).rpc("get_my_merchant_balance_overview", { p_mode: "live" }),
      ]);
      const toMerchantSnapshot = (row: any): MerchantBalanceSnapshot | null => {
        const payload = Array.isArray(row) ? row[0] : row;
        if (!payload) return null;
        return {
          gross_volume: Number(payload.gross_volume || 0),
          refunded_total: Number(payload.refunded_total || 0),
          transferred_total: Number(payload.transferred_total || 0),
          available_balance: Number(payload.available_balance || 0),
          wallet_balance: Number(payload.wallet_balance || 0),
          savings_balance: Number(payload.savings_balance || 0),
        };
      };
      setMerchantBalances({
        sandbox: sandboxMerchantRes.error ? null : toMerchantSnapshot(sandboxMerchantRes.data),
        live: liveMerchantRes.error ? null : toMerchantSnapshot(liveMerchantRes.data),
      });

      if (!hasAcceptedAgreement) {
        setShowAgreement(true);
        setShowOnboarding(false);
      } else if (!hasFinishedOnboarding) {
        setShowOnboarding(true);
      }
    } finally {
      setRefreshing(false);
    }
  }, [navigate, loadSavingsAndLoan]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!userId || walletView !== "merchant") return;
    void loadMerchantActivity(merchantMode);
  }, [userId, walletView, merchantMode, loadMerchantActivity]);

  useEffect(() => {
    if (!userId) return;

    const refreshUnread = async () => {
      const { count } = await supabase
        .from("app_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);
      setUnreadNotifications(Number(count || 0));
    };

    const channel = supabase
      .channel(`dashboard-unread-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshUnread();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    const sandbox = String(import.meta.env.VITE_PI_SANDBOX || "false").toLowerCase() === "true";
    const inPiBrowser =
      typeof navigator !== "undefined" &&
      /pi\s?browser/i.test(navigator.userAgent || "");

    const runPiAdAuto = async () => {
      if (typeof window === "undefined" || document.visibilityState !== "visible") return;
      if (!inPiBrowser) return;
      if (!window.Pi?.Ads?.showAd) return;
      if (Date.now() - lastAdRunAt < 5 * 60 * 1000) return;

      try {
        window.Pi.init({ version: "2.0", sandbox });

        if (window.Pi.nativeFeaturesList) {
          const features = await window.Pi.nativeFeaturesList();
          if (!features.includes("ad_network")) return;
        }

        const adResult = await window.Pi.Ads.showAd("rewarded");
        if (adResult.result !== "AD_REWARDED" || !adResult.adId) {
          setLastAdRunAt(Date.now());
          return;
        }

        await supabase.functions.invoke("pi-platform", {
          body: { action: "ad_verify", adId: adResult.adId },
        });
        setLastAdRunAt(Date.now());
      } catch {
        // Silent by design: auto ad trigger should not interrupt dashboard usage.
      }
    };

    const initialTimer = window.setTimeout(() => {
      void runPiAdAuto();
    }, 2500);
    const intervalTimer = window.setInterval(() => {
      void runPiAdAuto();
    }, 5 * 60 * 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, [lastAdRunAt]);

  const handleAcceptAgreement = () => {
    if (!userId || !agreementChecked) return;
    localStorage.setItem(`openpay_usage_agreement_v1_${userId}`, "1");
    setAppCookie(`openpay_usage_agreement_v1_${userId}`, "1");
    upsertUserPreferences(userId, { usage_agreement_accepted: true }).catch(() => undefined);
    setShowAgreement(false);
    if (localStorage.getItem(`openpay_onboarding_done_v1_${userId}`) !== "1") {
      setOnboardingStep(0);
      setShowOnboarding(true);
    }
  };

  const completeOnboarding = () => {
    if (!userId) return;
    localStorage.setItem(`openpay_onboarding_done_v1_${userId}`, "1");
    setAppCookie(`openpay_onboarding_done_v1_${userId}`, "1");
    upsertUserPreferences(userId, { onboarding_completed: true, onboarding_step: onboardingSteps.length - 1 }).catch(() => undefined);
    setShowOnboarding(false);
    setOnboardingStep(0);
  };

  const toggleBalanceHidden = () => {
    if (!userId) return;
    const next = !balanceHidden;
    setBalanceHidden(next);
    localStorage.setItem(`openpay_hide_balance_v1_${userId}`, next ? "1" : "0");
    setAppCookie(`openpay_hide_balance_v1_${userId}`, next ? "1" : "0");
    upsertUserPreferences(userId, { hide_balance: next }).catch(() => undefined);
  };

  const showReceipt = (tx: Transaction) => {
    setReceiptData({
      transactionId: tx.id,
      ledgerTransactionId: tx.id,
      type: tx.is_topup ? "topup" : tx.is_sent ? "send" : "receive",
      amount: tx.amount,
      otherPartyName: tx.other_name,
      otherPartyUsername: tx.other_username || undefined,
      note: tx.note || undefined,
      date: new Date(tx.created_at),
    });
    setReceiptOpen(true);
  };

  const copyAccountNumber = async () => {
    if (!userAccount?.account_number) return;
    try {
      await navigator.clipboard.writeText(userAccount.account_number);
      toast.success("Account number copied");
    } catch {
      toast.error("Unable to copy account number");
    }
  };

  const handleMoveWalletToSavings = async () => {
    const amount = Number(savingsAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setMovingToSavings(true);
    const { error } = await supabase.rpc("transfer_my_wallet_to_savings", {
      p_amount: amount,
      p_note: "Dashboard savings transfer",
    });
    setMovingToSavings(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSavingsAmount("");
    toast.success("Moved to savings");
    playUiSound("send");
    await loadDashboard();
  };

  const handleMoveSavingsToWallet = async () => {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setMovingToWallet(true);
    const { error } = await supabase.rpc("transfer_my_savings_to_wallet", {
      p_amount: amount,
      p_note: "Dashboard savings withdrawal",
    });
    setMovingToWallet(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setWithdrawAmount("");
    toast.success("Moved to wallet");
    playUiSound("receive");
    await loadDashboard();
  };

  const handleMoveMerchantToSavings = async () => {
    const amount = Number(merchantSavingsAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setMovingMerchantToSavings(true);
    const { error } = await (supabase as any).rpc("transfer_my_merchant_balance", {
      p_amount: amount,
      p_mode: merchantMode,
      p_destination: "savings",
      p_note: "Dashboard merchant transfer",
    });
    setMovingMerchantToSavings(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMerchantSavingsAmount("");
    toast.success("Moved to savings");
    playUiSound("send");
    await loadDashboard();
  };

  const handleMoveMerchantToWallet = async () => {
    const amount = Number(merchantWithdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setMovingMerchantToWallet(true);
    const { error } = await (supabase as any).rpc("transfer_my_merchant_balance", {
      p_amount: amount,
      p_mode: merchantMode,
      p_destination: "wallet",
      p_note: "Dashboard merchant transfer",
    });
    setMovingMerchantToWallet(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMerchantWithdrawAmount("");
    toast.success("Moved to wallet");
    playUiSound("receive");
    await loadDashboard();
  };

  const handleRequestLoan = async () => {
    const principal = Number(loanAmount);
    const term = Number(loanTermMonths);
    if (!Number.isFinite(principal) || principal <= 0) {
      toast.error("Enter a valid loan amount");
      return;
    }
    if (!Number.isFinite(term) || term < 1 || term > 60) {
      toast.error("Term must be between 1 and 60 months");
      return;
    }
    if (!loanAgreementAccepted) {
      toast.error("You must accept the loan agreement");
      return;
    }
    if (!loanApplicantName.trim() || !loanContactNumber.trim() || !loanAddressLine.trim() || !loanCity.trim() || !loanCountry.trim()) {
      toast.error("Complete all loan application details");
      return;
    }
    if (!userAccount?.account_number || !userAccount?.account_username) {
      toast.error("OpenPay account details not ready. Refresh and try again.");
      return;
    }
    setRequestingLoan(true);
    const { error } = await (supabase as any).rpc("submit_my_loan_application", {
      p_requested_amount: principal,
      p_requested_term_months: term,
      p_full_name: loanApplicantName.trim(),
      p_contact_number: loanContactNumber.trim(),
      p_address_line: loanAddressLine.trim(),
      p_city: loanCity.trim(),
      p_country: loanCountry.trim(),
      p_openpay_account_number: userAccount.account_number,
      p_openpay_account_username: userAccount.account_username,
      p_agreement_accepted: true,
    });
    setRequestingLoan(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLoanAmount("");
    toast.success("Loan application submitted for admin review");
    await loadDashboard();
  };

  const handlePayLoan = async () => {
    if (!loan?.id || loan.status !== "active") {
      toast.error("No active loan");
      return;
    }
    const payment = loanPaymentAmount ? Number(loanPaymentAmount) : null;
    if (loanPaymentAmount && (!Number.isFinite(payment) || Number(payment) <= 0)) {
      toast.error("Enter a valid payment amount");
      return;
    }
    if (loanPaymentMethod === "pi" && !loanPaymentReference.trim()) {
      toast.error("Enter Pi payment reference");
      return;
    }
    setPayingLoan(true);
    const { error } = await (supabase as any).rpc("pay_my_loan_monthly_with_method", {
      p_loan_id: loan.id,
      p_amount: payment,
      p_payment_method: loanPaymentMethod,
      p_payment_reference: loanPaymentMethod === "pi" ? loanPaymentReference.trim() : null,
      p_note: loanPaymentMethod === "pi" ? "Dashboard monthly loan payment (PI)" : "Dashboard monthly loan payment (wallet)",
    });
    setPayingLoan(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLoanPaymentAmount("");
    setLoanPaymentReference("");
    toast.success("Loan payment completed");
    await loadDashboard();
  };

  const selectedMerchantBalance = merchantBalances[merchantMode];
  const walletCardAmount = walletView === "personal"
    ? balance
    : Number(selectedMerchantBalance?.available_balance ?? 0);
  const [loanView, setLoanView] = useState<"overview" | "form">("overview");
  const availableToBorrow = Math.max(
    0,
    Number((savings?.wallet_balance ?? balance) || 0) + Number((savings?.savings_balance ?? 0) || 0),
  );
  const previewLoanAmount = Math.max(0, Number(loanAmount || 0) || 500);
  const previewTermDays = 30;
  const previewApr = 3.5;
  const previewRepayment = previewLoanAmount * (1 + (previewApr / 100) * (previewTermDays / 365));
  const creditScoreDisplay = loan?.credit_score ?? creditScore;
  const creditProgressPercent = Math.max(0, Math.min(100, (creditScoreDisplay / 900) * 100));
  const creditTopupCount = transactions.filter((tx) => tx.is_topup && tx.status === "completed").length;
  const creditSendCount = transactions.filter((tx) => tx.is_sent && !tx.is_topup && tx.status === "completed").length;
  const creditReceiveCount = transactions.filter((tx) => !tx.is_sent && !tx.is_topup && tx.status === "completed").length;
  const creditCheckoutCount = transactions.filter((tx) => String(tx.note || "").toLowerCase().includes("merchant checkout")).length;
  const creditActivityRows = [
    { key: "topup", label: "Buy activity", count: creditTopupCount, points: 3 },
    { key: "send", label: "Send activity", count: creditSendCount, points: 4 },
    { key: "receive", label: "Receive activity", count: creditReceiveCount, points: 3 },
    { key: "checkout", label: "Checkout activity", count: creditCheckoutCount, points: 4 },
  ];
  const parsedBuySpend = Number(buySpendAmount);
  const safeBuySpend = Number.isFinite(parsedBuySpend) && parsedBuySpend > 0 ? parsedBuySpend : 0;
  const isEwalletBuyFlow = buyPaymentMethod === "Ewallet";
  const onrampRates: Record<BuyOnrampProvider, number> = {
    "Pi Payment": 9.39,
    "Ewallet QR PH": 9.39,
    TransFi: 9.39,
    "Onramp Money": 10.13,
    Banxa: 9.8,
  };
  const selectedRate = 1;
  const buyOpenUsdAmount = safeBuySpend > 0 ? (isEwalletBuyFlow ? safeBuySpend / E_WALLET_PHP_PER_OUSD : safeBuySpend) : 0;
  const buyOpenUsdDisplay = buyOpenUsdAmount > 0 ? buyOpenUsdAmount.toFixed(6) : "0.000000";
  const buyOpenUsdMinimum = 1;
  const buyOpenUsdMeetsMinimum = buyOpenUsdAmount >= buyOpenUsdMinimum;
  const onrampRows: Array<{ key: BuyOnrampProvider; disabled?: boolean; subtitle: string; delta?: string; recommended?: boolean }> = [
    { key: "Pi Payment", subtitle: "Active", recommended: true },
    { key: "Ewallet QR PH", subtitle: "Active" },
    { key: "TransFi", subtitle: "Coming Soon", disabled: true },
    { key: "Onramp Money", subtitle: "Coming Soon", disabled: true },
    { key: "Banxa", subtitle: "Coming Soon", disabled: true },
  ];
  const paymentMethodRows: Array<{ key: BuyPaymentMethod; recommended?: boolean; disabled?: boolean }> = [
    { key: "Pi Payment", recommended: true },
    { key: "Ewallet" },
    { key: "Debit Card" },
    { key: "Credit Card" },
    { key: "Apple Pay" },
    { key: "Google Pay" },
    { key: "PayPal" },
    { key: "Stripe" },
    { key: "Venmo" },
  ];
  const supportedBuyPaymentMethods: BuyPaymentMethod[] = ["Pi Payment", "Ewallet"];
  const getBuyPaymentMethodLabel = (method: BuyPaymentMethod) => (method === "Ewallet" ? "Ewallet QR PH" : method);

  const handleBuyOpenUsd = () => {
    if (safeBuySpend <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!buyOpenUsdMeetsMinimum) {
      toast.error("Minimum buy is 1 OPEN USD");
      return;
    }
    if (!supportedBuyPaymentMethods.includes(buyPaymentMethod)) {
      toast.error("OpenUSD buy currently supports Pi Payment and Ewallet");
      return;
    }
    if (buyPaymentMethod === "Ewallet") {
      const phpAmountForTopUp = Math.max(0.01, Number(safeBuySpend.toFixed(2)));
      const openUsdAmountForTopUp = Math.max(0.01, Number((phpAmountForTopUp / E_WALLET_PHP_PER_OUSD).toFixed(6)));
      navigate(`/topup-ewallet-qrph?phpAmount=${phpAmountForTopUp.toFixed(2)}&openUsdAmount=${openUsdAmountForTopUp.toFixed(6)}`);
      return;
    }
    const amountForTopUp = Math.max(0.01, Number(buyOpenUsdAmount.toFixed(2)));
    navigate(`/topup?amount=${amountForTopUp.toFixed(2)}`);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-28">
      <div className="flex items-center justify-between px-4 pt-5">
        <CurrencySelector />
        <div className="flex gap-3">
          <button
            onClick={loadDashboard}
            aria-label="Refresh dashboard"
            className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full"
            disabled={refreshing}
          >
            <RefreshCw className={`h-5 w-5 text-foreground ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => navigate("/notifications")} aria-label="Open notifications" className="paypal-surface relative flex h-10 w-10 items-center justify-center rounded-full">
            <Bell className="h-5 w-5 text-foreground" />
            {unreadNotifications > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />}
          </button>
          <button onClick={() => navigate("/settings")} aria-label="Open settings" className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full">
            <Settings className="h-5 w-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Greeting */}
      <div className="px-4 mt-3">
        <h1 className="text-2xl font-bold text-foreground">
          {activeSection === "cards" ? "OpenPay Cards" : activeSection === "buy" ? "Buy OpenUSD" : `${getGreeting()}, ${userName.split(" ")[0] || "there"}!`}
        </h1>
        {activeSection !== "cards" && activeSection !== "buy" && username && <p className="text-sm text-muted-foreground">@{username}</p>}
      </div>

      <div className="mt-4 px-4">
        <div className="paypal-surface overflow-x-auto rounded-2xl p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-1">
            {([
              { key: "wallet", label: "Wallet" },
              { key: "savings", label: "Savings" },
              { key: "credit", label: "Credit" },
              { key: "loans", label: "Loans" },
              { key: "cards", label: "Cards" },
              { key: "buy", label: "Buy" },
            ] as Array<{ key: DashboardSection; label: string }>).map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeSection === item.key
                    ? "bg-paypal-blue text-white"
                    : "text-foreground hover:bg-secondary/70"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Display currency: {currencyTag}</p>
      </div>

      {activeSection === "savings" && (
        <div className="mx-4 mt-4 space-y-4">
          <div className="rounded-3xl border border-white/30 bg-gradient-to-br from-paypal-blue to-[#0073e6] p-6 shadow-xl shadow-[#004bba]/25">
            <div className="flex items-center gap-3 text-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <PiggyBank className="h-5 w-5" />
              </div>
              <div>
                <p className="text-3xl font-bold">{balanceHidden ? "****" : formatCurrency(savings?.savings_balance ?? 0)}</p>
                <p className="text-sm text-white/85">Savings balance</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-white/90 sm:grid-cols-3">
              <div className="rounded-xl bg-white/10 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-white/80">Wallet balance</p>
                <p className="text-sm font-semibold">{balanceHidden ? "****" : formatCurrency(savings?.wallet_balance ?? balance)}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-white/80">Savings balance</p>
                <p className="text-sm font-semibold">{balanceHidden ? "****" : formatCurrency(savings?.savings_balance ?? 0)}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-white/80">Estimated APY</p>
                <p className="text-sm font-semibold">{(savings?.apy ?? 0).toFixed(2)}%</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={toggleBalanceHidden}
                aria-label={balanceHidden ? "Show balance" : "Hide balance"}
                className="paypal-surface flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold text-foreground"
              >
                {balanceHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {balanceHidden ? "Show balance" : "Hide balance"}
              </button>
            </div>
          </div>

          <div className="paypal-surface rounded-3xl p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 p-3">
                <p className="mb-2 text-sm font-semibold">Move wallet to savings</p>
                <input value={savingsAmount} onChange={(e) => setSavingsAmount(e.target.value)} type="number" min="0" step="0.01" placeholder={`Amount (${currencyLabel})`} className="mb-2 h-10 w-full rounded-xl border border-border px-3" />
                <button disabled={movingToSavings} onClick={handleMoveWalletToSavings} className="h-10 w-full rounded-xl bg-paypal-blue text-sm font-semibold text-white">
                  {movingToSavings ? "Moving..." : "Move to Savings"}
                </button>
              </div>
              <div className="rounded-2xl border border-border/70 p-3">
                <p className="mb-2 text-sm font-semibold">Move savings to wallet</p>
                <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} type="number" min="0" step="0.01" placeholder={`Amount (${currencyLabel})`} className="mb-2 h-10 w-full rounded-xl border border-border px-3" />
                <button disabled={movingToWallet} onClick={handleMoveSavingsToWallet} className="h-10 w-full rounded-xl border border-paypal-blue/40 bg-white text-sm font-semibold text-paypal-blue">
                  {movingToWallet ? "Moving..." : "Move to Wallet"}
                </button>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-border/70 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Recent savings activity</p>
                {savingsTransfers.length > 0 && <p className="text-xs text-muted-foreground">{savingsTransfers.length} latest</p>}
              </div>
              {savingsTransfers.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">No savings activity yet.</p>
              ) : (
                <div className="divide-y divide-border/70 rounded-xl border border-border/70">
                  {savingsTransfers.map((entry) => {
                    const isWalletToSavings = entry.direction === "wallet_to_savings";
                    const directionLabel = isWalletToSavings ? "Move wallet to savings" : "Move savings to wallet";
                    return (
                      <div key={entry.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-foreground">{directionLabel}</p>
                          <p className="text-xs text-muted-foreground">{entry.created_at ? format(new Date(entry.created_at), "MMM d, yyyy h:mm a") : "-"}</p>
                          {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
                        </div>
                        <p className={`text-sm font-semibold ${isWalletToSavings ? "text-paypal-success" : "text-paypal-blue"}`}>
                          {balanceHidden ? "****" : `${isWalletToSavings ? "+" : "-"}${formatCurrency(entry.amount)}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSection === "credit" && (
        <div className="mx-4 mt-4 space-y-4">
          <div className="paypal-surface rounded-3xl p-4">
            <div className="rounded-2xl bg-gradient-to-br from-paypal-blue to-[#2f67dc] p-4 text-white shadow-xl shadow-[#004bba]/25">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-white" />
                <h2 className="text-xl font-bold">Credit Overview</h2>
              </div>
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                {currencyTag}
              </span>
            </div>

            <div className="mt-4 rounded-2xl bg-white p-4 text-paypal-dark">
              <p className="text-sm text-muted-foreground">Credit score</p>
              <p className="mt-1 text-5xl font-bold">{creditScoreDisplay}</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${creditProgressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Credit starts at 0 for new accounts and grows from OpenPay activity.
              </p>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-white/15 p-3">
                <p className="text-xs text-white/75">Status</p>
                <p className="mt-1 text-sm font-semibold text-white">{creditScoreDisplay >= 120 ? "Loan-ready profile" : "Building profile"}</p>
              </div>
              <div className="rounded-xl bg-white/15 p-3">
                <p className="text-xs text-white/75">Range</p>
                <p className="mt-1 text-sm font-semibold text-white">0 - 900</p>
              </div>
              <div className="rounded-xl bg-white/15 p-3">
                <p className="text-xs text-white/75">Loan unlock</p>
                <p className="mt-1 text-sm font-semibold text-white">{creditScoreDisplay} / 120</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-white/15 p-4 text-sm text-white/90">
              Credit uses send, receive, buy, checkout, invoice, and request activity.
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => navigate("/send")}
                className="h-11 rounded-full bg-white text-paypal-blue text-sm font-semibold"
              >
                Pay
              </button>
              <button
                type="button"
                onClick={() => navigate("/receive")}
                className="h-11 rounded-full bg-white/10 text-sm font-semibold text-white"
              >
                Receive
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("buy")}
                className="h-11 rounded-full bg-white/10 text-sm font-semibold text-white"
              >
                Buy
              </button>
            </div>
            </div>
          </div>

          <div className="paypal-surface rounded-3xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Credit score activity</h3>
              <span className="text-xs font-semibold text-muted-foreground">From recent activity</span>
            </div>
            <div className="divide-y divide-border/70 rounded-2xl border border-border/70">
              {creditActivityRows.map((row) => (
                <div key={row.key} className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.count} actions</p>
                  </div>
                  <p className="text-sm font-semibold text-paypal-blue">+{row.count * row.points} pts</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSection === "loans" && (
        <div className="mx-4 mt-4 paypal-surface rounded-3xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-paypal-blue" />
            <h2 className="text-lg font-bold text-paypal-dark">Loans</h2>
          </div>
          {loanView === "overview" ? (
            <div className="rounded-2xl border border-border/70 p-4">
              <div className="rounded-2xl bg-gradient-to-br from-paypal-blue to-[#3b79ef] p-5 text-white">
                <p className="text-sm text-white/85">Available to borrow</p>
                <p className="mt-1 text-3xl font-bold">{balanceHidden ? "****" : formatCurrency(availableToBorrow)}</p>
                <p className="mt-1 text-sm text-white/85">Based on your wallet & savings balance</p>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-3">
                  <span className="text-base text-muted-foreground">Loan amount</span>
                  <span className="text-xl font-semibold text-foreground">{formatCurrency(previewLoanAmount)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-3">
                  <span className="text-base text-muted-foreground">Interest rate</span>
                  <span className="text-xl font-semibold text-emerald-600">{previewApr.toFixed(1)}% APR</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-3">
                  <span className="text-base text-muted-foreground">Term</span>
                  <span className="text-xl font-semibold text-foreground">{previewTermDays} days</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-paypal-blue/35 bg-paypal-blue/5 px-4 py-3">
                  <span className="text-lg font-semibold text-foreground">Total repayment</span>
                  <span className="text-xl font-semibold text-paypal-blue">{formatCurrency(previewRepayment)}</span>
                </div>
              </div>

              <input
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder={`Enter loan amount (${currencyLabel})`}
                className="mt-4 h-12 w-full rounded-xl border border-border px-3 text-sm text-foreground"
              />
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-paypal-blue">
                <span className="h-2 w-2 rounded-full bg-paypal-blue" />
                Coming Soon
              </div>
              <button
                type="button"
                onClick={() => setLoanView("form")}
                className="mt-4 h-12 w-full rounded-xl bg-[#7a9de8] text-lg font-semibold text-white transition hover:bg-[#6b90e0]"
              >
                Apply for Loan
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/70 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Loan onboarding form</p>
                <button type="button" onClick={() => setLoanView("overview")} className="text-xs font-semibold text-paypal-blue">
                  Back to preview
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Provide accurate details. This application is reviewed by OpenPay admin before approval.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Loan amount ({currencyLabel})</span>
                  <input value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="e.g. 500" className="h-10 w-full rounded-xl border border-border px-3 text-sm text-foreground" />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Term months (1 - 60)</span>
                  <input value={loanTermMonths} onChange={(e) => setLoanTermMonths(e.target.value)} type="number" min="1" max="60" placeholder="e.g. 6" className="h-10 w-full rounded-xl border border-border px-3 text-sm text-foreground" />
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Full legal name</span>
                  <input value={loanApplicantName} onChange={(e) => setLoanApplicantName(e.target.value)} placeholder="Enter full name" className="h-10 w-full rounded-xl border border-border px-3 text-sm text-foreground" />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Contact number</span>
                  <input value={loanContactNumber} onChange={(e) => setLoanContactNumber(e.target.value)} placeholder="Phone or active contact number" className="h-10 w-full rounded-xl border border-border px-3 text-sm text-foreground" />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground sm:col-span-2">
                  <span>Address line</span>
                  <input value={loanAddressLine} onChange={(e) => setLoanAddressLine(e.target.value)} placeholder="Street / building / district" className="h-10 w-full rounded-xl border border-border px-3 text-sm text-foreground" />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>City</span>
                  <input value={loanCity} onChange={(e) => setLoanCity(e.target.value)} placeholder="Enter city" className="h-10 w-full rounded-xl border border-border px-3 text-sm text-foreground" />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Country</span>
                  <input value={loanCountry} onChange={(e) => setLoanCountry(e.target.value)} placeholder="Enter country" className="h-10 w-full rounded-xl border border-border px-3 text-sm text-foreground" />
                </label>
              </div>
              <div className="mt-3 rounded-xl border border-border/70 bg-secondary/30 p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Bound OpenPay account</p>
                <p className="mt-1">Account number: {userAccount?.account_number || "-"}</p>
                <p>Username: {userAccount?.account_username ? `@${userAccount.account_username}` : "-"}</p>
              </div>
              <label className="mt-3 flex items-start gap-2 text-xs text-foreground">
                <input type="checkbox" className="mt-0.5" checked={loanAgreementAccepted} onChange={(e) => setLoanAgreementAccepted(e.target.checked)} />
                <span>I agree to OpenPay loan terms and confirm my application details are real and accurate.</span>
              </label>
              <button
                disabled={requestingLoan || loanApplication?.status === "pending"}
                onClick={handleRequestLoan}
                className="mt-3 h-10 w-full rounded-xl bg-paypal-blue text-sm font-semibold text-white disabled:opacity-60"
              >
                {requestingLoan ? "Submitting..." : "Submit Loan Application"}
              </button>
            </div>
          )}
          <div className="mt-3 rounded-2xl border border-border/70 p-3">
            <p className="mb-2 text-sm font-semibold">Pay monthly installment</p>
            <input value={loanPaymentAmount} onChange={(e) => setLoanPaymentAmount(e.target.value)} type="number" min="0" step="0.01" placeholder={`Default: ${loan ? formatCurrency(loan.monthly_payment_amount) : `monthly due (${currencyLabel})`}`} className="h-10 w-full rounded-xl border border-border px-3" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLoanPaymentMethod("wallet")}
                className={`h-10 rounded-xl border text-sm font-semibold ${loanPaymentMethod === "wallet" ? "border-paypal-blue bg-paypal-blue text-white" : "border-border bg-white text-foreground"}`}
              >
                OpenPay Balance
              </button>
              <button
                type="button"
                onClick={() => setLoanPaymentMethod("pi")}
                className={`h-10 rounded-xl border text-sm font-semibold ${loanPaymentMethod === "pi" ? "border-paypal-blue bg-paypal-blue text-white" : "border-border bg-white text-foreground"}`}
              >
                Pi Payment
              </button>
            </div>
            {loanPaymentMethod === "pi" && (
              <input
                value={loanPaymentReference}
                onChange={(e) => setLoanPaymentReference(e.target.value)}
                placeholder="Pi payment reference (required)"
                className="mt-2 h-10 w-full rounded-xl border border-border px-3"
              />
            )}
            <button disabled={payingLoan || !loan || loan.status !== "active"} onClick={handlePayLoan} className="mt-2 h-10 w-full rounded-xl border border-paypal-blue/40 bg-white text-sm font-semibold text-paypal-blue">
              {payingLoan ? "Paying..." : "Pay Loan"}
            </button>
          </div>
          <div className="mt-3 rounded-2xl border border-border/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Loan payment history</p>
              <p className="text-xs text-muted-foreground">{loanPaymentHistory.length} records</p>
            </div>
            {loanPaymentHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No loan payments yet.</p>
            ) : (
              <div className="divide-y divide-border/70 rounded-xl border border-border/70">
                {loanPaymentHistory.map((entry) => (
                  <div key={entry.id} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{formatCurrency(entry.amount)}</p>
                      <p className="text-xs uppercase text-muted-foreground">{entry.payment_method}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Principal {formatCurrency(entry.principal_component)} | Fee {formatCurrency(entry.fee_component)}
                    </p>
                    {entry.payment_reference && <p className="text-xs text-muted-foreground">Ref: {toPreviewText(entry.payment_reference, 44)}</p>}
                    <p className="text-xs text-muted-foreground">{entry.created_at ? format(new Date(entry.created_at), "MMM d, yyyy h:mm a") : "-"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === "cards" && (
        <div className="mx-4 mt-4 space-y-4">
        <div className="paypal-surface rounded-3xl p-4">
          <div className="rounded-2xl bg-gradient-to-br from-paypal-blue to-[#2f67dc] p-4 text-white shadow-xl shadow-[#004bba]/25">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xl font-semibold">OpenPay Cards</p>
            </div>
            <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
              {cardCurrencyLabel}
            </span>
          </div>

          <div className="mt-4 rounded-2xl bg-white/10 p-4">
            <p className="text-sm text-white/80">Virtual Card</p>
            <p className="mt-2 text-2xl font-semibold tracking-[0.12em]">
              {hideCardPreviewDetails ? "**** **** **** ****" : virtualCardNumber}
            </p>
            <p className="mt-2 text-sm text-white/80">
              {hideCardPreviewDetails ? "Card details hidden" : `Linked to wallet · ${virtualCardActive ? "Active" : "Inactive"}`}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => navigate("/send")}
              className="h-11 rounded-full bg-white text-paypal-blue text-sm font-semibold"
            >
              Pay
            </button>
            <button
              type="button"
              onClick={() => navigate("/receive")}
              className="h-11 rounded-full bg-white/10 text-sm font-semibold text-white"
            >
              Receive
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("buy")}
              className="h-11 rounded-full bg-white/10 text-sm font-semibold text-white"
            >
              Buy
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setHideCardPreviewDetails((prev) => !prev)}
              className="h-10 w-full rounded-xl border border-white/40 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {hideCardPreviewDetails ? "View Details" : "Hide Details"}
            </button>
            <button
              onClick={() => navigate("/virtual-card")}
              className="h-10 w-full rounded-xl bg-white text-sm font-semibold text-paypal-blue transition hover:bg-white/90"
            >
              Open Virtual Card
            </button>
          </div>
          </div>
        </div>
        <div className="paypal-surface rounded-3xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground">Card activity history</h3>
            <button
              type="button"
              onClick={() => navigate("/activity")}
              className="text-xs font-semibold text-paypal-blue"
            >
              See all
            </button>
          </div>
          <div className="divide-y divide-border/70 rounded-2xl border border-border/70">
            {transactions
              .filter((tx) => {
                const note = String(tx.note || "").toLowerCase();
                return note.includes("merchant checkout") || note.includes("virtual card") || note.includes("card ****");
              })
              .slice(0, 6)
              .map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{toPreviewText(tx.note || "Card payment", 44)}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(tx.created_at), "MMM d, yyyy h:mm a")}</p>
                  </div>
                  <p className={`ml-3 text-sm font-semibold ${tx.is_sent && !tx.is_topup ? "text-red-500" : "text-paypal-success"}`}>
                    {balanceHidden ? "****" : `${tx.is_sent && !tx.is_topup ? "-" : "+"}${formatCurrency(tx.amount)}`}
                  </p>
                </div>
              ))}
            {transactions.filter((tx) => {
              const note = String(tx.note || "").toLowerCase();
              return note.includes("merchant checkout") || note.includes("virtual card") || note.includes("card ****");
            }).length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No card activity yet.</p>}
          </div>
        </div>
        </div>
      )}

      {activeSection === "buy" && (
        <div className="mx-4 mt-4 space-y-4">
          <div className="paypal-surface rounded-3xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xl font-semibold text-foreground">Onramper</p>
              <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold text-muted-foreground">Buy OpenUSD</span>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl bg-secondary/50 p-4">
                <p className="text-sm text-muted-foreground">You spend ({isEwalletBuyFlow ? "PHP" : "PI"} amount)</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <input
                    value={buySpendAmount}
                    onChange={(e) => setBuySpendAmount(e.target.value)}
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder={isEwalletBuyFlow ? "Custom amount in PHP (min 57)" : "Custom amount (min 1)"}
                    className="h-10 w-full bg-transparent text-4xl font-semibold text-foreground outline-none"
                  />
                  <span className="inline-flex h-11 items-center rounded-xl bg-white px-3 text-sm font-semibold text-foreground">
                    {isEwalletBuyFlow ? "PHP" : buyFiatCurrency}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-foreground">{isEwalletBuyFlow ? `${E_WALLET_PHP_PER_OUSD.toFixed(2)} PHP = 1 OPEN USD` : "1 PI = 1 OPEN USD"}</p>
              </div>

              <div className="rounded-2xl bg-secondary/50 p-4">
                <p className="text-sm text-muted-foreground">You get (OPEN USD amount)</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-4xl font-semibold text-foreground">{buyOpenUsdDisplay}</p>
                  <span className="inline-flex h-11 items-center rounded-xl bg-white px-3 text-sm font-semibold text-foreground">OPEN USD</span>
                </div>
                <p className="mt-2 text-xs font-medium text-foreground">1 OPEN USD = 1 USD stable coin</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-sm text-muted-foreground">
                  <p>1 OUSD ~ {isEwalletBuyFlow ? `${E_WALLET_PHP_PER_OUSD.toFixed(4)} PHP` : `${selectedRate.toFixed(4)} PI`}</p>
                  <button
                    type="button"
                    onClick={() => setShowOnrampPicker(true)}
                    className="inline-flex items-center gap-1 font-semibold text-foreground"
                  >
                    By {buyOnrampProvider}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-4 text-base text-foreground">Pay using</p>
            <button
              type="button"
              onClick={() => setShowPaymentMethodPicker(true)}
              className="mt-2 flex h-14 w-full items-center justify-between rounded-2xl border border-border/70 bg-white px-4"
            >
              <span className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
                {buyPaymentMethod === "Pi Payment" && (
                  <img src={PI_PAYMENT_ICON_URL} alt="Pi Payment" className="h-5 w-5 rounded-full object-cover" />
                )}
                {buyPaymentMethod === "Ewallet" && (
                  <img src={JQRPH_ICON_URL} alt="JQRPh" className="h-5 w-auto object-contain" />
                )}
                {getBuyPaymentMethodLabel(buyPaymentMethod)}
              </span>
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={handleBuyOpenUsd}
              disabled={!buyOpenUsdMeetsMinimum}
              className="mt-3 h-11 w-full rounded-xl bg-paypal-blue text-sm font-semibold text-white hover:bg-[#004dc5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {buyPaymentMethod === "Ewallet" ? "Buy OpenUSD with Ewallet QR PH" : "Buy OpenUSD with Pi Payment"}
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              Minimum buy: 1 OPEN USD. {isEwalletBuyFlow ? `Ewallet QR PH uses PH price: 1 OPEN USD = ${E_WALLET_PHP_PER_OUSD.toFixed(2)} PHP.` : "Purchase flow uses OpenPay Pi buy and credits OPEN USD balance."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Stable mode enabled: 1 PI = 1 OPEN USD.
            </p>
          </div>
        </div>
      )}

      {activeSection === "wallet" && (
      <>
      <div className="mx-4 mt-4 rounded-3xl border border-white/30 bg-gradient-to-br from-paypal-blue to-[#0073e6] p-6 shadow-xl shadow-[#004bba]/25">
        <div className="mb-4 inline-flex rounded-full bg-white/15 p-1">
          <button
            type="button"
            onClick={() => setWalletView("personal")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              walletView === "personal" ? "bg-white text-paypal-blue" : "text-white/90 hover:bg-white/10"
            }`}
          >
            Personal wallet
          </button>
          <button
            type="button"
            onClick={() => setWalletView("merchant")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              walletView === "merchant" ? "bg-white text-paypal-blue" : "text-white/90 hover:bg-white/10"
            }`}
          >
            Merchant wallet
          </button>
        </div>

        {walletView === "merchant" && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full bg-white/15 p-1">
              <button
                type="button"
                onClick={() => setMerchantMode("sandbox")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  merchantMode === "sandbox" ? "bg-white text-paypal-blue" : "text-white/90 hover:bg-white/10"
                }`}
              >
                Sandbox
              </button>
              <button
                type="button"
                onClick={() => setMerchantMode("live")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  merchantMode === "live" ? "bg-white text-paypal-blue" : "text-white/90 hover:bg-white/10"
                }`}
              >
                Live
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowMerchantFeatures(true)}
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/25"
            >
              <Store className="h-3.5 w-3.5" />
              Merchant features
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 text-white">
          <BrandLogo className="h-8 w-8" />
          <div>
            <p className="text-3xl font-bold">{balanceHidden ? "****" : formatCurrency(walletCardAmount)}</p>
            <p className="text-sm text-white/85">
              {walletView === "personal"
                ? `Balance - ${currency.code === "PI" ? "PI" : piCurrencyLabel}`
                : `Merchant available (${merchantMode})`}
            </p>
          </div>
        </div>

        {walletView === "merchant" && (
          <div className="mt-4 grid gap-2 text-white/90 sm:grid-cols-3">
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-white/80">Incoming</p>
              <p className="text-sm font-semibold">{balanceHidden ? "****" : formatCurrency(Number(selectedMerchantBalance?.gross_volume ?? 0))}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-white/80">Refunded</p>
              <p className="text-sm font-semibold">{balanceHidden ? "****" : formatCurrency(Number(selectedMerchantBalance?.refunded_total ?? 0))}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-white/80">Transferred out</p>
              <p className="text-sm font-semibold">{balanceHidden ? "****" : formatCurrency(Number(selectedMerchantBalance?.transferred_total ?? 0))}</p>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={toggleBalanceHidden}
            aria-label={balanceHidden ? "Show balance" : "Hide balance"}
            className="paypal-surface flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold text-foreground"
          >
            {balanceHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {balanceHidden ? "Show balance" : "Hide balance"}
          </button>
        </div>
      </div>
      {walletView === "merchant" && (
        <div className="mx-4 mt-4 paypal-surface rounded-3xl p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 p-3">
              <p className="mb-2 text-sm font-semibold">Move merchant balance to savings</p>
              <input
                value={merchantSavingsAmount}
                onChange={(e) => setMerchantSavingsAmount(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder={`Amount (${currencyLabel})`}
                className="mb-2 h-10 w-full rounded-xl border border-border px-3"
              />
              <button
                disabled={movingMerchantToSavings}
                onClick={handleMoveMerchantToSavings}
                className="h-10 w-full rounded-xl bg-paypal-blue text-sm font-semibold text-white"
              >
                {movingMerchantToSavings ? "Moving..." : "Move to Savings"}
              </button>
            </div>
            <div className="rounded-2xl border border-border/70 p-3">
              <p className="mb-2 text-sm font-semibold">Move merchant balance to wallet</p>
              <input
                value={merchantWithdrawAmount}
                onChange={(e) => setMerchantWithdrawAmount(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder={`Amount (${currencyLabel})`}
                className="mb-2 h-10 w-full rounded-xl border border-border px-3"
              />
              <button
                disabled={movingMerchantToWallet}
                onClick={handleMoveMerchantToWallet}
                className="h-10 w-full rounded-xl border border-paypal-blue/40 bg-white text-sm font-semibold text-paypal-blue"
              >
                {movingMerchantToWallet ? "Moving..." : "Move to Wallet"}
              </button>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-border/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Recent merchant activity</p>
              {merchantActivity.length > 0 && <p className="text-xs text-muted-foreground">{merchantActivity.length} latest</p>}
            </div>
            {merchantActivity.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No merchant activity yet.</p>
            ) : (
              <div className="divide-y divide-border/70 rounded-xl border border-border/70">
                {merchantActivity.map((entry) => {
                  const isOutflow = ["refund", "transfer_to_wallet", "transfer_to_savings"].includes(entry.activity_type);
                  const label =
                    entry.activity_type === "payment"
                      ? "Merchant payment"
                      : entry.activity_type === "refund"
                        ? "Merchant refund"
                        : entry.activity_type === "transfer_to_wallet"
                          ? "Move merchant balance to wallet"
                          : entry.activity_type === "transfer_to_savings"
                            ? "Move merchant balance to savings"
                            : entry.activity_type.replaceAll("_", " ");
                  const detailLine = entry.note || `${entry.status} · ${entry.source}`;
                  const previewDetail = detailLine ? toPreviewText(detailLine, 64) : "";
                  return (
                    <div key={entry.activity_id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3 sm:justify-start">
                          <p className="text-sm font-medium text-foreground">{label}</p>
                          <p className={`text-sm font-semibold ${isOutflow ? "text-paypal-blue" : "text-paypal-success"} sm:hidden`}>
                            {balanceHidden ? "****" : `${isOutflow ? "-" : "+"}${formatCurrency(entry.amount)}`}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">{entry.created_at ? format(new Date(entry.created_at), "MMM d, yyyy h:mm a") : "-"}</p>
                        {previewDetail && <p className="text-xs text-muted-foreground break-words">{previewDetail}</p>}
                      </div>
                      <p className={`hidden text-sm font-semibold sm:block ${isOutflow ? "text-paypal-blue" : "text-paypal-success"}`}>
                        {balanceHidden ? "****" : `${isOutflow ? "-" : "+"}${formatCurrency(entry.amount)}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {userAccount && (
        <div className="mx-4 mt-4 paypal-surface rounded-3xl p-4">
          <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">OpenPay Account</p>
              <p className="mt-1 text-base font-bold text-foreground">{userAccount.account_name}</p>
              <p className="text-sm text-muted-foreground">@{userAccount.account_username}</p>
              <p className="mt-2 break-all text-sm font-mono text-foreground">{userAccount.account_number}</p>
            </div>
            <button
              type="button"
              onClick={copyAccountNumber}
              className="w-full rounded-xl border border-border/70 bg-white px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary sm:w-auto"
            >
              <Copy className="mr-1 inline h-4 w-4" />
              Copy
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => navigate("/virtual-card")}
              className="w-full rounded-xl bg-paypal-blue px-3 py-2 text-sm font-semibold text-white hover:bg-[#004dc5] sm:w-auto"
            >
              Open Virtual Card
            </button>
          </div>
        </div>
      )}

      {remittanceUiEnabled && (
        <div className="mx-4 mt-4 grid gap-3 sm:grid-cols-3">
          <div className="paypal-surface rounded-2xl p-3">
            <p className="text-xs text-muted-foreground">Remittance fee income</p>
            <p className="mt-1 text-xl font-bold text-foreground">{balanceHidden ? "****" : formatCurrency(remittanceFeeIncome)}</p>
          </div>
          <div className="paypal-surface rounded-2xl p-3">
            <p className="text-xs text-muted-foreground">This month</p>
            <p className="mt-1 text-xl font-bold text-foreground">{balanceHidden ? "****" : formatCurrency(remittanceMonthIncome)}</p>
          </div>
          <button
            onClick={() => navigate("/remittance-merchant")}
            className="paypal-surface rounded-2xl p-3 text-left transition hover:bg-secondary/50"
          >
            <p className="text-xs text-muted-foreground">Remittance records</p>
            <p className="mt-1 text-xl font-bold text-foreground">{remittanceTxCount}</p>
            <p className="text-xs font-medium text-paypal-blue">Manage center</p>
          </button>
        </div>
      )}

      <div className="mt-6 px-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-paypal-dark">Recent activity</h2>
          <button onClick={() => navigate("/activity")} className="text-sm font-semibold text-paypal-blue">See more →</button>
        </div>

        {transactions.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No transactions yet</p>
        ) : (
          <div className="paypal-surface divide-y divide-border/70 rounded-3xl">
            {transactions.map((tx) => (
              <button key={tx.id} onClick={() => showReceipt(tx)} className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/40 transition">
                <div className="flex items-center gap-3">
                  {tx.other_avatar_url ? (
                    <img
                      src={tx.other_avatar_url}
                      alt={tx.other_name || "Profile"}
                      className="h-10 w-10 rounded-full border border-paypal-light-blue/50 object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-paypal-light-blue/50 bg-secondary">
                      <span className="text-xs font-bold text-secondary-foreground">
                        {tx.other_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-foreground">{tx.other_name}</p>
                    {tx.other_username && <p className="text-xs text-muted-foreground">@{tx.other_username}</p>}
                    <p className="text-xs text-muted-foreground">{format(new Date(tx.created_at), "MMM d, yyyy")}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.is_topup ? "Buy" : tx.is_sent ? "Payment" : "Received"}
                    </p>
                    {tx.note && <p className="text-xs text-muted-foreground">{toPreviewText(tx.note)}</p>}
                  </div>
                </div>
                <p className={`font-semibold ${tx.is_sent && !tx.is_topup ? "text-red-500" : "text-paypal-success"}`}>
                  {balanceHidden ? "****" : `${tx.is_topup ? "+" : tx.is_sent ? "-" : "+"}${formatCurrency(tx.amount)}`}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-24 left-0 right-0 overflow-x-hidden px-4 pb-1">
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/contacts")}
            className="flex h-[54px] w-[54px] items-center justify-center rounded-full border border-paypal-blue/25 bg-white text-paypal-blue"
            aria-label="Open contacts"
          >
            <Users className="h-6 w-6" />
          </button>
          <button onClick={() => navigate("/send")} className="min-w-0 flex-1 rounded-full bg-paypal-blue py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-[#0057d8]/30">Pay</button>
          <button onClick={() => setShowReceiveOptions(true)} className="min-w-0 flex-1 rounded-full border border-paypal-blue/25 bg-white py-3.5 text-center text-sm font-semibold text-paypal-blue">Receive</button>
          <button onClick={() => setActiveSection("buy")} className="min-w-0 flex-1 rounded-full border border-paypal-blue/25 bg-white py-3.5 text-center text-sm font-semibold text-paypal-blue">Buy</button>
        </div>
      </div>
      </>
      )}

      <BottomNav active="home" />
      <TransactionReceipt open={receiptOpen} onOpenChange={setReceiptOpen} receipt={receiptData} />

      <Dialog open={showReceiveOptions} onOpenChange={setShowReceiveOptions}>
        <DialogContent className="top-auto bottom-0 translate-y-0 rounded-b-none rounded-t-3xl px-5 pb-7 pt-5 sm:max-w-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0">
          <DialogTitle className="text-center text-2xl font-bold text-foreground">Ways to get paid</DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Choose how you want to receive payment.
          </DialogDescription>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <button
              onClick={() => {
                setShowReceiveOptions(false);
                navigate("/receive");
              }}
              className="rounded-2xl border border-border/70 bg-secondary/50 p-3 text-center transition hover:bg-secondary"
            >
              <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-white">
                <QrCode className="h-5 w-5 text-paypal-blue" />
              </div>
              <p className="text-sm font-semibold text-foreground">Receive</p>
            </button>
            <button
              onClick={() => {
                setShowReceiveOptions(false);
                navigate("/request-payment");
              }}
              className="rounded-2xl border border-border/70 bg-secondary/50 p-3 text-center transition hover:bg-secondary"
            >
              <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-white">
                <CircleDollarSign className="h-5 w-5 text-paypal-blue" />
              </div>
              <p className="text-sm font-semibold text-foreground">Request</p>
            </button>
            <button
              onClick={() => {
                setShowReceiveOptions(false);
                navigate("/send-invoice");
              }}
              className="rounded-2xl border border-border/70 bg-secondary/50 p-3 text-center transition hover:bg-secondary"
            >
              <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-white">
                <FileText className="h-5 w-5 text-paypal-blue" />
              </div>
              <p className="text-sm font-semibold text-foreground">Invoice</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMerchantFeatures} onOpenChange={setShowMerchantFeatures}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogTitle className="text-xl font-bold text-foreground">Merchant features</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Open merchant tools quickly from dashboard.
          </DialogDescription>
          <div className="mt-2 grid gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start rounded-xl"
              onClick={() => {
                setShowMerchantFeatures(false);
                navigate("/merchant-onboarding");
              }}
            >
              Merchant Portal
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start rounded-xl"
              onClick={() => {
                setShowMerchantFeatures(false);
                navigate("/merchant-pos");
              }}
            >
              POS
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start rounded-xl"
              onClick={() => {
                setShowMerchantFeatures(false);
                navigate("/payment-links/create");
              }}
            >
              Checkout Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOnrampPicker} onOpenChange={setShowOnrampPicker}>
        <DialogContent className="top-auto bottom-0 translate-y-0 rounded-b-none rounded-t-3xl px-5 pb-7 pt-5 sm:max-w-lg">
          <DialogTitle className="text-center text-2xl font-bold text-foreground">Choose onramp</DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Select the provider for your OpenUSD buy quote.
          </DialogDescription>
          <p className="mt-1 text-center text-xs font-medium text-foreground">
            Conversion: 1 PI = 1 OPEN USD | 57 PHP = 1 OPEN USD
          </p>
          <div className="mt-3 space-y-3">
            {onrampRows.map((row) => {
              const targetOpenUsdAmount = buyOpenUsdAmount > 0 ? buyOpenUsdAmount : 0;
              const quoteLabel =
                row.key === "Ewallet QR PH"
                  ? `${(targetOpenUsdAmount * E_WALLET_PHP_PER_OUSD).toFixed(2)} PHP`
                  : `${targetOpenUsdAmount.toFixed(5)} PI`;
              const selected = buyOnrampProvider === row.key;
              return (
                <button
                  key={row.key}
                  type="button"
                  disabled={row.disabled}
                  onClick={() => {
                    if (row.disabled) return;
                    setBuyOnrampProvider(row.key);
                    if (row.key === "Ewallet QR PH") {
                      setBuyPaymentMethod("Ewallet");
                    } else if (row.key === "Pi Payment") {
                      setBuyPaymentMethod("Pi Payment");
                    }
                    setShowOnrampPicker(false);
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    row.disabled
                      ? "border-border/50 bg-secondary/40 text-muted-foreground"
                      : selected
                        ? "border-paypal-blue/50 bg-white"
                        : "border-border/70 bg-secondary/20 hover:bg-secondary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="inline-flex items-center gap-2 text-2xl font-semibold text-foreground">
                        {row.key === "Pi Payment" && (
                          <img src={PI_PAYMENT_ICON_URL} alt="Pi Payment" className="h-6 w-6 rounded-full object-cover" />
                        )}
                        {row.key === "Ewallet QR PH" && (
                          <img src={JQRPH_ICON_URL} alt="JQRPh" className="h-6 w-auto object-contain" />
                        )}
                        {row.key}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-muted-foreground">{row.subtitle}</p>
                        {row.recommended && (
                          <span className="rounded-md bg-paypal-blue/10 px-2 py-0.5 text-xs font-semibold text-paypal-blue">
                            Recommended
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {!row.disabled && <p className="text-3xl font-semibold text-foreground">{quoteLabel}</p>}
                      {row.delta && <p className="text-sm font-semibold text-red-500">{row.delta}</p>}
                      {!row.disabled && selected && <Check className="ml-auto mt-1 h-4 w-4 text-paypal-blue" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentMethodPicker} onOpenChange={setShowPaymentMethodPicker}>
        <DialogContent className="top-auto bottom-0 translate-y-0 rounded-b-none rounded-t-3xl px-5 pb-7 pt-5 sm:max-w-lg">
          <DialogTitle className="text-center text-2xl font-bold text-foreground">Choose payment method</DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Pi Payment and Ewallet are currently supported for OpenUSD buy.
          </DialogDescription>
          <div className="mt-3 space-y-2">
            {paymentMethodRows.map((row) => {
              const selected = buyPaymentMethod === row.key;
              const disabled = row.disabled ?? !supportedBuyPaymentMethods.includes(row.key);
              return (
                <button
                  key={row.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    setBuyPaymentMethod(row.key);
                    if (row.key === "Ewallet") {
                      setBuyOnrampProvider("Ewallet QR PH");
                    } else if (row.key === "Pi Payment") {
                      setBuyOnrampProvider("Pi Payment");
                    }
                    setShowPaymentMethodPicker(false);
                  }}
                  className={`flex h-14 w-full items-center justify-between rounded-2xl border px-4 ${
                    disabled
                      ? "border-border/60 bg-secondary/30 text-muted-foreground"
                      : "border-border/70 bg-white hover:bg-secondary/20"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 text-base font-semibold">
                    {row.key === "Pi Payment" && (
                      <img src={PI_PAYMENT_ICON_URL} alt="Pi Payment" className="h-5 w-5 rounded-full object-cover" />
                    )}
                    {row.key === "Ewallet" && (
                      <img src={JQRPH_ICON_URL} alt="JQRPh" className="h-5 w-auto object-contain" />
                    )}
                    {getBuyPaymentMethodLabel(row.key)}
                  </span>
                  <div className="flex items-center gap-2">
                    {row.recommended && <span className="rounded-md bg-paypal-blue/10 px-2 py-0.5 text-xs font-semibold text-paypal-blue">Recommended</span>}
                    {selected && <Check className="h-5 w-5 text-paypal-blue" />}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAgreement} onOpenChange={() => undefined}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogTitle className="text-xl font-bold text-foreground">Platform, User, and Merchant Protection Agreement</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            OpenPay is designed for Pi-powered internal balance transfers. By continuing, you agree to use OpenPay only under the protection rules below.
          </DialogDescription>
          <div className="rounded-2xl border border-border/70 p-3 text-sm text-foreground">
            <p>1. Use OpenPay only to transfer OpenPay balance backed by Pi.</p>
            <p>2. Do not use OpenPay for external wallet transfers or non-Pi crypto assets.</p>
            <p>3. Verify recipient and merchant details before every payment.</p>
            <p>4. Merchants must disclose any deposit/payout exchange fee before transaction confirmation.</p>
            <p>5. Users and merchants must not use OpenPay for fraud, abuse, or illegal transactions.</p>
            <p>6. Keep your account and security settings protected at all times.</p>
          </div>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={agreementChecked}
              onChange={(e) => setAgreementChecked(e.target.checked)}
              className="mt-1"
            />
            I agree to the OpenPay Platform, User, and Merchant Protection Agreement, including Pi-only internal OpenPay transfer rules.
          </label>
          <div className="flex items-center justify-between text-xs">
            <Link to="/terms" className="font-medium text-paypal-blue">Terms</Link>
            <Link to="/privacy" className="font-medium text-paypal-blue">Privacy</Link>
            <Link to="/legal" className="font-medium text-paypal-blue">Legal</Link>
          </div>
          <Button
            className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
            disabled={!agreementChecked}
            onClick={handleAcceptAgreement}
          >
            Accept and Continue
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showOnboarding} onOpenChange={setShowOnboarding}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-paypal-blue">
            Step {onboardingStep + 1} of {onboardingSteps.length}
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">{onboardingSteps[onboardingStep].title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">{onboardingSteps[onboardingStep].description}</DialogDescription>

          <div className="mt-3 flex gap-1.5">
            {onboardingSteps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 flex-1 rounded-full ${index <= onboardingStep ? "bg-paypal-blue" : "bg-border"}`}
              />
            ))}
          </div>

          <div className="mt-2 rounded-2xl border border-border/70 p-3 text-sm text-muted-foreground">
            Pro tip: you can revisit support and usage guidance anytime from Menu.
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="h-11 flex-1 rounded-2xl" onClick={completeOnboarding}>
              Skip
            </Button>
            {onboardingStep < onboardingSteps.length - 1 ? (
              <Button
                className="h-11 flex-1 rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
                onClick={() => {
                  const nextStep = onboardingStep + 1;
                  setOnboardingStep(nextStep);
                  if (userId) upsertUserPreferences(userId, { onboarding_step: nextStep }).catch(() => undefined);
                }}
              >
                Next
              </Button>
            ) : (
              <Button
                className="h-11 flex-1 rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
                onClick={completeOnboarding}
              >
                Finish
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;


