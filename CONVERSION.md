# Project Conversion: Extension → API-Based Generator

## What We've Done

Successfully converted the isometric-contributions browser extension into an API-based contribution graph generator.

## Changes Made

### ✅ Completed

1. **Created API Client Module** ([src/api-client.js](src/api-client.js))
   - Fetches contribution data from `https://github-contributions-api.jogruber.de/v4/`
   - Parses nested API response into flat array compatible with rendering code
   - Includes color mapping for contribution levels (0-4)
   - Calculates statistics (total, year, etc.)

2. **Created Test Script** ([test-api-client.js](test-api-client.js))
   - Tests API fetching and data parsing
   - Displays contribution statistics
   - Usage: `npm run test:api -- <username> [year]`

3. **Removed Extension Files**
   - Deleted `src/manifest.json`
   - Deleted extension build scripts (`scripts/build.js`, `scripts/submit.js`, etc.)
   - Deleted `test-extension.js`

4. **Updated package.json**
   - Removed extension-specific dependencies (Parcel, web-ext, chrome-webstore-upload, etc.)
   - Simplified scripts to focus on API functionality
   - Renamed to "isometric-contributions-generator"

## API Client Usage

```javascript
import { fetchContributions, parseContributionsData, getContributionStats } from './src/api-client.js'

// Fetch data for a user
const data = await fetchContributions('username', 2025)

// Get stats
const stats = getContributionStats(data)
console.log(`Total: ${stats.total} contributions in ${stats.year}`)

// Parse into day array
const days = parseContributionsData(data)
// Returns: [{date: Date, count: number, level: number, week: number, color: string}, ...]
```

## Test the API

```bash
# Test with your username and year
npm run test:api -- spectrewolf8 2025

# Or directly
node test-api-client.js spectrewolf8 2025
```

## What's Next

To complete the conversion to an image generator, we need to:

1. **Refactor Rendering Code** 
   - Modify `src/iso.js` to work with API data instead of DOM scraping
   - Remove browser-specific code (Chrome storage, DOM manipulation)
   - Make rendering work with Node.js canvas (node-canvas)

2. **Create Image Export**
   - Add node-canvas for server-side rendering
   - Export canvas to PNG/SVG
   - Create a simple CLI or API server

3. **Build Web Service** (Optional)
   - Express.js server with endpoint: `/api/:username.png`
   - Add caching layer
   - Deploy to Vercel/Netlify/etc.

## Current Project Structure

```
src/
  ├── api-client.js       # ✅ NEW: Fetches GitHub contribution data
  ├── iso.css             # Styles (will need adaptation)
  ├── iso.js              # ⚠️  Needs refactoring (DOM-dependent)
  ├── obelisk.min.js      # ✅ Isometric rendering library (works as-is)
  └── utils.js            # ✅ Pure utility functions (mostly ready)

test-api-client.js        # ✅ NEW: Test script for API
package.json              # ✅ Updated for API project
```

## Dependencies Kept
- `@biomejs/biome` - Linting
- `jsdom` - Testing DOM-dependent code
- `vitest` - Test framework

## Dependencies Removed
- `@parcel/*` - Extension bundling
- `chrome-webstore-upload-cli` - Chrome store submission
- `web-ext-submit` - Firefox store submission  
- `puppeteer` - E2E testing for extension
