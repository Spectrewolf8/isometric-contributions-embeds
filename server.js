#!/usr/bin/env node

/**
 * Minimal and Fast Isometric Contributions API Server
 * Features:
 * - Daily caching per username (one generation per day) using Supabase Storage
 * - Multiple fetches served from cache
 * - Customizable query parameters for themes, dimensions, stats
 * - PNG image output
 */

import "dotenv/config";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  fetchContributions,
  parseContributionsData,
} from "./src/api-client.js";
import {
  renderIsometricChart,
  renderWithStats,
  exportToPNG,
  setTheme,
} from "./src/renderer.js";
import {
  GITHUB_THEME,
  DARK_THEME,
  LIGHT_THEME,
  NEON_THEME,
  MINIMAL_THEME,
  OCEAN_THEME,
} from "./src/theme-config.js";
// Available themes mapping
const AVAILABLE_THEMES = {
  github: GITHUB_THEME,
  dark: DARK_THEME,
  light: LIGHT_THEME,
  neon: NEON_THEME,
  minimal: MINIMAL_THEME,
  ocean: OCEAN_THEME,
};
const PORT = process.env.PORT || 3000;
const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || "isometric-cache";
const __dirname = dirname(fileURLToPath(import.meta.url));
const documentationHTML = readFileSync(
  join(__dirname, "docs", "index.html"),
  "utf8",
);

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

/**
 * Generate cache key for a request
 * @param {string} username
 * @param {Object} params
 * @returns {string}
 */
function getCacheKey(username, params) {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const paramsStr = JSON.stringify(params);
  const hash = Buffer.from(paramsStr).toString("base64").replace(/[/+=]/g, "");
  return `daily/${date}/${username}/${hash}.png`;
}

/**
 * Get cached image from Supabase Storage
 * @param {string} cacheKey
 * @returns {Promise<Buffer|null>}
 */
async function getCachedImage(cacheKey) {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(cacheKey);

    if (error) {
      return null;
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("Cache retrieval error:", error);
    return null;
  }
}

/**
 * Store image in Supabase Storage
 * @param {string} cacheKey
 * @param {Buffer} imageBuffer
 * @returns {Promise<void>}
 */
async function cacheImage(cacheKey, imageBuffer) {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(cacheKey, imageBuffer, {
        contentType: "image/png",
        cacheControl: "86400", // 24 hours
        upsert: true, // Overwrite if exists
      });

    if (error) {
      console.error("Cache storage error:", error);
    }
  } catch (error) {
    console.error("Cache storage error:", error);
  }
}

/**
 * Track API usage analytics
 * @param {Object} params - Request parameters
 * @param {boolean} cacheHit - Whether request was served from cache
 * @returns {Promise<void>}
 */
async function trackAnalytics(params, cacheHit) {
  try {
    // Handle year parameter - convert "none" to null, otherwise to integer
    let year = null;
    if (params.year && params.year !== "none") {
      year = parseInt(params.year, 10);
    }

    const { error } = await supabase.from("api_analytics").insert({
      username: params.username,
      theme: params.theme || "github",
      width: params.width || 1000,
      height: params.height || 600,
      stats: params.stats || false,
      credit: params.credit || false,
      year: year,
      cache_hit: cacheHit,
    });

    if (error) {
      console.error("Analytics tracking error:", error);
    }
  } catch (error) {
    console.error("Analytics tracking error:", error);
  }
}

/**
 * Parse query parameters from URL
 * @param {string} search
 * @returns {Object}
 */
function parseQueryParams(search) {
  const params = new URLSearchParams(search);
  const yearParam =
    params.get("year") ??
    params.get("y") ??
    params.get("Year") ??
    params.get("Y");

  // Default to "none" (365-day rolling window) if no year specified
  // Or explicitly set to "none" to use 365-day mode
  let year = "none";
  if (yearParam) {
    if (yearParam.toLowerCase() === "none") {
      year = "none";
    } else if (!Number.isNaN(Number.parseInt(yearParam, 10))) {
      year = Number.parseInt(yearParam, 10);
    }
  }

  return {
    username: params.get("username") || "",
    year: year,
    width: params.get("width") ? parseInt(params.get("width"), 10) : 1000,
    height: params.get("height") ? parseInt(params.get("height"), 10) : 600,
    stats: params.get("stats") === "true",
    credit: params.get("credit") === "true",
    theme: params.get("theme") || "github",
  };
}

/**
 * Generate isometric contribution graph
 * @param {Object} params
 * @returns {Promise<Buffer>}
 */
async function generateGraph(params) {
  const { username, year, width, height, stats, credit, theme } = params;

  // Set theme if specified
  if (theme && AVAILABLE_THEMES[theme.toLowerCase()]) {
    setTheme(AVAILABLE_THEMES[theme.toLowerCase()]);
  }

  // Determine if using 365-day mode
  const use365Days = year === "none";
  const yearDisplay = use365Days ? "365-day history" : `year: ${year}`;

  const data = await fetchContributions(username, year);
  const days = parseContributionsData(data, use365Days);
  console.log(`[DATA]  ${username} — ${days.length} days (${yearDisplay})`);

  if (days.length === 0) {
    const periodText = use365Days ? "past 365 days" : `year ${year}`;
    throw new Error(
      `No contribution data found for ${username} in ${periodText}`,
    );
  }

  // Render options
  const renderOptions = {
    width,
    height,
    username: credit ? username : null,
  };

  // Render chart
  const canvas = stats
    ? renderWithStats(days, renderOptions)
    : renderIsometricChart(days, renderOptions);

  // Export to PNG buffer
  const buffer = exportToPNG(canvas);

  // Warn if data seems incomplete (likely due to API partial failure).
  // For 365-day mode we expect ~365 days; flag if we got less than 180.
  // This result is still returned but the caller can skip caching it.
  const isLikelyIncomplete = use365Days && days.length < 180;
  if (isLikelyIncomplete) {
    console.warn(
      `[WARN]  ${username} — only ${days.length}/365 days returned, skipping cache`,
    );
  }

  return { buffer, isLikelyIncomplete };
}

/**
 * Send PNG response
 * @param {http.ServerResponse} res
 * @param {Buffer} imageBuffer
 * @param {boolean} fromCache
 */
function sendPNGResponse(res, imageBuffer, fromCache = false) {
  const headers = {
    "Content-Type": "image/png",
    "Content-Length": imageBuffer.length,
    "Cache-Control": "public, max-age=3600, must-revalidate", // 1 hour with revalidation
    "X-Cache": fromCache ? "HIT" : "MISS",
  };

  res.writeHead(200, headers);
  res.end(imageBuffer);
}

/**
 * Send error response
 * @param {http.ServerResponse} res
 * @param {number} statusCode
 * @param {string} message
 */
function sendErrorResponse(res, statusCode, message) {
  const errorBody = JSON.stringify({ error: message });
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(errorBody),
  });
  res.end(errorBody);
}

/**
 * Send HTML documentation
 * @param {http.ServerResponse} res
 */
function sendDocumentation(res) {
  res.writeHead(200, {
    "Content-Type": "text/html",
    "Content-Length": Buffer.byteLength(documentationHTML),
  });
  res.end(documentationHTML);
}

/**
 * Main request handler
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Documentation page
  if (url.pathname === "/" || url.pathname === "/docs") {
    return sendDocumentation(res);
  }

  // Health check
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
  }

  // API endpoint
  if (url.pathname === "/api/graph") {
    try {
      const params = parseQueryParams(url.search);

      // Validate username
      if (!params.username) {
        return sendErrorResponse(
          res,
          400,
          "Missing required parameter: username",
        );
      }

      const { username, year, theme, width, height, stats, credit } = params;
      const paramsLog = `theme=${theme} year=${year} size=${width}x${height} stats=${stats} credit=${credit}`;
      console.log(`[REQ]   ${username} — ${paramsLog}`);

      // Generate cache key
      const cacheKey = getCacheKey(params.username, params);

      // Check cache
      const cachedImage = await getCachedImage(cacheKey);
      if (cachedImage) {
        console.log(`[HIT]   ${username} — served from cache`);
        // Track analytics (don't wait)
        trackAnalytics(params, true).catch((err) =>
          console.error("Analytics error:", err),
        );
        return sendPNGResponse(res, cachedImage, true);
      }

      // Generate new graph
      console.log(`[MISS]  ${username} — generating new graph`);
      const { buffer: imageBuffer, isLikelyIncomplete } =
        await generateGraph(params);

      // Track analytics (don't wait)
      trackAnalytics(params, false).catch((err) =>
        console.error("Analytics error:", err),
      );

      // Only cache complete graphs — skip caching if data seems partial
      // to prevent a broken image from being served all day from cache.
      if (!isLikelyIncomplete) {
        cacheImage(cacheKey, imageBuffer)
          .then(() =>
            console.log(`[SAVE]  ${params.username} — cached to Supabase`),
          )
          .catch((err) =>
            console.error(
              `[ERROR] ${params.username} — cache save failed:`,
              err,
            ),
          );
      }

      // Send response
      return sendPNGResponse(res, imageBuffer, false);
    } catch (error) {
      const isNotFound =
        error.message.includes("Could not resolve to a User") ||
        error.message.includes("not found");
      const statusCode = isNotFound ? 404 : 500;
      console.error(`[ERROR] ${statusCode} — ${error.message}`);
      return sendErrorResponse(res, statusCode, error.message);
    }
  }

  // Analytics API endpoint
  if (url.pathname === "/api/analytics") {
    try {
      // Fetch all stats in parallel
      const [dailyResult, lifetimeResult, dailyNewUsersResult] =
        await Promise.all([
          supabase.rpc("get_daily_stats", { days_back: 30 }),
          supabase.rpc("get_lifetime_stats"),
          supabase.rpc("get_daily_new_users"),
        ]);

      if (dailyResult.error) {
        console.error("Analytics fetch error:", dailyResult.error);
        return sendErrorResponse(res, 500, "Failed to fetch analytics");
      }

      const analyticsData = JSON.stringify({
        daily_stats: dailyResult.data || [],
        lifetime_stats: lifetimeResult.data?.[0] || null,
        daily_new_users: dailyNewUsersResult.data || [],
        updated_at: new Date().toISOString(),
      });

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300", // 5 minutes cache
        "Access-Control-Allow-Origin": "*",
      });
      return res.end(analyticsData);
    } catch (error) {
      console.error("Analytics error:", error);
      return sendErrorResponse(res, 500, error.message);
    }
  }

  // Serve static media files
  if (url.pathname.startsWith("/media/")) {
    try {
      const filePath = join(process.cwd(), url.pathname.slice(1)); // Remove leading slash
      const fs = await import("node:fs");
      const fileBuffer = fs.readFileSync(filePath);

      // Determine content type based on file extension
      const ext = url.pathname.toLowerCase().split(".").pop();
      const contentTypes = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        svg: "image/svg+xml",
      };

      res.writeHead(200, {
        "Content-Type": contentTypes[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=86400", // 24 hours
      });
      return res.end(fileBuffer);
    } catch (error) {
      return sendErrorResponse(res, 404, "File not found");
    }
  }

  // 404 for unknown routes
  return sendErrorResponse(res, 404, "Not Found");
}

// Create server
async function verifyGitHubAPI() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("  ✗ GITHUB_TOKEN not set — API will not work\n");
    return;
  }

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "{ viewer { login } }" }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0].message);

    const login = json?.data?.viewer?.login ?? "unknown";
    console.log(`[GH]    GitHub authenticated as @${login}\n`);
  } catch (err) {
    console.error(`[ERROR] GitHub API check failed: ${err.message}\n`);
  }
}

const server = createServer(handleRequest);

server.listen(PORT, async () => {
  console.log(`
  🎨 Isometric Contributions API Server                     
  Status:     Running                                       
  Port:       ${PORT.toString().padEnd(46)}
  Storage:    Supabase (${BUCKET_NAME})${" ".repeat(
    46 - 19 - BUCKET_NAME.length,
  )}
                                                            
  Documentation: http://localhost:${PORT}/                     
  API Endpoint:  http://localhost:${PORT}/api/graph            
  Health Check:  http://localhost:${PORT}/health               

  `);
  console.log("Press Ctrl+C to stop the server\n");
  await verifyGitHubAPI();
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\nShutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
