#!/usr/bin/env node

/**
 * Generate images with all available themes
 */

import {
  fetchContributions,
  parseContributionsData,
} from "./src/api-client.js";
import { renderWithStats, setTheme } from "./src/renderer.js";
import { exportToPNG } from "./src/renderer.js";
import { THEMES } from "./src/theme-config.js";
import { writeFileSync } from "node:fs";

const username = process.argv[2] || "spectrewolf8";
const year = process.argv[3] ? Number.parseInt(process.argv[3], 10) : 2025;

console.log(`Generating images for ${username} (${year}) with all themes...\n`);

try {
  // Fetch contribution data
  console.log(`Fetching contribution data for ${username}...`);
  const data = await fetchContributions(username, year);
  const contributionData = parseContributionsData(data);
  console.log(`Parsed ${contributionData.length} days of contribution data\n`);

  // Generate image for each theme
  const themeNames = Object.keys(THEMES);

  for (const themeName of themeNames) {
    console.log(`Generating ${themeName} theme...`);

    // Set the theme
    setTheme(THEMES[themeName]);

    // Render with stats
    const canvas = renderWithStats(contributionData);

    // Export to PNG
    const pngBuffer = exportToPNG(canvas);
    const outputFile = `output-${themeName}.png`;
    writeFileSync(outputFile, pngBuffer);

    const sizeKB = (pngBuffer.length / 1024).toFixed(1);
    console.log(`✓ Generated ${outputFile} (${sizeKB} KB)\n`);
  }

  console.log(`\n✓ Successfully generated ${themeNames.length} themed images!`);
  console.log(`Themes: ${themeNames.join(", ")}`);
} catch (error) {
  console.error("\n✗ Error:", error.message);
  process.exit(1);
}
