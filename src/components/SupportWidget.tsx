import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { HelpCircle, MessageCircle, Search, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BrandLogo from "@/components/BrandLogo";
import { toast } from "sonner";

type SupportConversation = {
  id: string;
  user_id: string;
  status: string;
  last_message_at: string | null;
  created_at: string;
};

type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "user" | "agent";
  message: string;
  created_at: string;
};

type SupportFaqCategory = {
  id: string;
  title: string;
  description: string;
};

type SupportFaqItem = {
  id: string;
  category_id: string | null;
  question: string;
  answer: string;
};

type SupportConversationRow = SupportConversation & { profile?: { full_name?: string | null; username?: string | null } | null };

const SupportWidget = () => {
  const location = useLocation();
  const hiddenScrollbarClass = "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "messages" | "help">("home");
  const [userId, setUserId] = useState<string | null>(null);
  const [isAgent, setIsAgent] = useState(false);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [aiReplying, setAiReplying] = useState(false);
  const [faqCategories, setFaqCategories] = useState<SupportFaqCategory[]>([]);
  const [faqItems, setFaqItems] = useState<SupportFaqItem[]>([]);
  const [helpQuery, setHelpQuery] = useState("");
  const [allConversations, setAllConversations] = useState<SupportConversationRow[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  useEffect(() => {
    const boot = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      const isAgentUser = ["openpay", "wainfoundation"].includes(String(profile?.username || "").toLowerCase());
      if (isAgentUser) setIsAgent(true);

      const { data: convoRows } = await supabase
        .from("support_conversations")
        .select("id, user_id, status, last_message_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const existing = (convoRows || [])[0] as SupportConversation | undefined;
      if (existing) {
        setConversation(existing);
        setSelectedConversationId(existing.id);
      }

      const { data: catRows } = await supabase
        .from("support_faq_categories")
        .select("id, title, description")
        .order("sort_order", { ascending: true });
      setFaqCategories((catRows || []) as SupportFaqCategory[]);

      const { data: itemRows } = await supabase
        .from("support_faq_items")
        .select("id, category_id, question, answer");
      setFaqItems((itemRows || []) as SupportFaqItem[]);
    };
    void boot();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: "home" | "messages" | "help" }>).detail;
      setOpen(true);
      setActiveTab(detail?.tab ?? "messages");
    };
    window.addEventListener("open-support-widget", handler as EventListener);
    return () => window.removeEventListener("open-support-widget", handler as EventListener);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!isAgent) return;
    const loadInbox = async () => {
      const { data } = await supabase
        .from("support_conversations")
        .select("id, user_id, status, last_message_at, created_at")
        .order("last_message_at", { ascending: false })
        .limit(30);
      const convoRows = (data || []) as SupportConversation[];
      const userIds = Array.from(new Set(convoRows.map((row) => row.user_id).filter(Boolean)));
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("id, full_name, username").in("id", userIds)
        : { data: [] as Array<{ id: string; full_name: string | null; username: string | null }> };

      const profileMap = new Map(
        (profiles || []).map((row) => [
          row.id,
          { full_name: row.full_name || null, username: row.username || null },
        ]),
      );
      const merged = convoRows.map((row) => ({
        ...row,
        profile: profileMap.get(row.user_id) || null,
      }));
      setAllConversations(merged);
    };
    void loadInbox();
  }, [isAgent]);

  useEffect(() => {
    const loadMessages = async (conversationId: string) => {
      const { data } = await supabase
        .from("support_messages")
        .select("id, conversation_id, sender_id, sender_role, message, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      setMessages((data || []) as SupportMessage[]);
    };
    if (selectedConversationId) void loadMessages(selectedConversationId);
  }, [selectedConversationId]);

  const filteredFaqs = useMemo(() => {
    const query = helpQuery.trim().toLowerCase();
    if (!query) return faqItems;
    return faqItems.filter((item) => item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query));
  }, [faqItems, helpQuery]);

  const ensureConversation = async () => {
    if (conversation || !userId) return conversation;
    const { data, error } = await supabase
      .from("support_conversations")
      .insert({ user_id: userId })
      .select("id, user_id, status, last_message_at, created_at")
      .single();
    if (error) {
      toast.error(error.message || "Failed to start conversation");
      return null;
    }
    setConversation(data as SupportConversation);
    setSelectedConversationId((data as SupportConversation).id);
    return data as SupportConversation;
  };

  const sendMessage = async () => {
    const text = messageDraft.trim();
    if (!text || !userId) return;
    const convo = isAgent ? null : await ensureConversation();
    const conversationId = isAgent ? selectedConversationId : convo?.id;
    if (!conversationId) {
      toast.error("Select a conversation to reply.");
      return;
    }
    const { error } = await supabase
      .from("support_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        sender_role: isAgent ? "agent" : "user",
        message: text,
      });
    if (error) {
      toast.error(error.message || "Failed to send message");
      return;
    }
    setMessageDraft("");
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        sender_id: userId,
        sender_role: isAgent ? "agent" : "user",
        message: text,
        created_at: new Date().toISOString(),
      },
    ]);
    await supabase.from("support_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);

    if (isAgent) return;

    setAiReplying(true);
    try {
      const { data: aiData, error: aiError } = await supabase.functions.invoke("support-ai-chat", {
        body: {
          conversation_id: convo.id,
          message: text,
        },
      });
      if (aiError) {
        toast.error(aiError.message || "AI support is temporarily unavailable.");
        return;
      }

      const aiReply = typeof aiData?.reply === "string" ? aiData.reply.trim() : "";
      if (!aiReply) return;
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          conversation_id: convo.id,
          sender_id: "openpay-ai",
          sender_role: "agent",
          message: aiReply,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI support is temporarily unavailable.";
      toast.error(message);
    } finally {
      setAiReplying(false);
    }
  };

  const selectConversation = (id: string) => {
    setSelectedConversationId(id);
    setActiveTab("messages");
  };

  const allowSupportButton =
    location.pathname.startsWith("/menu") ||
    location.pathname.startsWith("/merchant-onboarding");

  return (
    <>
      {allowSupportButton && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-[90] flex h-12 w-12 items-center justify-center rounded-full bg-paypal-blue text-white shadow-lg shadow-black/20 md:bottom-6 md:right-6"
          aria-label="Open support"
        >
          <HelpCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/30 md:hidden" onClick={() => setOpen(false)} />
          <div className="absolute inset-0 flex flex-col rounded-none bg-white shadow-2xl md:inset-auto md:bottom-6 md:right-6 md:h-[min(760px,calc(100vh-8rem))] md:w-[380px] md:max-w-[90vw] md:rounded-2xl md:border md:border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <BrandLogo className="h-7 w-7" />
                <div>
                  <p className="text-sm font-semibold text-foreground">OpenPay Support</p>
                  <p className="text-xs text-muted-foreground">How can we help?</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full border border-border">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 px-4 pt-3">
              {activeTab === "home" && (
                <div className="space-y-3">
                  <button onClick={() => setActiveTab("messages")} className="w-full rounded-xl border border-border p-3 text-left">
                    <p className="text-sm font-semibold text-foreground">Send us a message</p>
                    <p className="text-xs text-muted-foreground">We'll be back online later today</p>
                  </button>
                  <button onClick={() => setActiveTab("help")} className="w-full rounded-xl border border-border p-3 text-left">
                    <p className="text-sm font-semibold text-foreground">Search for help</p>
                    <p className="text-xs text-muted-foreground">Browse FAQs and guides</p>
                  </button>
                </div>
              )}

              {activeTab === "messages" && (
                <div className="mt-2 flex h-full flex-col">
                  {isAgent && (
                    <div className={`mb-2 max-h-32 overflow-y-auto rounded-lg border border-border ${hiddenScrollbarClass}`}>
                      {allConversations.map((row) => (
                        <button
                          key={row.id}
                          onClick={() => selectConversation(row.id)}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs ${selectedConversationId === row.id ? "bg-blue-50 text-blue-700" : "text-foreground"}`}
                        >
                          <span>{row.profile?.username ? `@${row.profile.username}` : row.user_id.slice(0, 8)}</span>
                          <span className="text-[10px] text-muted-foreground">{row.last_message_at ? new Date(row.last_message_at).toLocaleDateString() : ""}</span>
                        </button>
                      ))}
                      {!allConversations.length && <p className="px-3 py-2 text-xs text-muted-foreground">No conversations yet.</p>}
                    </div>
                  )}
                  <div className={`min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-white p-3 text-sm ${hiddenScrollbarClass}`}>
                    {messages.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No messages yet.</p>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id} className={`mb-2 flex ${msg.sender_role === "agent" ? "justify-start" : "justify-end"}`}>
                          <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${msg.sender_role === "agent" ? "bg-secondary text-foreground" : "bg-paypal-blue text-white"}`}>
                            {msg.message}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Input value={messageDraft} onChange={(e) => setMessageDraft(e.target.value)} placeholder="Send us a message" className="h-9 rounded-full" />
                    <Button onClick={sendMessage} disabled={aiReplying} className="h-9 rounded-full bg-paypal-blue text-white hover:bg-[#004dc5]">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "help" && (
                <div className="mt-2 flex h-full flex-col">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={helpQuery} onChange={(e) => setHelpQuery(e.target.value)} placeholder="Search for help" className="h-9 rounded-full pl-9" />
                  </div>
                  <div className={`mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pb-3 ${hiddenScrollbarClass}`}>
                    {faqCategories.map((cat) => (
                      <div key={cat.id} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-semibold text-foreground">{cat.title}</p>
                        <p className="text-xs text-muted-foreground">{cat.description}</p>
                        <div className="mt-2 space-y-2">
                          {filteredFaqs.filter((item) => item.category_id === cat.id).slice(0, 5).map((item) => (
                            <div key={item.id} className="rounded-md border border-border px-3 py-2 text-xs">
                              <p className="font-semibold text-foreground">{item.question}</p>
                              <p className="mt-1 text-muted-foreground">{item.answer}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!faqCategories.length && <p className="text-xs text-muted-foreground">No FAQs yet.</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 border-t border-border px-4 py-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <button onClick={() => setActiveTab("home")} className={`flex items-center gap-1 ${activeTab === "home" ? "text-foreground" : ""}`}>
                  <HelpCircle className="h-4 w-4" /> Home
                </button>
                <button onClick={() => setActiveTab("messages")} className={`flex items-center gap-1 ${activeTab === "messages" ? "text-foreground" : ""}`}>
                  <MessageCircle className="h-4 w-4" /> Messages
                </button>
                <button onClick={() => setActiveTab("help")} className={`flex items-center gap-1 ${activeTab === "help" ? "text-foreground" : ""}`}>
                  <Search className="h-4 w-4" /> Help
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SupportWidget;
