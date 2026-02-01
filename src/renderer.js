/**
 * Isometric Contribution Graph Renderer
 * Generates isometric 3D visualization from contribution data
 */

import { createCanvas, registerFont } from "canvas";
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

// ============================================================================
// STYLING CONFIGURATION
// Customize colors, fonts, and other visual properties here
// ============================================================================
const STYLE_CONFIG = {
  // Box Title (Contributions, Streaks)
  title: {
    color: "#24292f",
    fontFamily: "Segoe UI",
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 24,
  },

  // Stat Values (large numbers: 800, 45, etc.)
  value: {
    color: "#2BD853",
    fontFamily: "Segoe UI",
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 30,
  },

  // Stat Labels (Total, This week, Best day, etc.)
  label: {
    color: "#ffffff",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },

  // Subtext (date ranges: Jan 1 → Dec 31)
  subtext: {
    color: "#b7bdc8",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },

  // Average text ("Average:")
  averageText: {
    color: "#24292f",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
  },

  // Average value (the number)
  averageValue: {
    color: "#2ea043",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "600",
  },

  // Average unit ("/ day")
  averageUnit: {
    color: "#57606a",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
  },

  // Box styling
  box: {
    backgroundColor: "rgba(22, 27, 34, 0.6)",
    borderColor: "rgba(48, 54, 61, 0.6)",
    borderWidth: 1,
    borderRadius: 8,
    shadowColor: "rgba(0, 0, 0, 0.4)",
    shadowBlur: 10,
    shadowOffsetX: 0,
    shadowOffsetY: 3,
  },

  // Dimensions
  dimensions: {
    contributionsBoxWidth: 370,
    contributionsBoxHeight: 90,
    streaksBoxWidth: 270,
    streaksBoxHeight: 80,
    titleHeight: 24,
    averageBottomMargin: 16,
  },
};

// Helper function to create font string
function getFontString(style) {
  return `${style.fontWeight} ${style.fontSize}px "${style.fontFamily}", sans-serif`;
}
// ============================================================================

// Get directory paths
const __dirname = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(__dirname, "..", "fonts");

// Register Segoe UI fonts from local fonts directory
try {
  registerFont(join(fontsDir, "Segoe UI.ttf"), {
    family: "Segoe UI",
    weight: "normal",
  });
  registerFont(join(fontsDir, "Segoe UI Bold.ttf"), {
    family: "Segoe UI",
    weight: "600",
  });
  registerFont(join(fontsDir, "Segoe UI Bold.ttf"), {
    family: "Segoe UI",
    weight: "bold",
  });
  console.log("✓ Registered Segoe UI fonts");
} catch (e) {
  console.warn("⚠ Could not register Segoe UI fonts:", e.message);
}

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
  drawContributionsBox(ctx, stats, canvas.width - 390, 25);

  // Draw streaks box (bottom left)
  drawStreaksBox(ctx, stats, 25, canvas.height - 125);

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
  const boxWidth = STYLE_CONFIG.dimensions.contributionsBoxWidth;
  const boxHeight = STYLE_CONFIG.dimensions.contributionsBoxHeight;
  const titleHeight = STYLE_CONFIG.dimensions.titleHeight;

  // Title (outside, above the box) - aligned with left border of box
  ctx.fillStyle = STYLE_CONFIG.title.color;
  ctx.font = getFontString(STYLE_CONFIG.title);
  ctx.fillText("Contributions", x, y + 16);

  // Box starts below title
  const boxY = y + titleHeight;

  // Drop shadow
  ctx.shadowColor = STYLE_CONFIG.box.shadowColor;
  ctx.shadowBlur = STYLE_CONFIG.box.shadowBlur;
  ctx.shadowOffsetX = STYLE_CONFIG.box.shadowOffsetX;
  ctx.shadowOffsetY = STYLE_CONFIG.box.shadowOffsetY;

  // Box background (transparent/semi-transparent)
  ctx.fillStyle = STYLE_CONFIG.box.backgroundColor;
  ctx.beginPath();
  ctx.roundRect(x, boxY, boxWidth, boxHeight, STYLE_CONFIG.box.borderRadius);
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Border
  ctx.strokeStyle = STYLE_CONFIG.box.borderColor;
  ctx.lineWidth = STYLE_CONFIG.box.borderWidth;
  ctx.stroke();

  // Stats row
  const itemY = boxY + 12;

  // Total
  drawFlexStatItem(
    ctx,
    stats.countTotal.toString(),
    "Total",
    stats.datesTotal,
    x + 16,
    itemY,
  );

  // This week
  drawFlexStatItem(
    ctx,
    stats.weekCountTotal.toString(),
    "This week",
    stats.weekDatesTotal,
    x + 130,
    itemY,
  );

  // Best day
  const bestDayDate = stats.dateBest.includes(" ")
    ? stats.dateBest.split(" ").slice(0, 2).join(" ")
    : stats.dateBest;
  drawFlexStatItem(
    ctx,
    stats.maxCount.toString(),
    "Best day",
    bestDayDate,
    x + 250,
    itemY,
  );

  // Average (outside, below the box, right-aligned)
  const avgY = boxY + boxHeight + STYLE_CONFIG.dimensions.averageBottomMargin;
  ctx.fillStyle = STYLE_CONFIG.averageText.color;
  ctx.font = getFontString(STYLE_CONFIG.averageText);
  const avgText = "Average:";
  const avgNumText = stats.averageCount.toString();
  const dayText = "/ day";

  const dayWidth = ctx.measureText(dayText).width;
  ctx.font = getFontString(STYLE_CONFIG.averageValue);
  const numWidth = ctx.measureText(avgNumText).width;
  ctx.font = getFontString(STYLE_CONFIG.averageText);
  const avgWidth = ctx.measureText(avgText).width;

  const totalWidth = avgWidth + 4 + numWidth + 4 + dayWidth;
  const startX = x + boxWidth - totalWidth;

  ctx.fillText(avgText, startX, avgY);

  ctx.fillStyle = STYLE_CONFIG.averageValue.color;
  ctx.font = getFontString(STYLE_CONFIG.averageValue);
  ctx.fillText(avgNumText, startX + avgWidth + 4, avgY);

  ctx.fillStyle = STYLE_CONFIG.averageUnit.color;
  ctx.font = getFontString(STYLE_CONFIG.averageUnit);
  ctx.fillText(dayText, startX + avgWidth + 4 + numWidth + 4, avgY);
}

/**
 * Draw streaks statistics box
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} stats - Statistics object
 * @param {number} x - X position
 * @param {number} y - Y position
 */
function drawStreaksBox(ctx, stats, x, y) {
  const boxWidth = STYLE_CONFIG.dimensions.streaksBoxWidth;
  const boxHeight = STYLE_CONFIG.dimensions.streaksBoxHeight;
  const titleHeight = STYLE_CONFIG.dimensions.titleHeight;

  // Title (outside, above the box) - aligned with left border of box
  ctx.fillStyle = STYLE_CONFIG.title.color;
  ctx.font = getFontString(STYLE_CONFIG.title);
  ctx.fillText("Streaks", x, y + 16);

  // Box starts below title
  const boxY = y + titleHeight;

  // Drop shadow
  ctx.shadowColor = STYLE_CONFIG.box.shadowColor;
  ctx.shadowBlur = STYLE_CONFIG.box.shadowBlur;
  ctx.shadowOffsetX = STYLE_CONFIG.box.shadowOffsetX;
  ctx.shadowOffsetY = STYLE_CONFIG.box.shadowOffsetY;

  // Box background (transparent/semi-transparent)
  ctx.fillStyle = STYLE_CONFIG.box.backgroundColor;
  ctx.beginPath();
  ctx.roundRect(x, boxY, boxWidth, boxHeight, STYLE_CONFIG.box.borderRadius);
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Border
  ctx.strokeStyle = STYLE_CONFIG.box.borderColor;
  ctx.lineWidth = STYLE_CONFIG.box.borderWidth;
  ctx.stroke();

  // Stats row
  const itemY = boxY + 12;

  // Longest
  const longestDays = stats.streakLongest === 1 ? "day" : "days";
  const longestValue = `${stats.streakLongest} ${longestDays}`;
  drawFlexStatItem(
    ctx,
    longestValue,
    "Longest",
    stats.datesLongest,
    x + 16,
    itemY,
  );

  // Current
  const currentDays = stats.streakCurrent === 1 ? "day" : "days";
  const currentValue =
    stats.streakCurrent === 0
      ? "0 days"
      : `${stats.streakCurrent} ${currentDays}`;
  const currentSubtext =
    stats.streakCurrent === 0 ? "No current streak" : stats.datesCurrent;
  drawFlexStatItem(
    ctx,
    currentValue,
    "Current",
    currentSubtext,
    x + 145,
    itemY,
  );
}

/**
 * Draw a flex stat item (vertical stack: value → label → subtext)
 * Matches HTML structure: d-block f2 text-bold → d-block text-small text-bold → d-block text-small color-fg-muted
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} value - Main value (large, green, bold)
 * @param {string} label - Label text (small, bold, white)
 * @param {string} subtext - Subtext (small, gray, date range)
 * @param {number} x - X position
 * @param {number} y - Y position
 */
function drawFlexStatItem(ctx, value, label, subtext, x, y) {
  // Value (large number)
  ctx.fillStyle = STYLE_CONFIG.value.color;
  ctx.font = getFontString(STYLE_CONFIG.value);
  ctx.fillText(value, x, y + 22);

  // Label (Total, This week, etc.)
  ctx.fillStyle = STYLE_CONFIG.label.color;
  ctx.font = getFontString(STYLE_CONFIG.label);
  ctx.fillText(label, x, y + 38);

  // Subtext (date range) - single line
  if (subtext && subtext.length > 0) {
    ctx.fillStyle = STYLE_CONFIG.subtext.color;
    ctx.font = getFontString(STYLE_CONFIG.subtext);
    ctx.fillText(subtext, x, y + 54);
  }
}
