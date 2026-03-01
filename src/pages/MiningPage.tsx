import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Timer, TrendingUp, Users, History, AlertCircle, CheckCircle2, Zap, Cpu, Coins, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInSeconds, addHours } from "date-fns";
import { useCurrency } from "@/contexts/CurrencyContext";
import { isPiBrowserUserAgent } from "@/lib/appSecurity";
import BrandLogo from "@/components/BrandLogo";

interface MiningSession {
  id: string;
  user_id: string;
  started_at: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

interface MiningReward {
  id: string;
  amount: number;
  reward_type: "base" | "referral_bonus";
  created_at: string;
}

const MiningPage = () => {
  const navigate = useNavigate();
  const { format: formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [activeSession, setActiveSession] = useState<MiningSession | null>(null);
  const [claimableSession, setClaimableSession] = useState<MiningSession | null>(null);
  const [rewards, setRewards] = useState<MiningReward[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [activeReferrals, setActiveReferrals] = useState(0);

  const loadMiningData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    try {
      // Get active session
      const { data: session } = await supabase
        .from("mining_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      setActiveSession(session);

      // If no active session, check for claimable sessions (expired but active=true)
      if (!session) {
        const { data: claimable } = await supabase
          .from("mining_sessions")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .lte("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        setClaimableSession(claimable);
      } else {
        setClaimableSession(null);
      }

      // Get rewards history
      const { data: rewardsHistory } = await supabase
        .from("mining_rewards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      setRewards(rewardsHistory || []);

      // Get active referrals (those currently mining)
      const { data: referrals } = await supabase
        .from("referral_rewards")
        .select("referred_user_id")
        .eq("referrer_user_id", user.id);

      if (referrals && referrals.length > 0) {
        const referredIds = referrals.map(r => r.referred_user_id);
        const { count } = await supabase
          .from("mining_sessions")
          .select("*", { count: 'exact', head: true })
          .in("user_id", referredIds)
          .eq("is_active", true)
          .gt("expires_at", new Date().toISOString());
        
        setActiveReferrals(count || 0);
      } else {
        setActiveReferrals(0);
      }
    } catch (error) {
      console.error("Mining data error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMiningData();
  }, []);

  useEffect(() => {
    if (!activeSession) {
      setTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const expiry = new Date(activeSession.expires_at);
      const diff = differenceInSeconds(expiry, now);
      
      if (diff <= 0) {
        setTimeLeft(0);
        // Automatically refresh data when session expires
        loadMiningData();
      } else {
        setTimeLeft(diff);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleStartMining = async () => {
    setStarting(true);
    try {
      // Trigger Pi Ad Network if in Pi Browser
      if (isPiBrowserUserAgent()) {
        if (!window.Pi) {
          toast.error("Pi SDK not loaded. Please open in Pi Browser.");
          setStarting(false);
          return;
        }

        const sandbox = String(import.meta.env.VITE_PI_SANDBOX || "false").toLowerCase() === "true";
        window.Pi.init({ version: "2.0", sandbox });

        try {
          // Check for ad network support
          if (window.Pi.nativeFeaturesList) {
            const features = await window.Pi.nativeFeaturesList();
            if (!features.includes("ad_network") || !window.Pi.Ads?.showAd) {
              console.warn("Pi Ad Network not supported on this version or device");
            } else {
              toast.info("Preparing rewarded ad...");
              const adResult = await window.Pi.Ads.showAd("rewarded");
              console.log("Ad result:", adResult.result);
              
              if (adResult.result === "AD_NOT_AVAILABLE" || adResult.result === "AD_NETWORK_ERROR") {
                toast.error("Ad not available, but proceeding with mining...");
              } else if (adResult.result !== "AD_REWARDED") {
                toast.error("Ad not finished. You must watch the ad to start mining.");
                setStarting(false);
                return;
              }
            }
          }
        } catch (adError) {
          console.error("Ad error:", adError);
          // We proceed anyway if the ad system fails to avoid blocking the user entirely
          // unless strict enforcement is needed.
        }
      }

      // Basic anti-cheat: in a real app, use a proper fingerprinting library
      const deviceFingerprint = navigator.userAgent; 
      
      const { data, error } = await supabase.rpc("start_mining_session", {
        p_device_fingerprint: deviceFingerprint,
        p_ip_address: "client-side-ip" // Supabase handles IP on the backend usually
      });

      if (error) {
        toast.error(error.message);
      } else if (data && (data as any).error) {
        toast.error((data as any).error);
      } else {
        toast.success("Mining started! Check back in 24 hours to claim your reward.");
        loadMiningData();
      }
    } catch (error) {
      toast.error("Failed to start mining");
    } finally {
      setStarting(false);
    }
  };

  const handleClaimReward = async () => {
    setStarting(true);
    try {
      const { data, error } = await supabase.rpc("claim_mining_rewards");

      if (error) {
        toast.error(error.message);
      } else if (data && (data as any).error) {
        toast.error((data as any).error);
      } else {
        const result = data as any;
        toast.success(`Claimed ${(result?.total_reward || 0).toFixed(2)} OPEN!`);
        loadMiningData();
      }
    } catch (error) {
      toast.error("Failed to claim reward");
    } finally {
      setStarting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentDailyRate = 0.10 * (1 + Math.min(activeReferrals * 0.10, 1.0));

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-24">
      <div className="px-4 pt-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/menu")} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="text-xl font-bold text-paypal-dark">Mining</h1>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
            <BrandLogo className="h-full w-full text-paypal-blue" />
          </div>
        </div>

        {/* Mining Status Card */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#003087] via-paypal-blue to-[#0070ba] p-8 text-white shadow-2xl shadow-[#004bba]/25 transition-all duration-500">
          {/* Animated Background Elements */}
          <div className={`absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl transition-transform duration-[10000ms] ${timeLeft > 0 ? "animate-spin" : ""}`} />
          <div className={`absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-paypal-blue/20 blur-3xl transition-transform duration-[15000ms] ${timeLeft > 0 ? "animate-spin-slow" : ""}`} />
          
          <div className="relative flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className={`flex h-24 w-24 items-center justify-center rounded-full bg-white/20 backdrop-blur-md shadow-inner ${timeLeft > 0 ? "animate-pulse" : ""}`}>
                {timeLeft > 0 ? (
                  <BrandLogo className="h-14 w-14 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] animate-bounce-slow" />
                ) : (
                  <Play className="h-10 w-10 text-white fill-current ml-1" />
                )}
              </div>
              {timeLeft > 0 && (
                <div className="absolute -inset-2 rounded-full border-2 border-dashed border-white/30 animate-spin-slow" />
              )}
            </div>
            
            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tight">
                {timeLeft > 0 ? "SYSTEM ACTIVE" : "SYSTEM IDLE"}
              </h2>
              <div className="flex items-center justify-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
                <Coins className="h-3 w-3 text-yellow-400" />
                <span>{currentDailyRate.toFixed(2)} OPEN / DAY</span>
              </div>
            </div>

            {timeLeft > 0 ? (
              <div className="mt-8 flex flex-col items-center">
                <div className="flex items-center gap-3 text-5xl font-black tracking-tighter tabular-nums drop-shadow-lg">
                  <Timer className="h-8 w-8 text-white/70" />
                  {formatTime(timeLeft)}
                </div>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Until Session Completion</p>
                
                <div className="mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
                  <div 
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-1000 ease-linear"
                    style={{ width: `${(1 - timeLeft / 86400) * 100}%` }}
                  />
                </div>
              </div>
            ) : claimableSession ? (
              <div className="mt-8 flex flex-col items-center gap-4 w-full max-w-[260px]">
                <div className="text-center animate-bounce-subtle">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/60">Session Complete</p>
                  <p className="text-2xl font-black">CLAIM REWARDS</p>
                </div>
                <Button 
                  onClick={handleClaimReward} 
                  disabled={starting || loading}
                  className="h-16 w-full rounded-[1.25rem] bg-white text-lg font-black uppercase tracking-wider text-[#003087] hover:bg-white/90 shadow-[0_8px_20px_rgba(255,255,255,0.3)] transition-all active:scale-95"
                >
                  {starting ? "Processing..." : "Claim Now"}
                </Button>
              </div>
            ) : (
              <Button 
                onClick={handleStartMining} 
                disabled={starting || loading}
                className="group relative mt-8 h-16 w-full max-w-[260px] overflow-hidden rounded-[1.25rem] bg-white text-lg font-black uppercase tracking-wider text-[#003087] hover:bg-white/90 shadow-[0_8px_20px_rgba(255,255,255,0.3)] transition-all active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-paypal-blue/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                {starting ? "Initializing..." : "Engage Mining"}
              </Button>
            )}

            {!activeSession && !loading && !claimableSession && (rewards || []).length > 0 && (
              <Button
                onClick={handleClaimReward}
                variant="outline"
                className="mt-6 border-white/20 bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/70 hover:bg-white/10 hover:text-white"
              >
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                Sync Cloud State
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="paypal-surface rounded-[2rem] bg-white p-5 shadow-sm border border-paypal-blue/5 transition-transform hover:scale-[1.02]">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-paypal-blue/10">
                <Users className="h-4 w-4 text-paypal-blue" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Network</p>
            </div>
            <p className="text-3xl font-black tracking-tight text-paypal-blue">{activeReferrals}</p>
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-600">
              <TrendingUp className="h-3 w-3" />
              <span>+{((currentDailyRate - 0.10) / 0.10 * 100).toFixed(0)}% Boost</span>
            </div>
          </div>
          
          <div className="paypal-surface rounded-[2rem] bg-white p-5 shadow-sm border border-paypal-blue/5 transition-transform hover:scale-[1.02]">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-paypal-blue/10">
                <BrandLogo className="h-4 w-4 text-paypal-blue" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Earnings</p>
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-3xl font-black tracking-tight text-paypal-blue">
                {(rewards || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toFixed(2)}
              </p>
              <span className="text-[10px] font-black text-muted-foreground">OPEN</span>
            </div>
            <p className="mt-1.5 text-[10px] font-bold text-muted-foreground">All-time profit</p>
          </div>
        </div>

        {/* Mining Info Card */}
        <div className="mt-8 rounded-[2rem] border border-paypal-blue/10 bg-white/50 p-6 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-paypal-blue/10">
              <AlertCircle className="h-6 w-6 text-paypal-blue" />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-paypal-dark">Mining Protocol</p>
              <ul className="mt-3 space-y-3">
                {[
                  "Tap once every 24 hours to stay active.",
                  "Earn 0.10 OPEN base reward per session.",
                  "Get +10% bonus per active referral (max 100%).",
                  "Session locks and stops after 24 hours."
                ].map((text, i) => (
                  <li key={i} className="flex gap-3 text-sm font-medium text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* History Log */}
        <div className="mt-10">
          <div className="mb-5 flex items-center justify-between px-2">
            <h2 className="text-xl font-black tracking-tight text-paypal-dark">Mining Log</h2>
            <History className="h-5 w-5 text-muted-foreground/50" />
          </div>
          
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 w-full animate-pulse rounded-[1.5rem] bg-white/50" />
              ))}
            </div>
          ) : (rewards || []).length === 0 ? (
            <div className="rounded-[2rem] border-2 border-dashed border-muted-foreground/20 p-10 text-center bg-white/30 backdrop-blur-sm">
              <History className="h-10 w-10 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-sm font-bold text-muted-foreground">No mining history found</p>
              <p className="mt-1 text-xs text-muted-foreground/60">Your mining rewards will appear here after claiming.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(rewards || []).map((reward) => (
                <div key={reward.id} className="paypal-surface flex items-center justify-between rounded-[1.5rem] bg-white p-5 shadow-sm transition-all hover:translate-x-1 border border-paypal-blue/5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/50">
                      <BrandLogo className={`h-5 w-5 ${reward.reward_type === 'base' ? 'text-paypal-blue' : 'text-paypal-blue/60'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-black tracking-tight text-foreground">
                        {reward.reward_type === 'base' ? 'Mining Reward' : 'Referral Bonus'}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground">
                        {reward.created_at ? format(new Date(reward.created_at), "MMM d, yyyy · h:mm a") : 'Pending...'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black tracking-tight text-paypal-blue">+{Number(reward.amount || 0).toFixed(2)}</p>
                    <p className="text-[10px] font-black text-muted-foreground">OPEN</p>
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

export default MiningPage;
