-- Supabase Automatic Cache Cleanup
-- This SQL script sets up automatic cleanup of old cached images
-- Run this in Supabase SQL Editor

-- ========================================================================
-- CONFIGURATION: Modify these values to customize cleanup behavior
-- ========================================================================

-- How many days to keep cached files (files older than this will be deleted)
-- Examples: '1 days', '7 days', '30 days'
DO $$ 
BEGIN
  PERFORM set_config('app.cache_retention_days', '1', false);
END $$;

-- Cron schedule for cleanup (when to run the cleanup job)
-- Examples:
--   '0 3 * * *'    = Daily at 3 AM
--   '0 */6 * * *'  = Every 6 hours
--   '0 0 * * 0'    = Weekly on Sunday at midnight
--   '0 */12 * * *' = Every 12 hours
DO $$ 
BEGIN
  PERFORM set_config('app.cleanup_schedule', '0 3 * * *', false);
END $$;

-- ========================================================================

-- 1. Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create a function to delete old cache files
CREATE OR REPLACE FUNCTION cleanup_old_cache(retention_days INTEGER DEFAULT 7)
RETURNS TABLE(deleted_count INTEGER, cutoff_timestamp TIMESTAMP)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
  v_cutoff_date TIMESTAMP;
BEGIN
  -- Calculate cutoff date
  v_cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Delete old files from storage.objects
  DELETE FROM storage.objects
  WHERE bucket_id = 'isometric-cache'
    AND created_at < v_cutoff_date;
  
  -- Get count of deleted rows
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up % old cache files (older than %)', v_deleted_count, v_cutoff_date;
  
  -- Return results
  deleted_count := v_deleted_count;
  cutoff_timestamp := v_cutoff_date;
  RETURN NEXT;
END;
$$;

-- 3. Grant execute permission to service role
GRANT EXECUTE ON FUNCTION cleanup_old_cache(INTEGER) TO service_role;

-- 4. Unschedule existing job if it exists (to update schedule)
SELECT cron.unschedule('cleanup-old-cache') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-cache');

-- 5. Schedule the cleanup function with configured values
-- The function will use the retention_days parameter (7 days by default)
SELECT cron.schedule(
  'cleanup-old-cache',                    -- Job name
  current_setting('app.cleanup_schedule', true), -- Cron expression from config
  $$SELECT cleanup_old_cache(7)$$        -- Change '7' to your preferred retention days
);

-- 6. View scheduled jobs
SELECT jobname, schedule, command 
FROM cron.job 
WHERE jobname = 'cleanup-old-cache';

-- ========================================================================
-- USAGE EXAMPLES
-- ========================================================================

-- Manually run cleanup with default 7 days retention:
-- SELECT * FROM cleanup_old_cache();

-- Manually run cleanup with custom retention (e.g., 1 day):
-- SELECT * FROM cleanup_old_cache(1);

-- Manually run cleanup with 30 days retention:
-- SELECT * FROM cleanup_old_cache(30);

-- View cleanup history:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-old-cache')
-- ORDER BY start_time DESC LIMIT 10;

-- Change the schedule (after initial setup):
-- SELECT cron.unschedule('cleanup-old-cache');
-- SELECT cron.schedule(
--   'cleanup-old-cache',
--   '0 */6 * * *',  -- Every 6 hours
--   $$SELECT cleanup_old_cache(7)$$
-- );

-- Unschedule the job completely:
-- SELECT cron.unschedule('cleanup-old-cache');
