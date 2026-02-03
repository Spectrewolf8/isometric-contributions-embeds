#!/usr/bin/env node

/**
 * Cleanup old cached images from Supabase Storage
 * Can be run manually or scheduled with cron
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || "isometric-cache";
const RETENTION_DAYS = parseInt(process.env.CACHE_RETENTION_DAYS || "1", 10);

// Check if environment variables are set
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error(
    "❌ Missing Supabase credentials. Copy .env.example to .env and configure.",
  );
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

/**
 * Delete daily folders older than retention period
 * @returns {Promise<{deleted: number, errors: number}>}
 */
async function cleanupOldCache() {
  console.log(`\n🧹 Cleaning cache (retention: ${RETENTION_DAYS} day(s))`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoffDateStr = cutoffDate.toISOString().split("T")[0]; // YYYY-MM-DD

  console.log(`📅 Deleting folders older than ${cutoffDateStr}`);

  try {
    // List daily folders
    const { data: folders, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list("daily", {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      });

    if (listError) {
      console.error("❌ Error listing folders:", listError);
      return { deleted: 0, errors: 1 };
    }

    if (!folders || folders.length === 0) {
      console.log("✅ No daily folders found");
      return { deleted: 0, errors: 0 };
    }

    let deletedFolders = 0;
    let errors = 0;
    const foldersToDelete = [];

    // Filter folders to delete (folders older than cutoff date)
    for (const folder of folders) {
      const folderName = folder.name;

      // Check if folder name matches date pattern and is old enough
      if (
        /^\d{4}-\d{2}-\d{2}$/.test(folderName) &&
        folderName <= cutoffDateStr
      ) {
        foldersToDelete.push(folderName);
      }
    }

    if (foldersToDelete.length === 0) {
      console.log("✅ No old folders to delete");
    } else {
      console.log(`🗑️  Deleting ${foldersToDelete.length} folder(s)...`);
    }

    // Delete each old folder completely
    for (const folderName of foldersToDelete) {
      try {
        const allFiles = await listAllFiles(BUCKET_NAME, `daily/${folderName}`);

        if (allFiles.length > 0) {
          const { error: deleteError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(allFiles.map((f) => f.name));

          if (deleteError) {
            console.error(`❌ Error deleting ${folderName}:`, deleteError);
            errors++;
          } else {
            console.log(`   ✓ ${folderName} (${allFiles.length} files)`);
            deletedFolders++;
          }
        } else {
          deletedFolders++;
        }
      } catch (error) {
        console.error(`❌ Error processing ${folderName}:`, error);
        errors++;
      }
    }

    if (deletedFolders > 0 || errors > 0) {
      console.log(`\n📊 Deleted: ${deletedFolders}, Errors: ${errors}`);
    }

    return { deleted: deletedFolders, errors };
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

// Run cleanup if called directly (handles Windows paths and URL encoding)
const isMainModule = () => {
  const scriptPath = process.argv[1]?.replace(/\\/g, "/");
  const modulePath = decodeURIComponent(import.meta.url)
    .replace("file:///", "")
    .replace(/^\/([A-Z]:)/, "$1");
  return modulePath === scriptPath || import.meta.url.endsWith(process.argv[1]);
};

if (isMainModule()) {
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
