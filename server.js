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
  return `${username}/${date}/${hash}.png`;
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
  const parsedYear =
    yearParam && !Number.isNaN(Number.parseInt(yearParam, 10))
      ? Number.parseInt(yearParam, 10)
      : new Date().getFullYear(); // Default to current year instead of null
  return {
    username: params.get("username") || "",
    year: parsedYear,
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

  // Fetch contribution data
  const data = await fetchContributions(username, year);
  const days = parseContributionsData(data);

  if (days.length === 0) {
    throw new Error("No contribution data found");
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
  return exportToPNG(canvas);
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

      // Generate cache key
      const cacheKey = getCacheKey(params.username, params);

      // Check cache
      const cachedImage = await getCachedImage(cacheKey);
      if (cachedImage) {
        console.log(`[CACHE HIT] ${params.username} - Serving from Supabase`);
        return sendPNGResponse(res, cachedImage, true);
      }

      // Generate new graph
      console.log(`[CACHE MISS] ${params.username} - Generating new graph...`);
      const imageBuffer = await generateGraph(params);

      // Save to Supabase cache (don't wait)
      cacheImage(cacheKey, imageBuffer)
        .then(() =>
          console.log(`[CACHED] ${params.username} - Saved to Supabase`),
        )
        .catch((err) =>
          console.error(`[CACHE ERROR] ${params.username}:`, err),
        );

      // Send response
      return sendPNGResponse(res, imageBuffer, false);
    } catch (error) {
      console.error("Error:", error);
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
const server = createServer(handleRequest);

server.listen(PORT, () => {
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
  console.log("💡 Cache cleanup runs automatically via Supabase pg_cron\n");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\nShutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
