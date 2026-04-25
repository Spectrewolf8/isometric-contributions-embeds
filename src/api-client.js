/**
 * GitHub Contributions API Client
 * Uses GitHub's official GraphQL API (requires GITHUB_TOKEN env var)
 */

const GITHUB_GRAPHQL_API = "https://api.github.com/graphql";

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
 * Fetch with retry and exponential backoff.
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

/**
 * Execute a GitHub GraphQL query.
 * @param {string} token
 * @param {string} username
 * @param {Date} from
 * @param {Date} to
 * @returns {Promise<Array>} flat array of day objects
 */
async function fetchGitHubGraphQL(token, username, from, to) {
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  console.log(`[GH]    ${username} — fetching ${fromStr} to ${toStr}`);

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
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`,
    );
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(`GitHub GraphQL error: ${json.errors[0].message}`);
  }

  const calendar =
    json?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) {
    throw new Error(
      `User "${username}" not found or contributions data unavailable`,
    );
  }

  const days = [];
  for (const week of calendar.weeks) {
    for (const day of week.contributionDays) {
      days.push({
        date: new Date(day.date),
        count: day.contributionCount,
        level: countToLevel(day.contributionCount),
        color: (day.color || "#ebedf0").replace("#", ""),
      });
    }
  }

  const total = calendar.totalContributions;
  console.log(`[GH]    ${username} — ${days.length} days, ${total} total contributions`);
  return days;
}

/**
 * Map a contribution count to a level 0–4.
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
 * Fetch contribution data for a GitHub user.
 *
 * @param {string} username - GitHub username
 * @param {number|string} year - Specific year, or "none" / null for 365-day rolling window
 * @returns {Promise<Object>} Wrapped day array: { _githubApiDays: Array }
 */
export async function fetchContributions(username, year) {
  if (!username) throw new Error("Username is required");

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN environment variable is required. " +
        "Create a GitHub personal access token (no scopes needed for public data) " +
        "and set it as GITHUB_TOKEN in your .env file.",
    );
  }

  const use365 = year === "none" || year === null || year === undefined;

  if (!use365 && Number.isNaN(Number.parseInt(year, 10))) {
    throw new Error("Year must be a number or 'none' for 365-day history");
  }

  let days;
  if (use365) {
    const to = new Date();
    const from = new Date(to.getTime() - 364 * 24 * 60 * 60 * 1000);
    from.setHours(0, 0, 0, 0);
    days = await fetchGitHubGraphQL(token, username, from, to);
  } else {
    const y = Number.parseInt(year, 10);
    const from = new Date(Date.UTC(y, 0, 1));
    const to = new Date(Date.UTC(y, 11, 31, 23, 59, 59));
    days = await fetchGitHubGraphQL(token, username, from, to);
  }

  return { _githubApiDays: days };
}

/**
 * Parse API response into a flat array of day objects with week numbers assigned.
 *
 * @param {Object} apiData - Value returned by fetchContributions()
 * @param {boolean} use365Days - Use relative week numbers (365-day mode)
 * @returns {Array<{date: Date, count: number, level: number, color: string, week: number}>}
 */
export function parseContributionsData(apiData, use365Days = false) {
  if (!apiData._githubApiDays) {
    throw new Error(
      "Unexpected API data format. Expected _githubApiDays from fetchContributions().",
    );
  }

  const days = [...apiData._githubApiDays].sort((a, b) => a.date - b.date);
  const startDate = use365Days ? (days[0]?.date ?? null) : null;

  for (const day of days) {
    if (use365Days && startDate) {
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

  return days;
}

/**
 * Get contribution statistics summary.
 * @param {Object} apiData - Value returned by fetchContributions()
 * @returns {{ total: number, year: number, username: string }}
 */
export function getContributionStats(apiData) {
  const days = apiData._githubApiDays ?? [];
  return {
    total: days.reduce((s, d) => s + d.count, 0),
    year: new Date().getFullYear(),
    username: "",
  };
}
