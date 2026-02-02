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
--   '0 0 * * 0'    = Weekly on Sunday at midnight1
--   '0 */12 * * *' = Every 12 hours
DO $$ 
BEGIN
  PERFORM set_config('app.cleanup_schedule', '0 3 * * *', false);
END $$;

-- ========================================================================

-- 1. Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create a function to delete old cache files
-- Cache structure: {username}/{date}/{hash}.png
-- Files are organized by date folders (YYYY-MM-DD format)
CREATE OR REPLACE FUNCTION cleanup_old_cache(retention_days INTEGER DEFAULT 1)
RETURNS TABLE(deleted_count INTEGER, cutoff_timestamp TIMESTAMP)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_cutoff_date TIMESTAMP;
  v_cutoff_date_str TEXT;
  v_file RECORD;
  v_total_files INTEGER := 0;
  v_old_files_count INTEGER := 0;
BEGIN
  -- Calculate cutoff date
  v_cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
  v_cutoff_date_str := TO_CHAR(v_cutoff_date, 'YYYY-MM-DD');

  -- Count total files in bucket
  SELECT COUNT(*) INTO v_total_files
  FROM storage.objects
  WHERE bucket_id = 'isometric-cache';

  RAISE NOTICE 'Starting cleanup of files older than % (retention: % days)', v_cutoff_date, retention_days;
  RAISE NOTICE 'Total files in bucket: %', v_total_files;
  RAISE NOTICE 'Cutoff date string: %', v_cutoff_date_str;

  -- Count how many files match our criteria (created_at OR date folder older than cutoff)
  SELECT COUNT(*) INTO v_old_files_count
  FROM storage.objects
  WHERE bucket_id = 'isometric-cache'
    AND (
      created_at < v_cutoff_date
      OR (
        name ~ '^[^/]+/\d{4}-\d{2}-\d{2}/[^/]+\.png$'
        AND SPLIT_PART(name, '/', 2) < v_cutoff_date_str
      )
      OR name LIKE '%.emptyFolderPlaceholder'
    );

  RAISE NOTICE 'Found % files matching cleanup criteria', v_old_files_count;

  -- Iterate and delete matching files (use created_at OR date-folder OR placeholder)
  FOR v_file IN
    SELECT id, name, created_at
    FROM storage.objects
    WHERE bucket_id = 'isometric-cache'
      AND (
        created_at < v_cutoff_date
        OR (
          name ~ '^[^/]+/\d{4}-\d{2}-\d{2}/[^/]+\.png$'
          AND SPLIT_PART(name, '/', 2) < v_cutoff_date_str
        )
        OR name LIKE '%.emptyFolderPlaceholder'
      )
  LOOP
    BEGIN
      DELETE FROM storage.objects
      WHERE id = v_file.id;

      IF FOUND THEN
        v_deleted_count := v_deleted_count + 1;
        RAISE NOTICE 'Deleted: % (created: %)', v_file.name, v_file.created_at;
      ELSE
        RAISE WARNING 'Could not delete % (id: %)', v_file.name, v_file.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error deleting %: % (SQLSTATE: %)', v_file.name, SQLERRM, SQLSTATE;
    END;
  END LOOP;

  RAISE NOTICE 'Cleanup complete: % out of % files deleted', v_deleted_count, v_old_files_count;

  -- Return results
  deleted_count := v_deleted_count;
  cutoff_timestamp := v_cutoff_date;
  RETURN NEXT;
END;
$$;

-- 3. Grant execute permission to service role
GRANT EXECUTE ON FUNCTION cleanup_old_cache(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_cache(INTEGER) TO postgres;
GRANT EXECUTE ON FUNCTION cleanup_old_cache(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION cleanup_old_cache(INTEGER) TO authenticated;

-- 3b. Grant necessary permissions on storage.objects for the function
-- This ensures the function can read and delete from storage.objects
GRANT SELECT, DELETE ON storage.objects TO postgres;
GRANT USAGE ON SCHEMA storage TO postgres;

-- 4. Unschedule existing job if it exists (to update schedule)
SELECT cron.unschedule('cleanup-old-cache') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-cache');

-- 5. Schedule the cleanup function with configured values
-- The function will use the retention_days parameter (1 days by default)
SELECT cron.schedule(
  'cleanup-old-cache',                    -- Job name
  current_setting('app.cleanup_schedule', true), -- Cron expression from config
  $$SELECT cleanup_old_cache(1)$$        -- Change '1' to your preferred retention days
);

-- 6. View scheduled jobs
SELECT jobname, schedule, command 
FROM cron.job 
WHERE jobname = 'cleanup-old-cache';

-- ========================================================================
-- USAGE EXAMPLES
-- ========================================================================

-- Manually run cleanup with default 1 days retention:
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
--   $$SELECT cleanup_old_cache(1)$$
-- );

-- Unschedule the job completely:
-- SELECT cron.unschedule('cleanup-old-cache');

-- ========================================================================
-- DIAGNOSTICS - Run these to troubleshoot issues
-- ========================================================================

-- STEP 1: Check if files exist in the bucket at all
-- SELECT COUNT(*) as total_files FROM storage.objects WHERE bucket_id = 'isometric-cache';

-- STEP 2: See actual file names and structure
-- SELECT 
--   name,
--   created_at,
--   metadata
-- FROM storage.objects 
-- WHERE bucket_id = 'isometric-cache'
-- ORDER BY created_at DESC
-- LIMIT 10;

-- STEP 3: Extract and check date folders
-- SELECT 
--   name,
--   SPLIT_PART(name, '/', 1) as username,
--   SPLIT_PART(name, '/', 2) as date_folder,
--   SPLIT_PART(name, '/', 3) as filename,
--   created_at,
--   NOW() - created_at as age_by_timestamp
-- FROM storage.objects
-- WHERE bucket_id = 'isometric-cache'
-- ORDER BY created_at DESC
-- LIMIT 20;

-- STEP 4: Check which files match the pattern
-- SELECT 
--   name,
--   name ~ '^[^/]+/\d{4}-\d{2}-\d{2}/[^/]+\.png$' as matches_pattern,
--   SPLIT_PART(name, '/', 2) as date_folder
-- FROM storage.objects
-- WHERE bucket_id = 'isometric-cache'
-- LIMIT 10;

-- STEP 5: See which files would be deleted with 1 day retention
-- SELECT 
--   name,
--   SPLIT_PART(name, '/', 2) as date_folder,
--   SPLIT_PART(name, '/', 2) < TO_CHAR(NOW() - INTERVAL '1 day', 'YYYY-MM-DD') as would_delete,
--   TO_CHAR(NOW() - INTERVAL '1 day', 'YYYY-MM-DD') as cutoff_date_str,
--   created_at
-- FROM storage.objects
-- WHERE bucket_id = 'isometric-cache'
--   AND name ~ '^[^/]+/\d{4}-\d{2}-\d{2}/[^/]+\.png$'
-- ORDER BY date_folder DESC;

-- STEP 6: Count files by date folder
-- SELECT 
--   SPLIT_PART(name, '/', 2) as date_folder,
--   COUNT(*) as file_count
-- FROM storage.objects
-- WHERE bucket_id = 'isometric-cache'
--   AND name ~ '^[^/]+/\d{4}-\d{2}-\d{2}/[^/]+\.png$'
-- GROUP BY date_folder
-- ORDER BY date_folder DESC;

-- STEP 7: Test manual deletion of a specific file (DANGEROUS - uncomment carefully)
-- DELETE FROM storage.objects 
-- WHERE bucket_id = 'isometric-cache' 
--   AND name = 'your-username/2026-02-01/somehash.png'
-- RETURNING id, name, created_at;

-- STEP 8: Check bucket configuration and RLS policies
-- SELECT * FROM storage.buckets WHERE id = 'isometric-cache';

-- STEP 9: Check if there are any RLS policies blocking deletion
-- SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
