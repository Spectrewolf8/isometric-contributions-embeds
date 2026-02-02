#!/usr/bin/env node

/**
 * Scheduled Cache Cleanup Service
 * Runs cleanup automatically on a schedule
 */

import "dotenv/config";
import cron from "node-cron";
import { cleanupOldCache } from "./cleanup-cache.js";

const CLEANUP_SCHEDULE = process.env.CLEANUP_SCHEDULE || "0 3 * * *"; // Default: 3 AM daily

console.log("🚀 Cache Cleanup Scheduler Starting...");
console.log(`📅 Schedule: ${CLEANUP_SCHEDULE}`);
console.log(`   (Cron format: minute hour day month weekday)`);
console.log(`   Examples:`);
console.log(`     "0 3 * * *"    = Daily at 3 AM`);
console.log(`     "0 */6 * * *"  = Every 6 hours`);
console.log(`     "0 */12 * * *" = Every 12 hours`);
console.log(`     "*/30 * * * *" = Every 30 minutes`);
console.log("");

// Validate cron expression
if (!cron.validate(CLEANUP_SCHEDULE)) {
  console.error(`❌ Invalid cron schedule: ${CLEANUP_SCHEDULE}`);
  process.exit(1);
}

// Schedule cleanup task
const task = cron.schedule(
  CLEANUP_SCHEDULE,
  async () => {
    console.log(
      `\n⏰ [${new Date().toISOString()}] Running scheduled cleanup...`,
    );
    try {
      const { deleted, errors } = await cleanupOldCache();
      console.log(
        `✅ Scheduled cleanup completed: ${deleted} deleted, ${errors} errors`,
      );
    } catch (error) {
      console.error("❌ Scheduled cleanup failed:", error);
    }
  },
  {
    scheduled: true,
    timezone: process.env.TZ || "UTC",
  },
);

console.log("✅ Scheduler is running");
console.log(`🌍 Timezone: ${process.env.TZ || "UTC"}`);
console.log(
  "💡 Tip: Set TZ environment variable for your timezone (e.g., TZ=America/New_York)",
);
console.log("\n⌨️  Press Ctrl+C to stop\n");

// Run cleanup immediately on startup (optional)
if (process.env.RUN_ON_STARTUP === "true") {
  console.log("🏃 Running initial cleanup on startup...");
  cleanupOldCache()
    .then(({ deleted, errors }) => {
      console.log(
        `✅ Initial cleanup completed: ${deleted} deleted, ${errors} errors\n`,
      );
    })
    .catch((error) => {
      console.error("❌ Initial cleanup failed:", error);
    });
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n⏹️  SIGTERM received, stopping scheduler...");
  task.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n⏹️  SIGINT received, stopping scheduler...");
  task.stop();
  process.exit(0);
});
