-- Supabase Analytics Setup
-- Creates a table to track API usage statistics
-- Run this in Supabase SQL Editor

-- Create analytics table
CREATE TABLE IF NOT EXISTS public.api_analytics (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  username TEXT NOT NULL,
  theme TEXT DEFAULT 'github',
  width INTEGER DEFAULT 1000,
  height INTEGER DEFAULT 600,
  stats BOOLEAN DEFAULT false,
  credit BOOLEAN DEFAULT false,
  year INTEGER,
  cache_hit BOOLEAN DEFAULT false
);

-- Create index on created_at for faster queries
CREATE INDEX IF NOT EXISTS idx_api_analytics_created_at ON public.api_analytics(created_at DESC);

-- Create index on username for user-specific queries
CREATE INDEX IF NOT EXISTS idx_api_analytics_username ON public.api_analytics(username);

-- Enable Row Level Security (RLS)
ALTER TABLE public.api_analytics ENABLE ROW LEVEL Security;

-- Policy: Allow anonymous to insert analytics (for tracking)
CREATE POLICY "Allow anonymous to insert analytics"
  ON public.api_analytics
  FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);

-- Policy: Allow anonymous read access for public stats
CREATE POLICY "Allow anonymous to read analytics"
  ON public.api_analytics
  FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

-- Grant permissions
GRANT SELECT, INSERT ON public.api_analytics TO anon;
GRANT USAGE ON SEQUENCE api_analytics_id_seq TO anon;

-- Function to get daily stats for the last 30 days
CREATE OR REPLACE FUNCTION get_daily_stats(days_back INTEGER DEFAULT 30)
RETURNS TABLE(
  date DATE,
  total_requests BIGINT,
  unique_users BIGINT,
  cache_hits BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_requests,
    COUNT(DISTINCT username) as unique_users,
    COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits
  FROM public.api_analytics
  WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
$$;

-- Function to get daily stats for the entire app lifetime (no day limit)
CREATE OR REPLACE FUNCTION get_lifetime_daily_stats()
RETURNS TABLE(
  date DATE,
  total_requests BIGINT,
  unique_users BIGINT,
  cache_hits BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    DATE(created_at) as date,
    COUNT(*) as total_requests,
    COUNT(DISTINCT username) as unique_users,
    COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits
  FROM public.api_analytics
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
$$;

-- Function to get theme usage stats
CREATE OR REPLACE FUNCTION get_theme_stats()
RETURNS TABLE(
  theme TEXT,
  usage_count BIGINT,
  percentage NUMERIC
)
LANGUAGE SQL
STABLE
AS $$
  WITH total AS (
    SELECT COUNT(*) as total_count FROM public.api_analytics
  )
  SELECT 
    a.theme,
    COUNT(*) as usage_count,
    ROUND((COUNT(*) * 100.0 / t.total_count), 2) as percentage
  FROM public.api_analytics a, total t
  GROUP BY a.theme, t.total_count
  ORDER BY usage_count DESC;
$$;

-- Function to get top users
CREATE OR REPLACE FUNCTION get_top_users(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
  username TEXT,
  request_count BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    username,
    COUNT(*) as request_count
  FROM public.api_analytics
  GROUP BY username
  ORDER BY request_count DESC
  LIMIT limit_count;
$$;

-- Function to get lifetime/overall stats
CREATE OR REPLACE FUNCTION get_lifetime_stats()
RETURNS TABLE(
  total_requests BIGINT,
  unique_users BIGINT,
  total_cache_hits BIGINT,
  cache_hit_rate NUMERIC,
  first_request TIMESTAMPTZ,
  last_request TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    COUNT(*) as total_requests,
    COUNT(DISTINCT username) as unique_users,
    COUNT(*) FILTER (WHERE cache_hit = true) as total_cache_hits,
    ROUND((COUNT(*) FILTER (WHERE cache_hit = true) * 100.0 / NULLIF(COUNT(*), 0)), 2) as cache_hit_rate,
    MIN(created_at) as first_request,
    MAX(created_at) as last_request
  FROM public.api_analytics;
$$;

-- Function to get new (first-time) users per day
-- Returns only users whose FIRST EVER request was on that day
CREATE OR REPLACE FUNCTION get_daily_new_users()
RETURNS TABLE(
  date DATE,
  new_users BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT DATE(first_seen) as date, COUNT(*) as new_users
  FROM (
    SELECT username, MIN(DATE(created_at)) as first_seen
    FROM public.api_analytics
    GROUP BY username
  ) sub
  GROUP BY DATE(first_seen)
  ORDER BY date DESC;
$$;

-- Function to get monthly aggregated stats
CREATE OR REPLACE FUNCTION get_monthly_stats()
RETURNS TABLE(
  month DATE,
  total_requests BIGINT,
  unique_users BIGINT,
  cache_hits BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    DATE_TRUNC('month', created_at)::DATE as month,
    COUNT(*) as total_requests,
    COUNT(DISTINCT username) as unique_users,
    COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits
  FROM public.api_analytics
  GROUP BY DATE_TRUNC('month', created_at)
  ORDER BY month DESC;
$$;

-- Function to get new (first-time) users per month
CREATE OR REPLACE FUNCTION get_monthly_new_users()
RETURNS TABLE(
  month DATE,
  new_users BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT DATE_TRUNC('month', first_seen)::DATE as month, COUNT(*) as new_users
  FROM (
    SELECT username, MIN(DATE(created_at)) as first_seen
    FROM public.api_analytics
    GROUP BY username
  ) sub
  GROUP BY DATE_TRUNC('month', first_seen)
  ORDER BY month DESC;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_daily_stats(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_lifetime_daily_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_theme_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_top_users(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_lifetime_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_daily_new_users() TO anon;
GRANT EXECUTE ON FUNCTION get_monthly_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_monthly_new_users() TO anon;

-- Verify setup
SELECT 'Analytics setup complete!' as status;
SELECT COUNT(*) as current_records FROM public.api_analytics;
