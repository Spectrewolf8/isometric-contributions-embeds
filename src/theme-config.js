/**
 * Theme Configuration
 * Predefined color schemes for different visual styles
 */

/**
 * GitHub Style (Default)
 * Matches GitHub's contribution graph styling
 */
export const GITHUB_THEME = {
  title: {
    color: "#24292f",
    fontFamily: "Segoe UI",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
  value: {
    color: "#2BD853",
    fontFamily: "Segoe UI",
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 30,
  },
  label: {
    color: "#ffffff",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  subtext: {
    color: "#b7bdc8",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  averageText: {
    color: "#24292f",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
  },
  averageValue: {
    color: "#2ea043",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "600",
  },
  averageUnit: {
    color: "#57606a",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
  },
  box: {
    backgroundColor: "rgb(22, 27, 34)",
    borderColor: "rgb(48, 54, 61)",
    borderWidth: 2,
    borderRadius: 8,
    shadowColor: "rgba(0, 0, 0, 0.4)",
    shadowBlur: 10,
    shadowOffsetX: 0,
    shadowOffsetY: 3,
  },
  graph: {
    colors: {
      level0: "#161b22",
      level1: "#0e4429",
      level2: "#006d32",
      level3: "#26a641",
      level4: "#39d353",
    },
  },
  dimensions: {
    contributionsBoxWidth: 316,
    contributionsBoxHeight: 84,
    streaksBoxWidth: 254,
    streaksBoxHeight: 80,
    titleHeight: 24,
    averageBottomMargin: 16,
  },
};

/**
 * Dark Theme
 * High contrast dark mode design
 */
export const DARK_THEME = {
  title: {
    color: "#e6edf3",
    fontFamily: "Segoe UI",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
  value: {
    color: "#3fb950",
    fontFamily: "Segoe UI",
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 30,
  },
  label: {
    color: "#ffffff",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  subtext: {
    color: "#8b949e",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  averageText: {
    color: "#c9d1d9",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
  },
  averageValue: {
    color: "#3fb950",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "600",
  },
  averageUnit: {
    color: "#8b949e",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
  },
  box: {
    backgroundColor: "rgb(13, 17, 23)",
    borderColor: "rgb(48, 54, 61)",
    borderWidth: 2,
    borderRadius: 8,
    shadowColor: "rgba(0, 0, 0, 0.6)",
    shadowBlur: 12,
    shadowOffsetX: 0,
    shadowOffsetY: 4,
  },
  graph: {
    colors: {
      level0: "#0d1117",
      level1: "#0e4429",
      level2: "#006d32",
      level3: "#26a641",
      level4: "#39d353",
    },
  },
  dimensions: {
    contributionsBoxWidth: 316,
    contributionsBoxHeight: 84,
    streaksBoxWidth: 254,
    streaksBoxHeight: 80,
    titleHeight: 24,
    averageBottomMargin: 16,
  },
};

/**
 * Light Theme
 * Clean light mode design
 */
export const LIGHT_THEME = {
  title: {
    color: "#1f2328",
    fontFamily: "Segoe UI",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
  value: {
    color: "#1a7f37",
    fontFamily: "Segoe UI",
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 30,
  },
  label: {
    color: "#24292f",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  subtext: {
    color: "#656d76",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  averageText: {
    color: "#1f2328",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
  },
  averageValue: {
    color: "#1a7f37",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "600",
  },
  averageUnit: {
    color: "#656d76",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
  },
  box: {
    backgroundColor: "rgb(255, 255, 255)",
    borderColor: "rgb(208, 215, 222)",
    borderWidth: 2,
    borderRadius: 8,
    shadowColor: "rgba(31, 35, 40, 0.15)",
    shadowBlur: 8,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
  },
  graph: {
    colors: {
      level0: "#ebedf0",
      level1: "#9be9a8",
      level2: "#40c463",
      level3: "#30a14e",
      level4: "#216e39",
    },
  },
  dimensions: {
    contributionsBoxWidth: 316,
    contributionsBoxHeight: 84,
    streaksBoxWidth: 254,
    streaksBoxHeight: 80,
    titleHeight: 24,
    averageBottomMargin: 16,
  },
};

/**
 * Neon Theme
 * Vibrant cyberpunk-inspired colors
 */
export const NEON_THEME = {
  title: {
    color: "#4d0099",
    fontFamily: "Segoe UI",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
  value: {
    color: "#ff00ff",
    fontFamily: "Segoe UI",
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 30,
  },
  label: {
    color: "#ffffff",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  subtext: {
    color: "#a0a0ff",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  averageText: {
    color: "#4d0099",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
  },
  averageValue: {
    color: "#ff00ff",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "600",
  },
  averageUnit: {
    color: "#a0a0ff",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
  },
  box: {
    backgroundColor: "rgb(10, 10, 30)",
    borderColor: "rgb(255, 0, 255)",
    borderWidth: 2,
    borderRadius: 8,
    shadowColor: "rgba(255, 0, 255, 0.5)",
    shadowBlur: 15,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  },
  graph: {
    colors: {
      level0: "#1a0033",
      level1: "#4d0099",
      level2: "#8000ff",
      level3: "#b366ff",
      level4: "#e600ff",
    },
  },
  dimensions: {
    contributionsBoxWidth: 316,
    contributionsBoxHeight: 84,
    streaksBoxWidth: 254,
    streaksBoxHeight: 80,
    titleHeight: 24,
    averageBottomMargin: 16,
  },
};

/**
 * Minimal Theme
 * Subtle, minimal design
 */
export const MINIMAL_THEME = {
  title: {
    color: "#333333",
    fontFamily: "Segoe UI",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
  value: {
    color: "#000000",
    fontFamily: "Segoe UI",
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 30,
  },
  label: {
    color: "#666666",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  subtext: {
    color: "#999999",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  averageText: {
    color: "#333333",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
  },
  averageValue: {
    color: "#000000",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "600",
  },
  averageUnit: {
    color: "#999999",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
  },
  box: {
    backgroundColor: "rgb(255, 255, 255)",
    borderColor: "rgb(51, 51, 51)",
    borderWidth: 2,
    borderRadius: 8,
    shadowColor: "rgba(0, 0, 0, 0.1)",
    shadowBlur: 5,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
  },
  graph: {
    colors: {
      level0: "#f5f5f5",
      level1: "#d4d4d4",
      level2: "#a3a3a3",
      level3: "#737373",
      level4: "#404040",
    },
  },
  dimensions: {
    contributionsBoxWidth: 316,
    contributionsBoxHeight: 84,
    streaksBoxWidth: 254,
    streaksBoxHeight: 80,
    titleHeight: 24,
    averageBottomMargin: 16,
  },
};

/**
 * Ocean Theme
 * Cool blue-teal color palette
 */
export const OCEAN_THEME = {
  title: {
    color: "#0891b2",
    fontFamily: "Segoe UI",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
  value: {
    color: "#14b8a6",
    fontFamily: "Segoe UI",
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 30,
  },
  label: {
    color: "#f0f9ff",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  subtext: {
    color: "#67e8f9",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
  },
  averageText: {
    color: "#0891b2",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
  },
  averageValue: {
    color: "#14b8a6",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "600",
  },
  averageUnit: {
    color: "#0e7490",
    fontFamily: "Segoe UI",
    fontSize: 12,
    fontWeight: "400",
  },
  box: {
    backgroundColor: "rgb(7, 89, 133)",
    borderColor: "rgb(34, 211, 238)",
    borderWidth: 2,
    borderRadius: 8,
    shadowColor: "rgba(6, 182, 212, 0.3)",
    shadowBlur: 10,
    shadowOffsetX: 0,
    shadowOffsetY: 3,
  },
  graph: {
    colors: {
      level0: "#0c4a6e",
      level1: "#0e7490",
      level2: "#06b6d4",
      level3: "#22d3ee",
      level4: "#67e8f9",
    },
  },
  dimensions: {
    contributionsBoxWidth: 316,
    contributionsBoxHeight: 84,
    streaksBoxWidth: 254,
    streaksBoxHeight: 80,
    titleHeight: 24,
    averageBottomMargin: 16,
  },
};

/**
 * Available themes
 */
export const THEMES = {
  github: GITHUB_THEME,
  dark: DARK_THEME,
  light: LIGHT_THEME,
  neon: NEON_THEME,
  minimal: MINIMAL_THEME,
  ocean: OCEAN_THEME,
};

/**
 * Get theme by name
 * @param {string} themeName - Name of the theme
 * @returns {Object} Theme configuration
 */
export function getTheme(themeName = "github") {
  return THEMES[themeName] || GITHUB_THEME;
}
