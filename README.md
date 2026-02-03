# <img src="media/assets/icon-128.png" alt="logo" width="40" height="40" style="vertical-align: middle;"> Isometric Contributions

Generate beautiful 3D isometric visualizations of GitHub contribution graphs. Available as both a CLI tool and a fast, cached API server.

## Examples

<table>
  <tr>
    <td align="center">
      <img src="media/examples/output-github.png" width="300" alt="GitHub Theme"/><br/>
      <b>GitHub Theme</b>
    </td>
    <td align="center">
      <img src="media/examples/output-light.png" width="300" alt="Light Theme"/><br/>
      <b>Light Theme</b>
    </td>
    <td align="center">
      <img src="media/examples/output-dark.png" width="300" alt="Dark Theme"/><br/>
      <b>Dark Theme</b>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="media/examples/output-neon.png" width="300" alt="Neon Theme"/><br/>
      <b>Neon Theme</b>
    </td>
    <td align="center">
      <img src="media/examples/output-ocean.png" width="300" alt="Ocean Theme"/><br/>
      <b>Ocean Theme</b>
    </td>
    <td align="center">
      <img src="media/examples/output-minimal.png" width="300" alt="Minimal Theme"/><br/>
      <b>Minimal Theme</b>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="media/examples/output-not-stats.png" width="300" alt="Without Stats"/><br/>
      <b>Without Stats</b>
    </td>
    <td align="center">
      <img src="media/examples/output-no-credit.png" width="300" alt="Without Credit"/><br/>
      <b>Without Credit</b>
    </td>
    <td align="center">
      <img src="media/examples/output.png" width="300" alt="Default Theme"/><br/>
      <b>Default</b>
    </td>
  </tr>
</table>

## Features

- ⚡ **Fast API** with intelligent caching and revalidation
- 🎨 **6 Built-in Themes**: GitHub, Dark, Light, Neon, Minimal, Ocean
- 📊 **Statistics Overlay**: Contributions, streaks, averages
- 🖼️ **Customizable**: Dimensions, year selection, credits, themes
- 🚀 **Minimal**: Lightweight with no framework overhead
- 💾 **Smart Caching**: Efficient daily caching with instant updates
- 🎯 **Single Year Focus**: Clean graphs for one year at a time
- 🐳 **Docker Ready**: Easy deployment on Render, Railway, or any platform

## Installation

```bash
npm install
```

## Quick Start

### CLI Usage

Generate an isometric contribution graph:

```bash
npm run generate -- <username> [year] [output] [options]
```

**Examples:**

```bash
# Basic usage
npm run generate -- spectrewolf8

# Specific year with stats
npm run generate -- spectrewolf8 2025 graph.png --stats --credit

# Custom dimensions
npm run generate -- spectrewolf8 2025 graph.png --width 1920 --height 1080
```

**CLI Options:**

- `--stats` - Include statistics overlay
- `--credit` - Show username in bottom right
- `--width <px>` - Canvas width (default: 1000)
- `--height <px>` - Canvas height (default: 600)

### API Server

Start the API server for web integration:

```bash
npm run server
```

Or with auto-reload during development:

```bash
npm run dev
```

Server runs on port 3000 (configurable via `PORT` environment variable).

## API Documentation

### Endpoint

```
GET /api/graph
```

### Query Parameters

| Parameter  | Type    | Required | Default      | Description                                                         |
| ---------- | ------- | -------- | ------------ | ------------------------------------------------------------------- |
| `username` | string  | ✅ Yes   | -            | GitHub username                                                     |
| `year`/`y` | number  | No       | current year | Year to fetch contributions for (supports aliases)                  |
| `theme`    | string  | No       | `github`     | Visual theme: `github`, `dark`, `light`, `neon`, `minimal`, `ocean` |
| `width`    | number  | No       | `1000`       | Image width in pixels                                               |
| `height`   | number  | No       | `600`        | Image height in pixels                                              |
| `stats`    | boolean | No       | `false`      | Include statistics overlay                                          |
| `credit`   | boolean | No       | `false`      | Show username credit                                                |

### API Examples

**Basic Graph:**

```
https://isometric-contributions-spectrewolf8.onrender.com/api/graph?username=spectrewolf8
```

**With Statistics:**

```
https://isometric-contributions-spectrewolf8.onrender.com/api/graph?username=spectrewolf8&stats=true
```

**Specific Year:**

```
https://isometric-contributions-spectrewolf8.onrender.com/api/graph?username=spectrewolf8&year=2025
```

**With Theme:**

```
https://isometric-contributions-spectrewolf8.onrender.com/api/graph?username=spectrewolf8&theme=dark&stats=true
```

**With Credit:**

```
https://isometric-contributions-spectrewolf8.onrender.com/api/graph?username=spectrewolf8&credit=true
```

**Full Customization:**

```
https://isometric-contributions-spectrewolf8.onrender.com/api/graph?username=spectrewolf8&year=2025&width=1200&height=700&stats=true&credit=true&theme=neon
```

> **Note:** Replace `your-app.onrender.com` with your actual deployment URL. Use `http://localhost:3000` for local testing.

### Caching

The API implements intelligent daily caching:

- **Cache Duration**: 1 hour with revalidation (ensures freshness)
- **Cache Strategy**: One generation per username+params per day
- **Cache Headers**: Check `X-Cache` header (`HIT` or `MISS`)
- **Benefits**: Instant responses for repeated requests with fresh updates

**Cache Response Headers:**

```
Content-Type: image/png
Content-Length: <bytes>
Cache-Control: public, max-age=3600, must-revalidate
X-Cache: HIT | MISS
```

### Additional Endpoints

**Documentation:**

```
GET /
GET /docs
```

**Health Check:**

```
GET /health
```

## Programmatic Usage

### Fetch Contributions

```javascript
import {
  fetchContributions,
  parseContributionsData,
} from "./src/api-client.js";

const data = await fetchContributions("username", 2025);
const days = parseContributionsData(data);
```

### Render Image

```javascript
import { renderIsometricChart, exportToPNG, setTheme } from "./src/renderer.js";
import { DARK_THEME } from "./src/theme-config.js";
import { writeFileSync } from "fs";

// Set theme (optional)
setTheme(DARK_THEME);

// Render
const canvas = renderIsometricChart(days, {
  width: 1000,
  height: 600,
  username: "spectrewolf8", // optional credit
});

// Export
const buffer = await exportToPNG(canvas);
writeFileSync("output.png", buffer);
```

### With Statistics

```javascript
import { renderWithStats } from "./src/renderer.js";

const canvas = renderWithStats(days, {
  width: 1000,
  height: 600,
});
```

### Available Themes

```javascript
import {
  GITHUB_THEME,
  DARK_THEME,
  LIGHT_THEME,
  NEON_THEME,
  MINIMAL_THEME,
  OCEAN_THEME,
} from "./src/theme-config.js";
import { setTheme } from "./src/renderer.js";

// Apply theme before rendering
setTheme(NEON_THEME);
```

## Deployment

### Deploy on Render (Recommended)

This project is optimized for Render deployment with Docker support.

**Quick Deploy:**

1. Push to GitHub
2. Create new Web Service on [Render](https://render.com)
3. Connect your repo and select **Docker** environment
4. Add environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_BUCKET_NAME`

5. Deploy!

**Why Docker?**
The `canvas` package requires system libraries (Cairo, Pango) that are automatically installed via the Dockerfile.

### Minimal Deployment (Docker CLI)

```bash
# Build image
docker build -t isometric-contributions .

# Run container with required env vars
docker run -p 3000:3000 \
  -e SUPABASE_URL=your-url \
  -e SUPABASE_ANON_KEY=your-anon-key \
  -e SUPABASE_BUCKET_NAME=isometric-cache \
  isometric-contributions
```

### Other Platforms

The Docker setup works on any platform supporting containers (Railway, Fly.io, Cloud Run, ECS, Azure Container Apps).

## Embedding in README

### Markdown

```markdown
![GitHub Contributions](https://isometric-contributions-spectrewolf8.onrender.com/api/graph?username=spectrewolf8&stats=true)
```

**With theme:**

```markdown
![GitHub Contributions](https://isometric-contributions-spectrewolf8.onrender.com/api/graph?username=spectrewolf8&theme=dark&stats=true)
```

### HTML

```html
<img
  src="https://isometric-contributions-spectrewolf8.onrender.com/api/graph?username=spectrewolf8&theme=neon&stats=true"
  alt="GitHub Contributions"
/>
```

## Scripts

| Command                     | Description                       |
| --------------------------- | --------------------------------- |
| `npm run generate`          | Generate graph via CLI            |
| `npm run server`            | Start API server                  |
| `npm run dev`               | Start server with auto-reload     |
| `npm run test:api`          | Test API endpoints                |
| `npm run cleanup`           | Manually run cache cleanup        |
| `npm run cleanup:scheduler` | Start automatic cleanup scheduler |

## Output

Generates PNG images with:

- **Resolution**: Customizable (default 1000x600)
- **Format**: PNG with transparency
- **Size**: ~20-30 KB (varies with dimensions)

### Statistics Displayed

- Total contributions
- Best day (max contributions)
- Average per day
- Longest streak
- Current streak

## Cache Management

The project includes automatic cache cleanup to remove old files from Supabase Storage.

### Setup

1. **Add environment variables to `.env`:**

   ```env
   SUPABASE_ANON_KEY=your-anon-key
   CACHE_RETENTION_DAYS=1
   CLEANUP_SCHEDULE=0 3 * * *  # Daily at 3 AM
   RUN_ON_STARTUP=true
   TZ=UTC
   ```

2. **Add DELETE policy to Supabase (one-time setup):**

   Run this in your Supabase SQL Editor:

   ```sql
   CREATE POLICY "Anon delete access"
     ON storage.objects
     FOR DELETE
     TO anon
     USING (bucket_id = 'isometric-cache');

   GRANT DELETE ON storage.objects TO anon;
   ```

3. **Start the scheduler:**
   ```bash
   npm run cleanup:scheduler
   ```

The scheduler runs automatically in Docker/production (see [Dockerfile](Dockerfile)).

### Manual Cleanup

Run cleanup on-demand:

```bash
npm run cleanup
```

### Cron Schedule Examples

- `0 3 * * *` - Daily at 3 AM
- `0 */6 * * *` - Every 6 hours
- `0 */12 * * *` - Every 12 hours
- `*/30 * * * *` - Every 30 minutes
- `0 0 * * 0` - Weekly on Sunday at midnight

### How It Works

The cleanup script:

1. Lists all files in the Supabase Storage bucket
2. Checks each file against retention criteria:
   - Files with `created_at` older than retention period
   - Files in date folders (e.g., `username/2026-02-01/`) older than retention
   - `.emptyFolderPlaceholder` files
3. Deletes matching files using Supabase Storage API
4. Logs results with counts and examples

### Production Deployment

**Docker/Render/Railway:**

The Dockerfile automatically starts both processes:

```dockerfile
CMD ["sh", "-c", "node server.js & node cleanup-scheduler.js & wait"]
```

Just add the environment variables to your hosting platform.

## Troubleshooting

### Cache Cleanup Issues

**No files deleted:**

- Check `CACHE_RETENTION_DAYS` - files must be older than this
- Verify DELETE policy is set up in Supabase (see setup step 2)
- Check file dates in Supabase dashboard

**Permission errors:**

- Ensure DELETE policy exists for anon role on storage.objects
- Run the setup SQL in Supabase SQL Editor (see Cache Management section)
- Verify bucket name matches `SUPABASE_BUCKET_NAME`

**Scheduler not running:**

- Verify cron expression is valid
- Check timezone setting (`TZ` environment variable)
- Ensure process stays running (use PM2 or Docker)
- Check logs: `pm2 logs cache-cleanup` (if using PM2)

**Manual testing:**

```bash
# Test cleanup manually
npm run cleanup

# With different retention
CACHE_RETENTION_DAYS=7 npm run cleanup
```

**Check cleanup logs:**

The cleanup script outputs detailed logs:

```
🧹 Starting cache cleanup...
📅 Retention: 1 day(s)
📦 Bucket: isometric-cache
🔪 Cutoff date: 2026-02-01
📊 Total files: 27
🎯 Files to delete: 5
✅ Successfully deleted 5 file(s)
   🗑️  spectrewolf8/2026-02-01/abc123.png
   ...
```

## Acknowledgements

This project builds upon the excellent work of:

- **Core Renderer**: Based on [isometric-contributions](https://github.com/jasonlong/isometric-contributions) by Jason Long - the foundational isometric rendering logic was taken and modified for this implementation
- **Contributions API**: Uses the [GitHub Contributions API](https://github.com/grubersjoe/github-contributions-api) by Joe Gruber - an unofficial but reliable API for fetching GitHub contribution data

## Contributing

Feel free to open issues or submit PRs for improvements!

## License

This project is licensed under the [MIT License](http://opensource.org/licenses/MIT).
