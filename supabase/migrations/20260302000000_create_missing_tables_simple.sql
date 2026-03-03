-- Create missing tables with correct structure

-- First, check if profiles table exists and has correct structure
DO $$
BEGIN
    -- Create profiles table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        CREATE TABLE public.profiles (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            full_name TEXT,
            username TEXT UNIQUE,
            referral_code TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Enable RLS
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        -- Grant permissions
        GRANT ALL ON public.profiles TO authenticated;
        GRANT ALL ON public.profiles TO service_role;
        
        -- Create indexes
        CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
        CREATE INDEX idx_profiles_username ON public.profiles(username);
    END IF;
    
    -- Create app_notifications table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_notifications' AND table_schema = 'public') THEN
        CREATE TABLE public.app_notifications (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            read_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Enable RLS
        ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        CREATE POLICY "Users can view own notifications" ON public.app_notifications FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can update own notifications" ON public.app_notifications FOR UPDATE USING (auth.uid() = user_id);
        
        -- Grant permissions
        GRANT ALL ON public.app_notifications TO authenticated;
        GRANT ALL ON public.app_notifications TO service_role;
        
        -- Create indexes
        CREATE INDEX idx_app_notifications_user_id ON public.app_notifications(user_id);
        CREATE INDEX idx_app_notifications_read_at ON public.app_notifications(read_at);
    END IF;
    
    -- Create mining_rewards table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mining_rewards' AND table_schema = 'public') THEN
        CREATE TABLE public.mining_rewards (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            amount NUMERIC(20,8) NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Enable RLS
        ALTER TABLE public.mining_rewards ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        CREATE POLICY "Users can view own mining rewards" ON public.mining_rewards FOR SELECT USING (auth.uid() = user_id);
        
        -- Grant permissions
        GRANT ALL ON public.mining_rewards TO authenticated;
        GRANT ALL ON public.mining_rewards TO service_role;
        
        -- Create indexes
        CREATE INDEX idx_mining_rewards_user_id ON public.mining_rewards(user_id);
    END IF;
    
    -- Create mining_sessions table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mining_sessions' AND table_schema = 'public') THEN
        CREATE TABLE public.mining_sessions (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            is_active BOOLEAN DEFAULT true,
            started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        );
        
        -- Enable RLS
        ALTER TABLE public.mining_sessions ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        CREATE POLICY "Users can view own mining sessions" ON public.mining_sessions FOR SELECT USING (auth.uid() = user_id);
        
        -- Grant permissions
        GRANT ALL ON public.mining_sessions TO authenticated;
        GRANT ALL ON public.mining_sessions TO service_role;
        
        -- Create indexes
        CREATE INDEX idx_mining_sessions_user_id ON public.mining_sessions(user_id);
        CREATE INDEX idx_mining_sessions_is_active ON public.mining_sessions(is_active);
        CREATE INDEX idx_mining_sessions_expires_at ON public.mining_sessions(expires_at);
    END IF;
END $$;
