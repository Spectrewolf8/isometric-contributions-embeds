#!/usr/bin/env node

/**
 * Cleanup old cached images from Supabase Storage
 * Can be run manually or scheduled with cron
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || "isometric-cache";
const RETENTION_DAYS = parseInt(process.env.CACHE_RETENTION_DAYS || "1", 10);

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

/**
 * Delete files older than retention period
 * @returns {Promise<{deleted: number, errors: number}>}
 */
async function cleanupOldCache() {
  console.log(`\n🧹 Starting cache cleanup...`);
  console.log(`📅 Retention: ${RETENTION_DAYS} day(s)`);
  console.log(`📦 Bucket: ${BUCKET_NAME}`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffDateStr = cutoffDate.toISOString().split("T")[0]; // YYYY-MM-DD

  console.log(`🔪 Cutoff date: ${cutoffDateStr}`);
  console.log(`⏰ Cutoff timestamp: ${cutoffDate.toISOString()}`);

  try {
    // List all files in bucket
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list("", {
        limit: 1000,
        sortBy: { column: "created_at", order: "asc" },
      });

    if (listError) {
      console.error("❌ Error listing files:", listError);
      return { deleted: 0, errors: 1 };
    }

    if (!files || files.length === 0) {
      console.log("✅ No files found in bucket");
      return { deleted: 0, errors: 0 };
    }

    console.log(`📊 Total files in bucket: ${files.length}`);

    // Recursively list all files including subfolders
    const allFiles = await listAllFiles(BUCKET_NAME);
    console.log(`📊 Total files (including subfolders): ${allFiles.length}`);

    let deleted = 0;
    let errors = 0;
    const filesToDelete = [];

    // Filter files to delete
    for (const file of allFiles) {
      const shouldDelete = shouldDeleteFile(file, cutoffDate, cutoffDateStr);

      if (shouldDelete) {
        filesToDelete.push(file.name);
      }
    }

    console.log(`🎯 Files to delete: ${filesToDelete.length}`);

    // Delete files in batches
    if (filesToDelete.length > 0) {
      // Supabase storage remove() accepts array of paths
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(filesToDelete);

      if (error) {
        console.error("❌ Error deleting files:", error);
        errors = filesToDelete.length;
      } else {
        deleted = filesToDelete.length;
        console.log(`✅ Successfully deleted ${deleted} file(s)`);

        // Log some examples
        const examples = filesToDelete.slice(0, 5);
        examples.forEach((path) => {
          console.log(`   🗑️  ${path}`);
        });
        if (filesToDelete.length > 5) {
          console.log(`   ... and ${filesToDelete.length - 5} more`);
        }
      }
    } else {
      console.log("✅ No old files to delete");
    }

    console.log(`\n📈 Summary:`);
    console.log(`   Deleted: ${deleted}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Remaining: ${allFiles.length - deleted}`);

    return { deleted, errors };
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return { deleted: 0, errors: 1 };
  }
}

/**
 * Recursively list all files in bucket including subfolders
 * @param {string} bucketName
 * @param {string} path
 * @returns {Promise<Array>}
 */
async function listAllFiles(bucketName, path = "") {
  const allFiles = [];

  try {
    const { data: items, error } = await supabase.storage
      .from(bucketName)
      .list(path, {
        limit: 1000,
        sortBy: { column: "created_at", order: "asc" },
      });

    if (error) {
      console.error(`Error listing path ${path}:`, error);
      return allFiles;
    }

    for (const item of items) {
      const fullPath = path ? `${path}/${item.name}` : item.name;

      if (item.id) {
        // It's a file
        allFiles.push({
          name: fullPath,
          created_at: item.created_at,
          metadata: item.metadata,
        });
      } else {
        // It's a folder, recurse
        const subFiles = await listAllFiles(bucketName, fullPath);
        allFiles.push(...subFiles);
      }
    }
  } catch (error) {
    console.error(`Error in listAllFiles for path ${path}:`, error);
  }

  return allFiles;
}

/**
 * Determine if a file should be deleted
 * @param {Object} file
 * @param {Date} cutoffDate
 * @param {string} cutoffDateStr - YYYY-MM-DD format
 * @returns {boolean}
 */
function shouldDeleteFile(file, cutoffDate, cutoffDateStr) {
  // Delete .emptyFolderPlaceholder files
  if (file.name.endsWith(".emptyFolderPlaceholder")) {
    return true;
  }

  // Check creation timestamp
  if (file.created_at) {
    const fileDate = new Date(file.created_at);
    if (fileDate < cutoffDate) {
      return true;
    }
  }

  // Check date folder in path (username/YYYY-MM-DD/hash.png)
  const dateMatch = file.name.match(/\/(\d{4}-\d{2}-\d{2})\//);
  if (dateMatch) {
    const folderDate = dateMatch[1];
    if (folderDate < cutoffDateStr) {
      return true;
    }
  }

  return false;
}

// Run cleanup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupOldCache()
    .then(({ deleted, errors }) => {
      console.log("\n✨ Cleanup completed\n");
      process.exit(errors > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("💥 Fatal error:", error);
      process.exit(1);
    });
}

export { cleanupOldCache };
