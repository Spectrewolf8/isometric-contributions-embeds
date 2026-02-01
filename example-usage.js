#!/usr/bin/env node

/**
 * Example: Programmatic Usage
 * Shows how to use the API and renderer programmatically
 */

import { writeFileSync } from 'node:fs'
import { fetchContributions, parseContributionsData, getContributionStats } from './src/api-client.js'
import { renderIsometricChart, calculateStats, exportToPNG } from './src/renderer.js'

async function generateMultipleGraphs() {
  const users = ['octocat', 'torvalds', 'gaearon']
  const year = 2024

  for (const username of users) {
    try {
      console.log(`\nProcessing ${username}...`)

      // 1. Fetch data
      const apiData = await fetchContributions(username, year)
      const apiStats = getContributionStats(apiData)
      console.log(`  Total contributions: ${apiStats.total}`)

      // 2. Parse into renderable format
      const days = parseContributionsData(apiData)

      // 3. Calculate detailed statistics
      const stats = calculateStats(days)
      console.log(`  Longest streak: ${stats.streakLongest} days`)
      console.log(`  Best day: ${stats.dateBest} (${stats.maxCount} contributions)`)

      // 4. Render with custom options
      const canvas = renderIsometricChart(days, {
        width: 1200, // Wider canvas
        height: 700, // Taller canvas
        cubeSize: 18, // Larger cubes
        maxHeight: 120 // Taller max height
      })

      // 5. Export to file
      const filename = `examples/${username}-${year}.png`
      const buffer = exportToPNG(canvas)
      writeFileSync(filename, buffer)
      console.log(`  ✓ Generated ${filename}`)
    } catch (error) {
      console.error(`  ✗ Error for ${username}:`, error.message)
    }
  }
}

// Create examples directory first
import { mkdirSync } from 'node:fs'
try {
  mkdirSync('examples', { recursive: true })
} catch (error) {
  // Directory might already exist
}

// Run the example
generateMultipleGraphs()
  .then(() => {
    console.log('\n✓ All graphs generated!')
  })
  .catch(console.error)
