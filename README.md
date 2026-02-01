# Isometric Contributions Generator

Generate beautiful 3D isometric visualizations of GitHub contribution graphs.

## Installation

```bash
npm install
```

## Usage

Generate an isometric contribution graph for any GitHub user:

```bash
npm run generate -- <username> [year] [output] [--stats]
```

### Examples

```bash
# Generate current year
npm run generate -- octocat

# Generate for specific year
npm run generate -- octocat 2025

# Specify output filename
npm run generate -- octocat 2025 my-graph.png

# Include statistics overlay
npm run generate -- octocat 2025 graph-with-stats.png --stats
```

Or use directly:

```bash
node generate.js username 2025 output.png --stats
```

### Options

- `--stats` - Include statistics overlay on the image (contributions, streaks, best day, etc.)

## Output

Generates PNG images with:

- **Resolution**: 1000x600 pixels
- **Format**: PNG with transparency
- **Size**: ~20-30 KB

### Statistics Displayed

- Total contributions
- Best day (max contributions)
- Average per day
- Longest streak
- Current streak

## API Usage

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
import { renderIsometricChart, exportToPNG } from "./src/renderer.js";
import { writeFileSync } from "fs";

const canvas = renderIsometricChart(days, {
  width: 1000,
  height: 600,
});

const buffer = exportToPNG(canvas);
writeFileSync("output.png", buffer);
```

## Data Source

Uses the [GitHub Contributions API](https://github-contributions-api.jogruber.de/)

## License

This project is licensed under the [MIT License](http://opensource.org/licenses/MIT).
