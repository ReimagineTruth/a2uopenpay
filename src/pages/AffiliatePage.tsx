import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Users, Gift, DollarSign, Timer, TrendingUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface ReferralRewardRow {
  referred_user_id: string;
  reward_amount: number;
  status: "pending" | "claimed";
  created_at: string;
  claimed_at: string | null;
}

const AffiliatePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [rewards, setRewards] = useState<ReferralRewardRow[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [activeMiners, setActiveMiners] = useState(0);
  const [bonusEarned, setBonusEarned] = useState(0);

  const pendingAmount = useMemo(
    () => rewards.filter((r) => r.status === "pending").reduce((sum, r) => sum + r.reward_amount, 0),
    [rewards],
  );
  const pendingCount = useMemo(() => rewards.filter((r) => r.status === "pending").length, [rewards]);
  const totalClaimed = useMemo(
    () => rewards.filter((r) => r.status === "claimed").reduce((sum, r) => sum + r.reward_amount, 0),
    [rewards],
  );

  const inviteLink = referralCode ? `${window.location.origin}/auth?ref=${encodeURIComponent(referralCode)}` : "";

  const loadData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      const [profileRes, rewardsRes, miningBonusRes] = await Promise.all([
        supabase.from("profiles").select("referral_code").eq("id", user.id).single(),
        supabase
          .from("referral_rewards")
          .select("referred_user_id, reward_amount, status, created_at, claimed_at")
          .eq("referrer_user_id", user.id)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("mining_rewards")
          .select("amount")
          .eq("user_id", user.id)
          .eq("reward_type", "referral_bonus")
      ]);

      if (profileRes.error) {
        toast.error(profileRes.error.message);
      } else {
        setReferralCode(profileRes.data?.referral_code || "");
      }

      if (rewardsRes.error) {
        toast.error(rewardsRes.error.message);
        setRewards([]);
        setUserNames({});
        setLoading(false);
        return;
      }

      const referralRows = (rewardsRes.data || []) as ReferralRewardRow[];
      setRewards(referralRows);

      // Calculate total mining bonus earned
      const totalBonus = miningBonusRes.data?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
      setBonusEarned(totalBonus);

      const invitedIds = Array.from(new Set(referralRows.map((row) => row.referred_user_id)));
      if (invitedIds.length > 0) {
        const [{ data: invitedProfiles }, { data: miningSessions }] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, username")
            .in("id", invitedIds),
          (supabase as any)
            .from("mining_sessions")
            .select("user_id")
            .in("user_id", invitedIds)
            .eq("is_active", true)
            .gt("expires_at", new Date().toISOString())
        ]);

        const nameMap: Record<string, string> = {};
        (invitedProfiles || []).forEach((profile) => {
          const display = profile.full_name?.trim() || profile.username?.trim() || "User";
          nameMap[profile.id] = display;
        });
        setUserNames(nameMap);

        // Count unique users who are actively mining
        const activeUserIds = new Set(miningSessions?.map(s => s.user_id) || []);
        setActiveMiners(activeUserIds.size);
      } else {
        setUserNames({});
        setActiveMiners(0);
      }
    } catch (error) {
      console.error("Affiliate data error:", error);
      toast.error("Failed to load affiliate data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [navigate]);

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Invite link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleClaim = async () => {
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_referral_rewards");
    setClaiming(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const result = data as { claimed?: boolean; amount?: number; count?: number } | null;
    if (result?.claimed) {
      toast.success(`Claimed $${result.amount || 0} from ${result.count || 0} invite(s)`);
    } else {
      toast.message("No pending referral rewards to claim");
    }
    await loadData();
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-24">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate("/menu")} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-paypal-dark">Affiliate</h1>
      </div>

      <div className="grid gap-3">
        {/* Referral Code Card */}
        <div className="paypal-surface rounded-3xl p-5">
          <p className="text-sm text-muted-foreground">Your referral code</p>
          <p className="mt-1 text-2xl font-bold text-paypal-dark">{loading ? "..." : referralCode || "-"}</p>
          <p className="mt-2 text-xs text-muted-foreground">Earn $1 on signup + mining bonuses when your referrals are active.</p>
          <div className="mt-4 rounded-2xl border border-border/70 bg-white px-3 py-2 text-xs text-muted-foreground break-all">
            {inviteLink || "Invite link will appear after your code is ready."}
          </div>
          <Button onClick={handleCopy} disabled={!inviteLink} className="mt-3 h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]">
            <Copy className="mr-2 h-4 w-4" />
            Copy Invite Link
          </Button>
        </div>

        {/* Mining Bonus Info */}
        <div className="rounded-3xl border border-paypal-blue/20 bg-paypal-blue/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paypal-blue/10">
              <TrendingUp className="h-5 w-5 text-paypal-blue" />
            </div>
            <div>
              <p className="font-bold text-paypal-dark">Mining Bonus Logic</p>
              <p className="text-xs text-muted-foreground">Base: 0.10/day + 10% per active miner (max 100%)</p>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-2 gap-3">
          <div className="paypal-surface rounded-2xl p-4 text-center">
            <Users className="mx-auto h-5 w-5 text-paypal-blue" />
            <p className="mt-2 text-lg font-bold text-foreground">{rewards.length}</p>
            <p className="text-xs text-muted-foreground">Total Invites</p>
          </div>
          <div className="paypal-surface rounded-2xl p-4 text-center">
            <Timer className="mx-auto h-5 w-5 text-paypal-success" />
            <p className="mt-2 text-lg font-bold text-foreground">{activeMiners}</p>
            <p className="text-xs text-muted-foreground">Active Miners</p>
          </div>
          <div className="paypal-surface rounded-2xl p-4 text-center">
            <DollarSign className="mx-auto h-5 w-5 text-paypal-blue" />
            <p className="mt-2 text-lg font-bold text-foreground">${totalClaimed.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Claimed</p>
          </div>
          <div className="paypal-surface rounded-2xl p-4 text-center">
            <TrendingUp className="mx-auto h-5 w-5 text-paypal-blue" />
            <p className="mt-2 text-lg font-bold text-foreground">{bonusEarned.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Bonus Earned</p>
          </div>
        </div>

        {/* Pending Rewards Section */}
        <div className="paypal-surface rounded-3xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold text-foreground">Pending signup rewards</p>
            <p className="text-sm font-semibold text-paypal-blue">${pendingAmount.toFixed(2)}</p>
          </div>
          <Button
            onClick={handleClaim}
            disabled={claiming || pendingCount === 0}
            className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
          >
            {claiming ? "Claiming..." : `Claim $${pendingAmount.toFixed(2)}`}
          </Button>
          <p className="mt-2 text-[10px] text-center text-muted-foreground">Mining bonuses are added directly to your balance daily.</p>
        </div>

        {/* Invite History */}
        <div className="paypal-surface rounded-3xl p-5">
          <p className="mb-3 font-semibold text-foreground">Invite history</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (rewards || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No invites yet.</p>
          ) : (
            <div className="divide-y divide-border/70">
              {(rewards || []).map((row) => (
                <div key={`${row.referred_user_id}-${row.created_at}`} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {userNames[row.referred_user_id] || (row.referred_user_id ? row.referred_user_id.slice(0, 8) : "User")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.status === "claimed" ? "Claimed reward" : "Pending claim"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${row.status === "claimed" ? "text-paypal-success" : "text-paypal-blue"}`}>
                      ${Number(row.reward_amount || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav active="menu" />
    </div>
  );
};

export default AffiliatePage;
