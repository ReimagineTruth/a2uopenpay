CREATE TABLE IF NOT EXISTS public.support_agents (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL DEFAULT 'openpay',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending')),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL DEFAULT 'user' CHECK (sender_role IN ('user', 'agent')),
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_faq_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_faq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.support_faq_categories(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_conversations_user
ON public.support_conversations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_conversation
ON public.support_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_support_messages_sender
ON public.support_messages (sender_id, created_at DESC);

ALTER TABLE public.support_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_faq_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_support_agent(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.support_agents sa
    WHERE sa.user_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND LOWER(COALESCE(p.username, '')) IN ('openpay', 'wainfoundation')
  );
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_conversations' AND policyname = 'Users can view own support conversations'
  ) THEN
    CREATE POLICY "Users can view own support conversations"
      ON public.support_conversations
      FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR public.is_support_agent(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_conversations' AND policyname = 'Users can insert own support conversations'
  ) THEN
    CREATE POLICY "Users can insert own support conversations"
      ON public.support_conversations
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_conversations' AND policyname = 'Agents can update support conversations'
  ) THEN
    CREATE POLICY "Agents can update support conversations"
      ON public.support_conversations
      FOR UPDATE TO authenticated
      USING (public.is_support_agent(auth.uid()))
      WITH CHECK (public.is_support_agent(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_messages' AND policyname = 'Users can view own support messages'
  ) THEN
    CREATE POLICY "Users can view own support messages"
      ON public.support_messages
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.support_conversations sc
          WHERE sc.id = support_messages.conversation_id
            AND (sc.user_id = auth.uid() OR public.is_support_agent(auth.uid()))
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_messages' AND policyname = 'Users can insert support messages'
  ) THEN
    CREATE POLICY "Users can insert support messages"
      ON public.support_messages
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.support_conversations sc
          WHERE sc.id = support_messages.conversation_id
            AND sc.user_id = auth.uid()
        )
        OR public.is_support_agent(auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_faq_categories' AND policyname = 'Anyone can read FAQ categories'
  ) THEN
    CREATE POLICY "Anyone can read FAQ categories"
      ON public.support_faq_categories
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_faq_items' AND policyname = 'Anyone can read FAQ items'
  ) THEN
    CREATE POLICY "Anyone can read FAQ items"
      ON public.support_faq_items
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_faq_categories' AND policyname = 'Agents can manage FAQ categories'
  ) THEN
    CREATE POLICY "Agents can manage FAQ categories"
      ON public.support_faq_categories
      FOR ALL TO authenticated
      USING (public.is_support_agent(auth.uid()))
      WITH CHECK (public.is_support_agent(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_faq_items' AND policyname = 'Agents can manage FAQ items'
  ) THEN
    CREATE POLICY "Agents can manage FAQ items"
      ON public.support_faq_items
      FOR ALL TO authenticated
      USING (public.is_support_agent(auth.uid()))
      WITH CHECK (public.is_support_agent(auth.uid()));
  END IF;
END $$;
