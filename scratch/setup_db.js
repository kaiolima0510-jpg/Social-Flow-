
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jktovuhqbqexcsxigozs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdG92dWhxYnFleGNzeGlnb3pzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjcyOTE5NSwiZXhwIjoyMDgyMzA1MTk1fQ.6w3IS64X5pwICtHPfy7dtj7Nmxk3UVjpzuZHSaAcxIU';

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. fb_accounts
CREATE TABLE IF NOT EXISTS fb_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    token TEXT UNIQUE,
    pages JSONB,
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. post_history
CREATE TABLE IF NOT EXISTS post_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    main_caption TEXT,
    first_comment TEXT,
    target_group TEXT,
    post_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. publications
CREATE TABLE IF NOT EXISTS publications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    history_id UUID REFERENCES post_history(id) ON DELETE CASCADE,
    page_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    fb_post_id TEXT,
    ai_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. page_metrics
CREATE TABLE IF NOT EXISTS page_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id TEXT NOT NULL,
    fans INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    engagement FLOAT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. page_groups
CREATE TABLE IF NOT EXISTS page_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    page_ids TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. scheduled_comments
CREATE TABLE IF NOT EXISTS scheduled_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    fb_post_id TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. fb_leads
CREATE TABLE IF NOT EXISTS fb_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id TEXT NOT NULL,
    psid TEXT NOT NULL,
    name TEXT,
    profile_pic TEXT,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'new',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(page_id, psid)
);

-- 8. fb_messages
CREATE TABLE IF NOT EXISTS fb_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES fb_leads(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. fb_automations
CREATE TABLE IF NOT EXISTS fb_automations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id TEXT NOT NULL,
    trigger_type TEXT,
    trigger_value TEXT,
    response_text TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. fb_processed_comments
CREATE TABLE IF NOT EXISTS fb_processed_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id TEXT UNIQUE,
    page_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

async function setup() {
    console.log("Setting up database schema...");
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error("Error executing SQL via RPC:", error);
      console.log("Attempting to execute via multiple single queries if exec_sql is missing...");
      // If exec_sql is not defined, we might need a different approach or the user has to run it manually.
      // But since I don't have exec_sql by default, I'll advise the user or try to find a workaround.
    } else {
      console.log("Schema created successfully.");
    }
}

// Since I cannot run raw SQL directly without a custom RPC 'exec_sql', 
// I will instead output the SQL for the user to run in the Supabase SQL Editor.
console.log("SQL SCHEMA:");
console.log(sql);
