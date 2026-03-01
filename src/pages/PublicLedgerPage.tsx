import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";

type PublicLedgerEntry = {
  amount: number;
  note: string | null;
  status: string;
  occurred_at: string;
  event_type: string;
  currency_code?: string;
  payload?: any;
  sender_name?: string;
  sender_username?: string;
  sender_avatar?: string;
  receiver_name?: string;
  receiver_username?: string;
  receiver_avatar?: string;
};

const PAGE_SIZE = 30;
const isMissingPrivateLedgerRpcError = (message: string | undefined) =>
  Boolean(message) &&
  (message.includes("public.get_private_ledger_transaction")
    || message.includes("Could not find the function public.get_private_ledger_transaction"));

const redactLedgerNote = (note: string) =>
  note
    .replace(/@[\w.-]+/g, "@hidden")
    .replace(/OpenPay\s+[A-Za-z0-9_.-]+/g, "OpenPay [hidden]")
    .replace(/\bWallet\s+[A-Za-z0-9-]{6,}\b/g, "Wallet [hidden]")
    .replace(/\bOPEA[0-9A-Z]{6,}\b/g, "OPEA****")
    .replace(/\bOP[A-Z0-9]{6,}\b/g, (match) => `${match.slice(0, 4)}****`);

const PublicLedgerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const transactionId = (searchParams.get("tx") || "").trim();
  const { format: formatCurrency } = useCurrency();
  const [entries, setEntries] = useState<PublicLedgerEntry[]>([]);
  const [privateView, setPrivateView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const getInitials = (name: string) => (name || "U").split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const renderProfile = (name?: string, avatar?: string, username?: string) => {
    if (!name && !username) return null;
    return (
      <div className="flex items-center gap-2">
        {avatar ? (
          <img src={avatar} alt={name} className="h-6 w-6 rounded-full object-cover border border-border/50" />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground border border-border/50">
            {getInitials(name || username || "?")}
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-foreground leading-tight">{name || username}</span>
          {username && name && <span className="text-[9px] text-muted-foreground leading-tight">@{username}</span>}
        </div>
      </div>
    );
  };

  const loadPage = async (nextOffset = 0) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_public_ledger", {
        p_limit: PAGE_SIZE,
        p_offset: nextOffset,
      });

      if (error) throw new Error(error.message || "Failed to load ledger.");

      const rows = (data || []) as PublicLedgerEntry[];
      setEntries(rows);
      setOffset(nextOffset);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load ledger.");
    } finally {
      setLoading(false);
    }
  };

  const loadTransaction = async (txId: string) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const isSignedIn = Boolean(userData?.user);
      let rpcName = isSignedIn ? "get_private_ledger_transaction" : "get_public_ledger_transaction";
      let { data, error } = await supabase.rpc(rpcName, { p_transaction_id: txId });

      if (isSignedIn && error && isMissingPrivateLedgerRpcError(error.message)) {
        rpcName = "get_public_ledger_transaction";
        ({ data, error } = await supabase.rpc(rpcName, { p_transaction_id: txId }));
      }

      if (error) throw new Error(error.message || "Failed to load ledger transaction.");
      const row = Array.isArray(data) ? data[0] : data;
      setEntries(row ? [row as PublicLedgerEntry] : []);
      setPrivateView(Boolean(row) && isSignedIn && rpcName === "get_private_ledger_transaction");
      setOffset(0);
      setHasMore(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load ledger transaction.");
      setEntries([]);
      setPrivateView(false);
      setOffset(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (transactionId) {
      void loadTransaction(transactionId);
      return;
    }
    void loadPage(0);
  }, [transactionId]);

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} aria-label="Back to home">
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-paypal-dark">OpenLedger</h1>
            <p className="text-xs text-muted-foreground">
              {transactionId
                ? `OpenLedger record for transaction ${transactionId.slice(0, 8)}...`
                : "OpenLedger transaction history. User IDs are not shown."}
            </p>
          </div>
        </div>
        <button
          onClick={() => (transactionId ? loadTransaction(transactionId) : loadPage(offset))}
          className="paypal-surface flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold text-foreground"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {entries.length === 0 && !loading ? (
        <p className="py-12 text-center text-muted-foreground">No ledger transactions yet.</p>
      ) : (
        <div className="paypal-surface divide-y divide-border/70 rounded-3xl">
          {entries.map((row, index) => {
            const isTopup = row.event_type.includes("topup") || row.event_type.includes("deposit");
            const isWithdraw = row.event_type.includes("withdraw") || row.event_type.includes("payout");
            const methodLogo = row.payload?.payment_method_logo || row.payload?.logo_url;
            const currencyIcon = row.currency_code === "PI" ? "π" : "$";
            
            return (
              <div key={`${row.occurred_at}-${index}`} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {(isTopup || isWithdraw) && methodLogo ? (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/50 overflow-hidden border border-border/50">
                      <img src={methodLogo} alt="Method" className="h-6 w-6 object-contain" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paypal-blue/10 text-paypal-blue font-bold">
                      {currencyIcon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">
                        {isTopup ? "Top Up" : isWithdraw ? "Withdrawal" : "Transaction"}
                      </p>
                      {row.currency_code && (
                        <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">
                          {row.currency_code}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(row.occurred_at), "MMM d, yyyy HH:mm")} • {row.event_type.replace(/_/g, " ")}
                    </p>
                    
                    {/* Profiles Section */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {row.sender_name && renderProfile(row.sender_name, row.sender_avatar, row.sender_username)}
                      {(row.sender_name && row.receiver_name) && <span className="text-muted-foreground text-[10px]">→</span>}
                      {row.receiver_name && renderProfile(row.receiver_name, row.receiver_avatar, row.receiver_username)}
                    </div>

                    {row.note && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 italic line-clamp-2">
                        {privateView ? row.note : redactLedgerNote(row.note)}
                      </p>
                    )}
                    <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mt-1">
                      Status: <span className={row.status === "completed" ? "text-green-600" : "text-amber-600"}>{row.status || "unknown"}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right sm:ml-4">
                  <p className="font-bold text-foreground">
                    {row.currency_code === "PI" ? "π" : "$"}{row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">OpenLedger Record</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          className="paypal-surface h-9 rounded-full px-4 text-sm font-semibold text-foreground disabled:opacity-50"
          onClick={() => loadPage(Math.max(0, offset - PAGE_SIZE))}
          disabled={loading || offset === 0 || !!transactionId}
        >
          Previous
        </button>
        <button
          className="paypal-surface h-9 rounded-full px-4 text-sm font-semibold text-foreground disabled:opacity-50"
          onClick={() => loadPage(offset + PAGE_SIZE)}
          disabled={loading || !hasMore || !!transactionId}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default PublicLedgerPage;
