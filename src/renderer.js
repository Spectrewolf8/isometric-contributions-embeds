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
import { GITHUB_THEME } from "./theme-config.js";

// STYLING CONFIGURATION
// Import different themes from theme-config.js or customize here
// Available themes: GITHUB_THEME, DARK_THEME, LIGHT_THEME, NEON_THEME, MINIMAL_THEME, OCEAN_THEME
let STYLE_CONFIG = { ...GITHUB_THEME };

/**
 * Set the active theme
 * @param {Object} theme - Theme configuration object
 */
export function setTheme(theme) {
  STYLE_CONFIG = { ...theme };
}

/**
 * Get current theme configuration
 * @returns {Object} Current STYLE_CONFIG
 */
export function getStyleConfig() {
  return STYLE_CONFIG;
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
 * @param {string} options.username - Username to display as credit (optional)
 * @returns {Canvas} Canvas with rendered graph
 */
export function renderIsometricChart(days, options = {}) {
  const { width = 1000, height = 600, username = null } = options;

  // Scale cube size based on canvas dimensions (base size 16 for 1000x600)
  const baseWidth = 1000;
  const baseHeight = 600;
  const baseCubeSize = 16;
  const scale = Math.min(width / baseWidth, height / baseHeight);
  const rawCubeSize = baseCubeSize * scale;
  const cubeSize = Math.max(6, Math.round(rawCubeSize / 2) * 2);
  const cubeScale = cubeSize / baseCubeSize;
  const maxHeight = 100 * cubeScale;

  // Create canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Enable antialiasing for smoother rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.antialias = "subpixel";

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

  // Calculate proper offsets so the tallest cube never gets clipped at top.
  // obelisk projection: screen_y_top = floor(x3d/2 + y3d/2) - cubeHeight + offsetY
  // The worst case (min screen_y_top) is week 0 / day 0 at maximum height.
  const GH_OFFSET_base = 14 * cubeScale;
  const x3d_first = cubeSize * (GH_OFFSET_base / (GH_OFFSET_base + 1));
  const actualMaxCubeHeight =
    Math.round(3 * cubeScale) + (maxCount > 0 ? Math.round(maxHeight) : 0);
  const topMargin = Math.round(8 * cubeScale);
  const minOffsetY =
    topMargin + actualMaxCubeHeight - Math.floor(x3d_first / 2);

  const offsetX = width * 0.13;
  const offsetY = Math.max(height * 0.15, minOffsetY);

  // Setup obelisk with scaled position
  const point = new obelisk.Point(offsetX, offsetY);
  const pixelView = new obelisk.PixelView(canvas, point);

  // Scale the offsets to match cube size scaling
  const GH_OFFSET = GH_OFFSET_base;
  const DAY_OFFSET = 13 * cubeScale;
  let transform = GH_OFFSET;

  // Render each week
  for (const week of weeks) {
    const x = transform / (GH_OFFSET + 1);
    transform += GH_OFFSET;
    let dayOffsetY = 0;

    // Render each day in the week
    for (const day of week) {
      const y = dayOffsetY / GH_OFFSET;
      dayOffsetY += DAY_OFFSET;

      let cubeHeight = Math.round(3 * cubeScale);
      if (maxCount > 0) {
        cubeHeight += Math.round((maxHeight / maxCount) * day.count);
      }
      cubeHeight = Math.max(cubeHeight, 3);

      // Get color from theme based on contribution level
      const level = day.level || 0;
      const themeColor =
        STYLE_CONFIG.graph?.colors?.[`level${level}`] || day.color;
      const colorHex = themeColor.replace("#", "");

      const dimension = new obelisk.CubeDimension(
        cubeSize,
        cubeSize,
        cubeHeight,
      );
      const color = new obelisk.CubeColor().getByHorizontalColor(
        Number.parseInt(colorHex, 16),
      );
      const cube = new obelisk.Cube(dimension, color, false);
      const p3d = new obelisk.Point3D(cubeSize * x, cubeSize * y, 0);
      pixelView.renderObject(cube, p3d);
    }
  }

  // Draw username credit if provided
  if (username) {
    drawUsernameCredit(ctx, username, canvas.width, canvas.height);
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
  // Find today's date in the data, or use the last day if today is not in the data
  const todayDate = new Date();
  const todayEntry = days.find((d) => {
    const dayDate = d.date instanceof Date ? d.date : new Date(d.date);
    return sameDay(dayDate, todayDate);
  });
  const lastDay = todayEntry?.date ?? days.at(-1).date;

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
  const averageCount =
    dayDifference > 0 ? precisionRound(yearTotal / dayDifference, 2) : 0;

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

  // Week total (current calendar week - from Sunday to today)
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  // Get the start of the current week (Sunday)
  const currentWeekStart = new Date(currentDate);
  const dayOfWeek = currentWeekStart.getDay(); // 0 = Sunday, 1 = Monday, etc.
  currentWeekStart.setDate(currentWeekStart.getDate() - dayOfWeek); // Go back to Sunday
  currentWeekStart.setHours(0, 0, 0, 0);

  const currentWeekDays = days.filter((d) => {
    const dayDate = d.date instanceof Date ? d.date : new Date(d.date);
    const normalizedDay = new Date(dayDate);
    normalizedDay.setHours(0, 0, 0, 0);
    return normalizedDay >= currentWeekStart && normalizedDay <= currentDate;
  });

  let weekTotal = 0;
  for (const d of currentWeekDays) {
    weekTotal += d.count;
  }

  const weekStartDay = currentWeekDays[0]?.date;
  const weekEndDay = currentWeekDays.at(-1)?.date;
  const weekDateFirst = weekStartDay ? dateFormat.format(weekStartDay) : "";
  const weekDateLast = weekEndDay ? dateFormat.format(weekEndDay) : "";
  const weekDatesTotal =
    weekStartDay && weekEndDay ? `${weekDateFirst} → ${weekDateLast}` : "";

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
  // Extract username before passing to renderIsometricChart to avoid double rendering
  const { username, ...chartOptions } = options;
  const canvas = renderIsometricChart(days, chartOptions);
  const stats = calculateStats(days);

  const ctx = canvas.getContext("2d");

  // Calculate scale factor based on canvas size (base size: 1000x600)
  const scaleFactor = Math.min(canvas.width / 1000, canvas.height / 600);

  // Draw contributions box (top right) - scaled and positioned
  const contributionsBoxWidth =
    STYLE_CONFIG.dimensions.contributionsBoxWidth * scaleFactor;
  const margin = 25 * scaleFactor;
  drawContributionsBox(
    ctx,
    stats,
    canvas.width - contributionsBoxWidth - margin,
    margin,
    scaleFactor,
  );

  // Draw streaks box (bottom left) - scaled and positioned
  const streaksBoxHeight =
    STYLE_CONFIG.dimensions.streaksBoxHeight +
    STYLE_CONFIG.dimensions.titleHeight +
    STYLE_CONFIG.dimensions.averageBottomMargin;
  drawStreaksBox(
    ctx,
    stats,
    margin,
    canvas.height - streaksBoxHeight * scaleFactor - margin,
    scaleFactor,
  );

  // Draw username credit if provided
  if (username) {
    drawUsernameCredit(ctx, username, canvas.width, canvas.height);
  }

  return canvas;
}

/**
 * Draw contributions statistics box
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} stats - Statistics object
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} scale - Scale factor for responsive sizing
 */
function drawContributionsBox(ctx, stats, x, y, scale = 1) {
  const boxWidth = STYLE_CONFIG.dimensions.contributionsBoxWidth * scale;
  const boxHeight = STYLE_CONFIG.dimensions.contributionsBoxHeight * scale;
  const titleHeight = STYLE_CONFIG.dimensions.titleHeight * scale;

  // Title (outside, above the box) - aligned with left border of box
  ctx.fillStyle = STYLE_CONFIG.title.color;
  const titleFontSize = STYLE_CONFIG.title.fontSize * scale;
  ctx.font = `${STYLE_CONFIG.title.fontWeight} ${titleFontSize}px "${STYLE_CONFIG.title.fontFamily}", sans-serif`;
  ctx.fillText("Contributions", x, y + 16 * scale);

  // Box starts below title
  const boxY = y + titleHeight;

  // Drop shadow
  ctx.shadowColor = STYLE_CONFIG.box.shadowColor;
  ctx.shadowBlur = STYLE_CONFIG.box.shadowBlur * scale;
  ctx.shadowOffsetX = STYLE_CONFIG.box.shadowOffsetX * scale;
  ctx.shadowOffsetY = STYLE_CONFIG.box.shadowOffsetY * scale;

  // Box background (transparent/semi-transparent)
  ctx.fillStyle = STYLE_CONFIG.box.backgroundColor;
  ctx.beginPath();
  ctx.roundRect(
    x,
    boxY,
    boxWidth,
    boxHeight,
    STYLE_CONFIG.box.borderRadius * scale,
  );
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Border
  ctx.strokeStyle = STYLE_CONFIG.box.borderColor;
  ctx.lineWidth = STYLE_CONFIG.box.borderWidth * scale;
  ctx.stroke();

  // Stats row
  const itemY = boxY + 12 * scale;

  // Total
  drawFlexStatItem(
    ctx,
    stats.countTotal.toString(),
    "Total",
    stats.datesTotal,
    x + 16 * scale,
    itemY,
    scale,
  );

  // This week
  drawFlexStatItem(
    ctx,
    stats.weekCountTotal.toString(),
    "This week",
    stats.weekDatesTotal,
    x + 130 * scale,
    itemY,
    scale,
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
    x + 250 * scale,
    itemY,
    scale,
  );

  // Average (outside, below the box, right-aligned)
  const avgY =
    boxY + boxHeight + STYLE_CONFIG.dimensions.averageBottomMargin * scale;
  const avgTextFontSize = STYLE_CONFIG.averageText.fontSize * scale;
  const avgValueFontSize = STYLE_CONFIG.averageValue.fontSize * scale;
  const avgUnitFontSize = STYLE_CONFIG.averageUnit.fontSize * scale;

  ctx.fillStyle = STYLE_CONFIG.averageText.color;
  ctx.font = `${STYLE_CONFIG.averageText.fontWeight} ${avgTextFontSize}px "${STYLE_CONFIG.averageText.fontFamily}", sans-serif`;
  const avgText = "Average:";
  const avgNumText = stats.averageCount.toString();
  const dayText = "/ day";

  const dayWidth = ctx.measureText(dayText).width;
  ctx.font = `${STYLE_CONFIG.averageValue.fontWeight} ${avgValueFontSize}px "${STYLE_CONFIG.averageValue.fontFamily}", sans-serif`;
  const numWidth = ctx.measureText(avgNumText).width;
  ctx.font = `${STYLE_CONFIG.averageText.fontWeight} ${avgTextFontSize}px "${STYLE_CONFIG.averageText.fontFamily}", sans-serif`;
  const avgWidth = ctx.measureText(avgText).width;

  const spacing = 4 * scale;
  const totalWidth = avgWidth + spacing + numWidth + spacing + dayWidth;
  const startX = x + boxWidth - totalWidth;

  ctx.fillText(avgText, startX, avgY);

  ctx.fillStyle = STYLE_CONFIG.averageValue.color;
  ctx.font = `${STYLE_CONFIG.averageValue.fontWeight} ${avgValueFontSize}px "${STYLE_CONFIG.averageValue.fontFamily}", sans-serif`;
  ctx.fillText(avgNumText, startX + avgWidth + spacing, avgY);

  ctx.fillStyle = STYLE_CONFIG.averageUnit.color;
  ctx.font = `${STYLE_CONFIG.averageUnit.fontWeight} ${avgUnitFontSize}px "${STYLE_CONFIG.averageUnit.fontFamily}", sans-serif`;
  ctx.fillText(dayText, startX + avgWidth + spacing + numWidth + spacing, avgY);
}

/**
 * Draw streaks statistics box
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} stats - Statistics object
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} scale - Scale factor for responsive sizing
 */
function drawStreaksBox(ctx, stats, x, y, scale = 1) {
  const boxWidth = STYLE_CONFIG.dimensions.streaksBoxWidth * scale;
  const boxHeight = STYLE_CONFIG.dimensions.streaksBoxHeight * scale;
  const titleHeight = STYLE_CONFIG.dimensions.titleHeight * scale;

  // Title (outside, above the box) - aligned with left border of box
  ctx.fillStyle = STYLE_CONFIG.title.color;
  const titleFontSize = STYLE_CONFIG.title.fontSize * scale;
  ctx.font = `${STYLE_CONFIG.title.fontWeight} ${titleFontSize}px "${STYLE_CONFIG.title.fontFamily}", sans-serif`;
  ctx.fillText("Streaks", x, y + 16 * scale);

  // Box starts below title
  const boxY = y + titleHeight;

  // Drop shadow
  ctx.shadowColor = STYLE_CONFIG.box.shadowColor;
  ctx.shadowBlur = STYLE_CONFIG.box.shadowBlur * scale;
  ctx.shadowOffsetX = STYLE_CONFIG.box.shadowOffsetX * scale;
  ctx.shadowOffsetY = STYLE_CONFIG.box.shadowOffsetY * scale;

  // Box background (transparent/semi-transparent)
  ctx.fillStyle = STYLE_CONFIG.box.backgroundColor;
  ctx.beginPath();
  ctx.roundRect(
    x,
    boxY,
    boxWidth,
    boxHeight,
    STYLE_CONFIG.box.borderRadius * scale,
  );
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Border
  ctx.strokeStyle = STYLE_CONFIG.box.borderColor;
  ctx.lineWidth = STYLE_CONFIG.box.borderWidth * scale;
  ctx.stroke();

  // Stats row
  const itemY = boxY + 12 * scale;

  // Longest
  const longestDays = stats.streakLongest === 1 ? "day" : "days";
  const longestValue = `${stats.streakLongest} ${longestDays}`;
  drawFlexStatItem(
    ctx,
    longestValue,
    "Longest",
    stats.datesLongest,
    x + 16 * scale,
    itemY,
    scale,
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
    x + 145 * scale,
    itemY,
    scale,
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
 * @param {number} scale - Scale factor for responsive sizing
 */
function drawFlexStatItem(ctx, value, label, subtext, x, y, scale = 1) {
  // Value (large number)
  ctx.fillStyle = STYLE_CONFIG.value.color;
  const valueFontSize = STYLE_CONFIG.value.fontSize * scale;
  ctx.font = `${STYLE_CONFIG.value.fontWeight} ${valueFontSize}px "${STYLE_CONFIG.value.fontFamily}", sans-serif`;
  ctx.fillText(value, x, y + 22 * scale);

  // Label (Total, This week, etc.)
  ctx.fillStyle = STYLE_CONFIG.label.color;
  const labelFontSize = STYLE_CONFIG.label.fontSize * scale;
  ctx.font = `${STYLE_CONFIG.label.fontWeight} ${labelFontSize}px "${STYLE_CONFIG.label.fontFamily}", sans-serif`;
  ctx.fillText(label, x, y + 38 * scale);

  // Subtext (date range) - single line
  if (subtext && subtext.length > 0) {
    ctx.fillStyle = STYLE_CONFIG.subtext.color;
    const subtextFontSize = STYLE_CONFIG.subtext.fontSize * scale;
    ctx.font = `${STYLE_CONFIG.subtext.fontWeight} ${subtextFontSize}px "${STYLE_CONFIG.subtext.fontFamily}", sans-serif`;
    ctx.fillText(subtext, x, y + 54 * scale);
  }
}

/**
 * Draw username credit in bottom right corner
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} username - GitHub username
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 */
function drawUsernameCredit(ctx, username, canvasWidth, canvasHeight) {
  // Save context state
  ctx.save();

  // Calculate scale factor based on canvas size
  const scaleFactor = Math.min(canvasWidth / 1000, canvasHeight / 600);

  // Discrete styling - small, subtle text with scaling
  const fontSize = 11 * scaleFactor;
  const fontFamily = STYLE_CONFIG.subtext?.fontFamily || "Segoe UI";
  ctx.font = `${fontSize}px "${fontFamily}", sans-serif`;

  // Very subtle color with low opacity
  const baseColor = STYLE_CONFIG.subtext?.color || "#768390";
  ctx.fillStyle = baseColor;
  ctx.globalAlpha = 0.5; // Make it more discrete

  // Position in bottom right with padding
  const padding = 12 * scaleFactor;
  const text = `@${username}`;
  const textWidth = ctx.measureText(text).width;
  const x = canvasWidth - textWidth - padding;
  const y = canvasHeight - padding;

  ctx.fillText(text, x, y);

  // Restore context state
  ctx.restore();
}
