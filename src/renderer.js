/**
 * Isometric Contribution Graph Renderer
 * Generates isometric 3D visualization from contribution data
 */

import { createCanvas } from "canvas";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";
import {
  calculateStreaks,
  datesDayDifference,
  precisionRound,
  sameDay,
} from "./utils.js";

// Create a browser-like environment for obelisk
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Image = dom.window.Image;
globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement;

// Patch canvas element creation to use node-canvas
const originalCreateElement = globalThis.document.createElement.bind(
  globalThis.document,
);
globalThis.document.createElement = function (tagName) {
  if (tagName.toLowerCase() === "canvas") {
    const canvas = createCanvas(1, 1);
    // Add setAttribute method that node-canvas doesn't have
    canvas.setAttribute = function (attr, value) {
      if (attr === "width") this.width = Number.parseInt(value, 10);
      else if (attr === "height") this.height = Number.parseInt(value, 10);
    };
    // Add getAttribute method
    canvas.getAttribute = function (attr) {
      if (attr === "width") return this.width;
      if (attr === "height") return this.height;
      return null;
    };
    return canvas;
  }
  return originalCreateElement(tagName);
};

// Load obelisk.js for isometric rendering
const __dirname = dirname(fileURLToPath(import.meta.url));
const obeliskPath = join(__dirname, "obelisk.min.js");
const obeliskCode = readFileSync(obeliskPath, "utf8");

// biome-ignore lint/security/noGlobalEval: Required for loading obelisk library
eval(obeliskCode);
const obelisk = globalThis.window.obelisk;

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * Render isometric contribution graph to canvas
 * @param {Array} days - Array of day objects with {date, count, color, week}
 * @param {Object} options - Rendering options
 * @param {number} options.width - Canvas width (default: 1000)
 * @param {number} options.height - Canvas height (default: 600)
 * @param {number} options.cubeSize - Size of each cube (default: 16)
 * @param {number} options.maxHeight - Maximum cube height (default: 100)
 * @returns {Canvas} Canvas with rendered graph
 */
export function renderIsometricChart(days, options = {}) {
  const {
    width = 1000,
    height = 600,
    cubeSize = 16,
    maxHeight = 100,
  } = options;

  // Create canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Clear canvas with transparent background
  ctx.clearRect(0, 0, width, height);

  // Calculate max count for scaling
  const maxCount = Math.max(...days.map((d) => d.count));

  // Group days by week
  const weeks = Object.values(
    days.reduce((acc, day) => {
      const key = day.week;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(day);
      return acc;
    }, {}),
  );

  // Setup obelisk
  const point = new obelisk.Point(130, 90);
  const pixelView = new obelisk.PixelView(canvas, point);

  const GH_OFFSET = 14;
  let transform = GH_OFFSET;

  // Render each week
  for (const week of weeks) {
    const x = transform / (GH_OFFSET + 1);
    transform += GH_OFFSET;
    let offsetY = 0;

    // Render each day in the week
    for (const day of week) {
      const y = offsetY / GH_OFFSET;
      offsetY += 13;

      let cubeHeight = 3;
      if (maxCount > 0) {
        cubeHeight += Number.parseInt((maxHeight / maxCount) * day.count, 10);
      }

      const dimension = new obelisk.CubeDimension(
        cubeSize,
        cubeSize,
        cubeHeight,
      );
      const color = new obelisk.CubeColor().getByHorizontalColor(
        Number.parseInt(day.color, 16),
      );
      const cube = new obelisk.Cube(dimension, color, false);
      const p3d = new obelisk.Point3D(cubeSize * x, cubeSize * y, 0);
      pixelView.renderObject(cube, p3d);
    }
  }

  return canvas;
}

/**
 * Calculate statistics from contribution data
 * @param {Array} days - Array of day objects
 * @returns {Object} Statistics object
 */
export function calculateStats(days) {
  if (!days || days.length === 0) {
    return {
      yearTotal: 0,
      maxCount: 0,
      averageCount: 0,
      bestDay: null,
      dateBest: "No activity found",
      streakLongest: 0,
      datesLongest: "No longest streak",
      streakCurrent: 0,
      datesCurrent: "No current streak",
      countTotal: "0",
      datesTotal: "",
      weekTotal: 0,
      weekCountTotal: "0",
      weekDatesTotal: "",
    };
  }

  const firstDay = days[0].date;
  const lastDay =
    days.find((d) => sameDay(d.date, new Date()))?.date ?? days.at(-1).date;

  // Calculate streaks
  const stats = calculateStreaks(days);

  // Calculate totals
  const yearTotal = stats.yearTotal;
  const maxCount = stats.maxCount;
  const bestDay = stats.bestDay;

  // Format dates
  const dateFirst = dateFormat.format(firstDay);
  const dateLast = dateFormat.format(lastDay);
  const datesTotal = `${dateFirst} → ${dateLast}`;

  // Average contributions per day
  const dayDifference = datesDayDifference(firstDay, lastDay);
  const averageCount = precisionRound(yearTotal / dayDifference, 2);

  // Best day
  const dateBest = bestDay ? dateFormat.format(bestDay) : "No activity found";

  // Format streak dates
  let datesLongest = "No longest streak";
  if (stats.streakLongest > 0) {
    const longestStart = dateFormat.format(stats.longestStreakStart);
    const longestEnd = dateFormat.format(stats.longestStreakEnd);
    datesLongest = `${longestStart} → ${longestEnd}`;
  }

  let datesCurrent = "No current streak";
  if (stats.streakCurrent > 0) {
    const currentStart = dateFormat.format(stats.currentStreakStart);
    const currentEnd = dateFormat.format(stats.currentStreakEnd);
    datesCurrent = `${currentStart} → ${currentEnd}`;
  }

  // Week total (last week)
  const weeks = Object.values(
    days.reduce((acc, day) => {
      const key = day.week;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(day);
      return acc;
    }, {}),
  );
  const currentWeekDays = weeks.at(-1) || [];
  let weekTotal = 0;
  for (const d of currentWeekDays) {
    weekTotal += d.count;
  }

  const weekStartDay = currentWeekDays[0]?.date;
  const weekDateFirst = weekStartDay ? dateFormat.format(weekStartDay) : "";
  const weekDatesTotal = weekStartDay ? `${weekDateFirst} → ${dateLast}` : "";

  return {
    yearTotal,
    countTotal: yearTotal.toLocaleString(),
    datesTotal,
    maxCount,
    dateBest,
    averageCount,
    streakLongest: stats.streakLongest,
    datesLongest,
    streakCurrent: stats.streakCurrent,
    datesCurrent,
    weekTotal,
    weekCountTotal: weekTotal.toLocaleString(),
    weekDatesTotal,
  };
}

/**
 * Export canvas to PNG buffer
 * @param {Canvas} canvas - Canvas object
 * @returns {Buffer} PNG image buffer
 */
export function exportToPNG(canvas) {
  return canvas.toBuffer("image/png");
}

/**
 * Export canvas to SVG string
 * Note: SVG export requires a different approach since canvas is raster
 * This is a placeholder for future SVG implementation
 * @param {Canvas} canvas - Canvas object
 * @returns {string} Data URL of the canvas
 */
export function exportToDataURL(canvas) {
  return canvas.toDataURL();
}

/**
 * Render contribution graph with stats overlay
 * @param {Array} days - Array of day objects
 * @param {Object} options - Rendering options
 * @returns {Canvas} Canvas with graph and stats
 */
export function renderWithStats(days, options = {}) {
  const canvas = renderIsometricChart(days, options);
  const stats = calculateStats(days);

  const ctx = canvas.getContext("2d");

  // Draw contributions box (top right)
  drawContributionsBox(ctx, stats, canvas.width - 400, 30);

  // Draw streaks box (bottom left)
  drawStreaksBox(ctx, stats, 40, canvas.height - 180);

  return canvas;
}

/**
 * Draw contributions statistics box
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} stats - Statistics object
 * @param {number} x - X position
 * @param {number} y - Y position
 */
function drawContributionsBox(ctx, stats, x, y) {
  const boxWidth = 370;
  const boxHeight = 140;

  // Box background and border
  ctx.fillStyle = "rgba(22, 27, 34, 0.9)";
  ctx.strokeStyle = "rgba(48, 54, 61, 1)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, boxWidth, boxHeight, 8);
  ctx.fill();
  ctx.stroke();

  // Title
  ctx.fillStyle = "#e6edf3";
  ctx.font =
    'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText("Contributions", x + 15, y + 28);

  // Stats boxes
  const statY = y + 55;
  const statHeight = 70;

  // Total
  drawStatItem(
    ctx,
    stats.countTotal,
    "Total",
    stats.datesTotal,
    x + 15,
    statY,
    110,
    statHeight,
  );

  // This week
  drawStatItem(
    ctx,
    stats.weekCountTotal,
    "This week",
    stats.weekDatesTotal,
    x + 135,
    statY,
    110,
    statHeight,
  );

  // Best day
  const bestDayDate = stats.dateBest.split(" ").slice(0, 2).join(" ");
  drawStatItem(
    ctx,
    stats.maxCount.toString(),
    "Best day",
    bestDayDate,
    x + 255,
    statY,
    100,
    statHeight,
  );

  // Average (bottom right)
  ctx.fillStyle = "#8b949e";
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(`Average: `, x + boxWidth - 140, y + boxHeight - 15);

  ctx.fillStyle = "#2ea043";
  ctx.font =
    'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(`${stats.averageCount}`, x + boxWidth - 85, y + boxHeight - 15);

  ctx.fillStyle = "#8b949e";
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(` / day`, x + boxWidth - 60, y + boxHeight - 15);
}

/**
 * Draw streaks statistics box
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} stats - Statistics object
 * @param {number} x - X position
 * @param {number} y - Y position
 */
function drawStreaksBox(ctx, stats, x, y) {
  const boxWidth = 330;
  const boxHeight = 140;

  // Box background and border
  ctx.fillStyle = "rgba(22, 27, 34, 0.9)";
  ctx.strokeStyle = "rgba(48, 54, 61, 1)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, boxWidth, boxHeight, 8);
  ctx.fill();
  ctx.stroke();

  // Title
  ctx.fillStyle = "#e6edf3";
  ctx.font =
    'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText("Streaks", x + 15, y + 28);

  // Stats boxes
  const statY = y + 55;
  const statHeight = 70;

  // Longest
  const longestValue = `${stats.streakLongest} days`;
  drawStatItem(
    ctx,
    longestValue,
    "Longest",
    stats.datesLongest,
    x + 15,
    statY,
    150,
    statHeight,
  );

  // Current
  const currentValue = `${stats.streakCurrent} days`;
  drawStatItem(
    ctx,
    currentValue,
    "Current",
    stats.datesCurrent,
    x + 175,
    statY,
    140,
    statHeight,
  );
}

/**
 * Draw a single stat item
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} value - Main value
 * @param {string} label - Label text
 * @param {string} subtext - Subtext
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 */
function drawStatItem(ctx, value, label, subtext, x, y, width, height) {
  // Value (large green number)
  ctx.fillStyle = "#2ea043";
  ctx.font =
    'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(value, x, y + 25);

  // Label (bold white)
  ctx.fillStyle = "#e6edf3";
  ctx.font =
    'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(label, x, y + 45);

  // Subtext (gray, smaller)
  ctx.fillStyle = "#8b949e";
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const lines = subtext.split(" → ");
  if (lines.length === 2) {
    ctx.fillText(lines[0], x, y + 60);
    ctx.fillText(`→ ${lines[1]}`, x, y + 72);
  } else {
    ctx.fillText(subtext, x, y + 60);
  }
}
