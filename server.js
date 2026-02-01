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
import { createClient } from "@supabase/supabase-js";
import {
  fetchContributions,
  parseContributionsData,
} from "./src/api-client.js";
import {
  renderIsometricChart,
  renderWithStats,
  exportToPNG,
} from "./src/renderer.js";

const PORT = process.env.PORT || 3000;
const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || "isometric-cache";

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
  };
}

/**
 * Generate isometric contribution graph
 * @param {Object} params
 * @returns {Promise<Buffer>}
 */
async function generateGraph(params) {
  const { username, year, width, height, stats, credit } = params;

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
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Isometric Contributions API</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            max-width: 900px;
            margin: 40px auto;
            padding: 0 20px;
            line-height: 1.6;
            color: #24292f;
        }
        h1 { color: #0969da; }
        h2 { color: #1a7f37; margin-top: 32px; }
        code {
            background: #f6f8fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 12px;
        }
        pre {
            background: #f6f8fa;
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
        }
        th, td {
            border: 1px solid #d0d7de;
            padding: 8px 12px;
            text-align: left;
        }
        th {
            background: #f6f8fa;
            font-weight: 600;
        }
        .example {
            margin: 16px 0;
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            background: #0969da;
            color: white;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <h1>🎨 Isometric Contributions API</h1>
    <p>Generate beautiful isometric contribution graphs with caching and customization.</p>
    
    <h2>Endpoint</h2>
    <pre>GET /api/graph</pre>
    
    <h2>Query Parameters</h2>
    <table>
        <thead>
            <tr>
                <th>Parameter</th>
                <th>Type</th>
                <th>Required</th>
                <th>Default</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><code>username</code></td>
                <td>string</td>
                <td><span class="badge">Required</span></td>
                <td>-</td>
                <td>GitHub username</td>
            </tr>
            <tr>
              <td><code>year</code> / <code>y</code></td>
                <td>number</td>
                <td>Optional</td>
                <td>current year</td>
              <td>Year to fetch contributions for (supports <code>year</code> or <code>y</code>)</td>
            </tr>
            <tr>
                <td><code>width</code></td>
                <td>number</td>
                <td>Optional</td>
                <td>1000</td>
                <td>Image width in pixels</td>
            </tr>
            <tr>
                <td><code>height</code></td>
                <td>number</td>
                <td>Optional</td>
                <td>600</td>
                <td>Image height in pixels</td>
            </tr>
            <tr>
                <td><code>stats</code></td>
                <td>boolean</td>
                <td>Optional</td>
                <td>false</td>
                <td>Include statistics overlay (use <code>stats=true</code>)</td>
            </tr>
            <tr>
                <td><code>credit</code></td>
                <td>boolean</td>
                <td>Optional</td>
                <td>false</td>
                <td>Show username credit (use <code>credit=true</code>)</td>
            </tr>
        </tbody>
    </table>
    
    <h2>Examples</h2>
    
    <div class="example">
        <h3>Basic usage:</h3>
        <pre>/api/graph?username=spectrewolf8</pre>
    </div>
    
    <div class="example">
        <h3>With specific year:</h3>
        <pre>/api/graph?username=spectrewolf8&year=2025</pre>
    </div>
    
    <div class="example">
        <h3>With stats:</h3>
        <pre>/api/graph?username=spectrewolf8&stats=true</pre>
    </div>
    
    <div class="example">
        <h3>Custom dimensions:</h3>
        <pre>/api/graph?username=spectrewolf8&width=1920&height=1080</pre>
    </div>
    
    <div class="example">
        <h3>Full customization:</h3>
        <pre>/api/graph?username=spectrewolf8&year=2025&width=1200&height=700&stats=true&credit=true</pre>
    </div>
    
    <h2>Caching</h2>
    <p>
        Images are cached per username and parameters combination for 24 hours. 
        Multiple requests with the same parameters will be served from cache instantly.
        Check the <code>X-Cache</code> header: <code>HIT</code> for cached, <code>MISS</code> for newly generated.
    </p>
    
    <h2>Response Headers</h2>
    <ul>
        <li><code>Content-Type: image/png</code></li>
        <li><code>Cache-Control: public, max-age=86400</code> (24 hours)</li>
        <li><code>X-Cache: HIT | MISS</code> (cache status)</li>
    </ul>
    
    <h2>Error Responses</h2>
    <p>Errors return JSON with an error message:</p>
    <pre>{
  "error": "Error message here"
}</pre>
    
    <h2>Try It</h2>
    <p>
        <a href="/api/graph?username=spectrewolf8&stats=true" target="_blank">
            View example graph →
        </a>
    </p>
</body>
</html>`;

  res.writeHead(200, {
    "Content-Type": "text/html",
    "Content-Length": Buffer.byteLength(html),
  });
  res.end(html);
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

  // 404 for unknown routes
  return sendErrorResponse(res, 404, "Not Found");
}

// Create server
const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  🎨 Isometric Contributions API Server                     ║
╠════════════════════════════════════════════════════════════╣
║  Status:     Running                                       ║
║  Port:       ${PORT.toString().padEnd(46)}║
║  Storage:    Supabase (${BUCKET_NAME})${" ".repeat(46 - 19 - BUCKET_NAME.length)}║
║                                                            ║
║  Documentation: http://localhost:${PORT}/                     ║
║  API Endpoint:  http://localhost:${PORT}/api/graph            ║
║  Health Check:  http://localhost:${PORT}/health               ║
╚════════════════════════════════════════════════════════════╝
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
