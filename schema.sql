-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. fb_accounts (Legacy mas mantido para fallback)
CREATE TABLE IF NOT EXISTS fb_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    token TEXT UNIQUE,
    pages JSONB,
    workspace TEXT DEFAULT 'admin',
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. fb_pages
CREATE TABLE IF NOT EXISTS fb_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id TEXT,
    fb_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    access_token TEXT NOT NULL,
    category TEXT,
    workspace TEXT DEFAULT 'admin',
    selected BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. post_history
CREATE TABLE IF NOT EXISTS post_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    main_caption TEXT,
    first_comment TEXT,
    target_group TEXT,
    workspace TEXT DEFAULT 'admin',
    post_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. publications
CREATE TABLE IF NOT EXISTS publications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    history_id UUID REFERENCES post_history(id) ON DELETE CASCADE,
    page_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    fb_post_id TEXT,
    workspace TEXT DEFAULT 'admin',
    ai_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. page_metrics
CREATE TABLE IF NOT EXISTS page_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id TEXT NOT NULL,
    fans INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    workspace TEXT DEFAULT 'admin',
    engagement FLOAT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. page_groups
CREATE TABLE IF NOT EXISTS page_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    workspace TEXT DEFAULT 'admin',
    page_ids TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. scheduled_comments
CREATE TABLE IF NOT EXISTS scheduled_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    fb_post_id TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    workspace TEXT DEFAULT 'admin',
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. post_auto_replies
CREATE TABLE IF NOT EXISTS post_auto_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id TEXT NOT NULL,
    fb_post_id TEXT NOT NULL,
    reply_text TEXT NOT NULL,
    workspace TEXT DEFAULT 'admin',
    access_token TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. fb_leads
CREATE TABLE IF NOT EXISTS fb_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id TEXT NOT NULL,
    psid TEXT NOT NULL,
    name TEXT,
    profile_pic TEXT,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'new',
    workspace TEXT DEFAULT 'admin',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(page_id, psid)
);

-- 10. fb_messages
CREATE TABLE IF NOT EXISTS fb_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES fb_leads(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    workspace TEXT DEFAULT 'admin',
    text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. fb_automations
CREATE TABLE IF NOT EXISTS fb_automations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id TEXT NOT NULL,
    trigger_type TEXT,
    trigger_value TEXT,
    response_text TEXT,
    workspace TEXT DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. fb_flows
CREATE TABLE IF NOT EXISTS fb_flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    page_id TEXT,
    page_ids JSONB,
    trigger_keywords JSONB,
    steps JSONB NOT NULL,
    workspace TEXT DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. fb_flow_executions
CREATE TABLE IF NOT EXISTS fb_flow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id TEXT NOT NULL,
    lead_psid TEXT NOT NULL,
    flow_id UUID REFERENCES fb_flows(id) ON DELETE CASCADE,
    comment_id TEXT,
    current_step_index INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',
    next_execution_time TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    workspace TEXT DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. fb_processed_comments
CREATE TABLE IF NOT EXISTS fb_processed_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id TEXT UNIQUE NOT NULL,
    workspace TEXT DEFAULT 'admin',
    page_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. post_queue
CREATE TABLE IF NOT EXISTS post_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status TEXT DEFAULT 'pending',
    label TEXT,
    type TEXT,
    caption TEXT,
    comments JSONB,
    auto_reply_text TEXT,
    story_link TEXT,
    is_scheduled BOOLEAN DEFAULT FALSE,
    scheduled_date TIMESTAMP WITH TIME ZONE,
    use_ai BOOLEAN DEFAULT FALSE,
    pages JSONB,
    media_urls JSONB,
    progress_current INTEGER DEFAULT 0,
    progress_total INTEGER DEFAULT 0,
    workspace TEXT DEFAULT 'admin',
    logs JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and setup policies to allow anon read/write
-- Since the frontend uses the anon key directly for all operations
-- Let's just create a generic policy for all tables
-- Or disable RLS to avoid policy issues, as anon key shouldn't be blocked.
-- By default, tables created without explicitly enabling RLS have it disabled, which means ALL operations are allowed.
-- But Supabase Studio often complains if RLS is not enabled.
-- Given the context of a self-hosted instance without explicit users, leaving RLS disabled is fine.

-- Allow creating buckets in the storage schema (Note: the media bucket)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;
