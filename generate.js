#!/usr/bin/env node

/**
 * CLI tool to generate isometric contribution graphs
 * Usage: node generate.js <username> [year] [output] [--stats]
 */

import { writeFileSync } from "node:fs";
import {
  fetchContributions,
  parseContributionsData,
} from "./src/api-client.js";
import {
  renderIsometricChart,
  renderWithStats,
  calculateStats,
  exportToPNG,
} from "./src/renderer.js";

const args = process.argv.slice(2);
const username = args[0];
const year =
  args[1] && !args[1].startsWith("--") ? Number.parseInt(args[1], 10) : null;
const hasStatsFlag = args.includes("--stats");

// Determine output filename
let output;
if (args.length >= 3 && !args[2].startsWith("--")) {
  output = args[2];
} else {
  output = `${username}-contributions.png`;
}

if (!username) {
  console.error("Usage: node generate.js <username> [year] [output] [--stats]");
  console.error(
    "Example: node generate.js spectrewolf8 2025 graph.png --stats",
  );
  console.error("\nOptions:");
  console.error("  --stats    Include statistics overlay on the image");
  process.exit(1);
}

async function main() {
  try {
    console.log(`Fetching contribution data for ${username}...`);

    // Fetch data from API
    const data = await fetchContributions(username, year);
    const days = parseContributionsData(data);

    if (days.length === 0) {
      console.error("No contribution data found");
      process.exit(1);
    }

    console.log(`Parsed ${days.length} days of contribution data`);

    // Calculate statistics
    const stats = calculateStats(days);
    console.log("\n=== Statistics ===");
    console.log(`Total: ${stats.countTotal} contributions`);
    console.log(
      `Best day: ${stats.dateBest} (${stats.maxCount} contributions)`,
    );
    console.log(`Average: ${stats.averageCount} per day`);
    console.log(`Longest streak: ${stats.streakLongest} days`);
    console.log(`Current streak: ${stats.streakCurrent} days`);

    // Render isometric chart
    console.log("\nRendering isometric chart...");
    const canvas = hasStatsFlag
      ? renderWithStats(days, { width: 1000, height: 600 })
      : renderIsometricChart(days, { width: 1000, height: 600 });

    if (hasStatsFlag) {
      console.log("✓ Statistics overlay included");
    }

    // Export to PNG
    console.log(`Exporting to ${output}...`);
    const buffer = exportToPNG(canvas);
    writeFileSync(output, buffer);

    console.log(`\n✓ Successfully generated ${output}`);
    console.log(`  Size: ${(buffer.length / 1024).toFixed(1)} KB`);
    console.log(`  Dimensions: ${canvas.width}x${canvas.height}`);
  } catch (error) {
    console.error("\n✗ Error:", error.message);
    process.exit(1);
  }
}

main();
