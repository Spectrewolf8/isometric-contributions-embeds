/**
 * GitHub Contributions API Client
 * Primary: GitHub official GraphQL API (requires GITHUB_TOKEN)
 * Fallback: third-party contributions API
 */

const THIRD_PARTY_API = "https://github-contributions-api.jogruber.de/v4";
const GITHUB_GRAPHQL_API = "https://api.github.com/graphql";

/**
 * Fetch with retry and exponential backoff
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} retries
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, retries = 3) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      // Retry on 5xx or 429 (rate limit)
      if (response.status >= 500 || response.status === 429) {
        lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
        if (attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
          continue;
        }
        throw lastError;
      }
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

// ---------- GitHub official GraphQL API ----------

const CONTRIBUTIONS_QUERY = `
query($username: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $username) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
            color
            weekday
          }
        }
      }
    }
  }
}`;

/**
 * Fetch contributions using GitHub's official GraphQL API.
 * Requires GITHUB_TOKEN env var.
 * @param {string} username
 * @param {string} token
 * @param {Date} from
 * @param {Date} to
 * @returns {Promise<Array>} flat array of contributionDay objects
 */
async function fetchGitHubGraphQL(username, token, from, to) {
  const response = await fetchWithRetry(GITHUB_GRAPHQL_API, {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: CONTRIBUTIONS_QUERY,
      variables: {
        username,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(`GitHub GraphQL error: ${json.errors[0].message}`);
  }

  const calendar =
    json?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) {
    throw new Error(`User "${username}" not found or has no contributions data`);
  }

  const days = [];
  for (const week of calendar.weeks) {
    for (const day of week.contributionDays) {
      days.push({
        date: new Date(day.date),
        count: day.contributionCount,
        level: countToLevel(day.contributionCount),
        color: day.color.replace("#", ""),
      });
    }
  }
  return days;
}

/**
 * Map a raw contribution count to a level 0-4 approximation.
 * @param {number} count
 * @returns {number}
 */
function countToLevel(count) {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}

/**
 * Fetch contributions for a specific calendar year using GitHub GraphQL API.
 * Handles the 1-year limit by querying Jan 1 → Dec 31 of that year.
 * @param {string} username
 * @param {string} token
 * @param {number} year
 * @returns {Promise<Array>} sorted array of day objects
 */
async function fetchYearFromGitHub(username, token, year) {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  return fetchGitHubGraphQL(username, token, from, to);
}

/**
 * Fetch last 365 days using GitHub GraphQL API.
 * @param {string} username
 * @param {string} token
 * @returns {Promise<Array>} sorted array of day objects
 */
async function fetchLast365DaysFromGitHub(username, token) {
  const to = new Date();
  const from = new Date(to.getTime() - 364 * 24 * 60 * 60 * 1000);
  from.setHours(0, 0, 0, 0);
  return fetchGitHubGraphQL(username, token, from, to);
}

// ---------- Third-party API fallback ----------

/**
 * Fetch last 365 days from the third-party API.
 * @param {string} username
 * @returns {Promise<Object>} raw API response
 */
async function fetchLast365DaysThirdParty(username) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const previousYear = currentYear - 1;
  const params = new URLSearchParams({ format: "nested" });

  const [currentRes, prevRes] = await Promise.all([
    fetchWithRetry(
      `${THIRD_PARTY_API}/${encodeURIComponent(username)}?${params}&y=${currentYear}`,
    ),
    fetchWithRetry(
      `${THIRD_PARTY_API}/${encodeURIComponent(username)}?${params}&y=${previousYear}`,
    ).catch(() => null),
  ]);

  if (!currentRes.ok) {
    throw new Error(
      `API request failed: ${currentRes.status} ${currentRes.statusText}`,
    );
  }

  const currentData = await currentRes.json();
  const combined = { ...currentData, contributions: {} };

  if (prevRes?.ok) {
    const prevData = await prevRes.json();
    combined.contributions = {
      ...(prevData.contributions || {}),
      ...(currentData.contributions || {}),
    };
  } else {
    combined.contributions = currentData.contributions || {};
  }

  return combined;
}

/**
 * Fetch a specific year from the third-party API.
 * @param {string} username
 * @param {number} year
 * @returns {Promise<Object>} raw API response
 */
async function fetchYearThirdParty(username, year) {
  const params = new URLSearchParams({ format: "nested", y: year.toString() });
  const response = await fetchWithRetry(
    `${THIRD_PARTY_API}/${encodeURIComponent(username)}?${params}`,
  );
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// ---------- Public API ----------

/**
 * Fetch contribution data for a GitHub user.
 * Uses GitHub official GraphQL API when GITHUB_TOKEN is set, otherwise the
 * third-party API.  Returns either a flat day array (GitHub API) or a nested
 * API object (third-party) — callers use parseContributionsData() to normalise.
 *
 * @param {string} username - GitHub username
 * @param {number|string} year - Year or "none" for 365-day rolling window
 * @returns {Promise<Object|Array>} contribution data
 */
export async function fetchContributions(username, year) {
  if (!username) throw new Error("Username is required");

  const token = process.env.GITHUB_TOKEN;
  const use365 = year === "none" || year === null || year === undefined;

  if (!use365 && Number.isNaN(Number.parseInt(year, 10))) {
    throw new Error("Year must be a number or 'none' for 365-day history");
  }

  // GitHub official API path
  if (token) {
    try {
      const days = use365
        ? await fetchLast365DaysFromGitHub(username, token)
        : await fetchYearFromGitHub(username, token, Number.parseInt(year, 10));

      // Assign week numbers and return in the same shape parseContributionsData expects.
      // Wrap in a sentinel so parseContributionsData knows it's pre-parsed.
      return { _githubApiDays: days };
    } catch (err) {
      console.warn(`GitHub API failed, falling back to third-party API: ${err.message}`);
    }
  }

  // Third-party API fallback
  if (use365) {
    return fetchLast365DaysThirdParty(username);
  }
  return fetchYearThirdParty(username, Number.parseInt(year, 10));
}

/**
 * Parse API response into a flat array of day objects.
 * Handles both the GitHub official API response and the third-party API format.
 *
 * @param {Object} apiData - Raw API response
 * @param {boolean} use365Days - Filter to last 365 days (only for third-party path)
 * @returns {Array<{date: Date, count: number, level: number, week: number}>}
 */
export function parseContributionsData(apiData, use365Days = false) {
  // GitHub official API already gives us a flat day array
  if (apiData._githubApiDays) {
    const days = [...apiData._githubApiDays].sort((a, b) => a.date - b.date);
    assignWeekNumbers(days, use365Days, days[0]?.date ?? null);
    return days;
  }

  // Third-party nested format: year → month → day → {date, count, level}
  let days = [];

  if (!apiData.contributions) return days;

  for (const [, months] of Object.entries(apiData.contributions)) {
    if (!months || typeof months !== "object") continue;
    for (const [, monthData] of Object.entries(months)) {
      if (!monthData || typeof monthData !== "object") continue;
      for (const [, day] of Object.entries(monthData)) {
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

  days.sort((a, b) => a.date - b.date);

  let startDate = null;
  if (use365Days) {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const cutoff = new Date(endOfToday.getTime() - 364 * 24 * 60 * 60 * 1000);
    cutoff.setHours(0, 0, 0, 0);
    startDate = cutoff;
    days = days.filter((d) => d.date >= cutoff && d.date <= endOfToday);
  }

  assignWeekNumbers(days, use365Days, startDate);
  return days;
}

/**
 * Assign week numbers to sorted days array in-place.
 * @param {Array} days - sorted ascending
 * @param {boolean} relative - use relative week numbers (365-day mode)
 * @param {Date|null} startDate - reference start date for relative mode
 */
function assignWeekNumbers(days, relative, startDate) {
  for (const day of days) {
    if (relative && startDate) {
      const daysSinceStart = Math.floor(
        (day.date - startDate) / (24 * 60 * 60 * 1000),
      );
      day.week = Math.floor(daysSinceStart / 7);
    } else {
      const startOfYear = new Date(day.date.getFullYear(), 0, 1);
      const daysSinceStartOfYear = Math.floor(
        (day.date - startOfYear) / (24 * 60 * 60 * 1000),
      );
      day.week = Math.floor((daysSinceStartOfYear + startOfYear.getDay()) / 7);
    }
  }
}

/**
 * Hex color for a contribution level (0-4), GitHub default palette.
 * @param {number} level
 * @returns {string} hex without #
 */
function getLevelColor(level) {
  const colors = {
    0: "ebedf0",
    1: "9be9a8",
    2: "40c463",
    3: "30a14e",
    4: "216e39",
  };
  return colors[level] || colors[0];
}

/**
 * Get contribution statistics summary from raw API data.
 * @param {Object} apiData - Raw API response
 * @returns {Object}
 */
export function getContributionStats(apiData) {
  if (apiData._githubApiDays) {
    const total = apiData._githubApiDays.reduce((s, d) => s + d.count, 0);
    return { total, year: new Date().getFullYear(), username: "" };
  }
  const totalObj = apiData.total || {};
  const year = Object.keys(totalObj)[0] || new Date().getFullYear();
  return {
    total: totalObj[year] || 0,
    year: parseInt(year, 10),
    username: "",
  };
}
