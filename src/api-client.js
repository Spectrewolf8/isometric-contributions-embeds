/**
 * GitHub Contributions API Client
 * Fetches contribution data from the GitHub Contributions API
 */

const API_BASE_URL = "https://github-contributions-api.jogruber.de/v4";

/**
 * Fetch contribution data for a GitHub user
 * @param {string} username - GitHub username
 * @param {number} year - Year to fetch contributions for (required)
 * @returns {Promise<Object>} Contribution data
 */
export async function fetchContributions(username, year) {
  if (!username) {
    throw new Error("Username is required");
  }

  if (!year) {
    throw new Error("Year is required");
  }

  // Build URL
  const params = new URLSearchParams();
  params.append("format", "nested");
  params.append("y", year.toString());

  const url = `${API_BASE_URL}/${encodeURIComponent(username)}?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching contribution data:", error);
    throw error;
  }
}

/**
 * Parse API response into a flat array of day objects
 * Compatible with the existing rendering code structure
 * @param {Object} apiData - Raw API response
 * @returns {Array<{date: Date, count: number, level: number, week: number}>}
 */
export function parseContributionsData(apiData) {
  const days = [];

  if (!apiData.contributions) {
    return days;
  }

  // The nested format has year -> month -> day -> {date, count, level}
  // We need to collect all days and sort them by date
  for (const [year, months] of Object.entries(apiData.contributions)) {
    // months is an object like { "1": {...days...}, "2": {...days...} }
    if (!months || typeof months !== "object") continue;

    for (const [monthKey, monthData] of Object.entries(months)) {
      // monthData is an object like { "1": {date, count, level}, "2": {...} }
      if (!monthData || typeof monthData !== "object") continue;

      for (const [dayKey, day] of Object.entries(monthData)) {
        if (day && day.date && typeof day === "object") {
          days.push({
            date: new Date(day.date),
            count: day.count || 0,
            level: day.level || 0,
            color: getLevelColor(day.level || 0),
          });
        }
      }
    }
  }

  // Sort by date
  days.sort((a, b) => a.date - b.date);

  // Assign week numbers based on calendar weeks (Sunday as start of week)
  days.forEach((day) => {
    const dayOfWeek = day.date.getDay(); // 0 = Sunday
    const startOfYear = new Date(day.date.getFullYear(), 0, 1);
    const daysSinceStartOfYear = Math.floor(
      (day.date - startOfYear) / (24 * 60 * 60 * 1000),
    );
    const weekOfYear = Math.floor(
      (daysSinceStartOfYear + startOfYear.getDay()) / 7,
    );
    day.week = weekOfYear;
  });

  return days;
}

/**
 * Get hex color for a contribution level (0-4)
 * These colors approximate GitHub's contribution graph colors
 * @param {number} level - Contribution level (0-4)
 * @returns {string} Hex color without # prefix
 */
function getLevelColor(level) {
  // GitHub's default theme colors (approximate)
  const colors = {
    0: "ebedf0", // No contributions
    1: "9be9a8", // Low contributions
    2: "40c463", // Medium-low contributions
    3: "30a14e", // Medium-high contributions
    4: "216e39", // High contributions
  };

  return colors[level] || colors[0];
}

/**
 * Get contribution statistics summary
 * @param {Object} apiData - Raw API response
 * @returns {Object} Statistics including total, year, etc.
 */
export function getContributionStats(apiData) {
  // Total is an object like { "2025": 800 }
  const totalObj = apiData.total || {};
  const year = Object.keys(totalObj)[0] || new Date().getFullYear();
  const total = totalObj[year] || 0;

  return {
    total: total,
    year: parseInt(year, 10),
    username: "", // API doesn't return username in response
  };
}
