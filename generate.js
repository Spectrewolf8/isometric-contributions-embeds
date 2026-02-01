#!/usr/bin/env node

/**
 * CLI tool to generate isometric contribution graphs
 * Usage: node generate.js <username> [year] [output]
 */

import { writeFileSync } from 'node:fs'
import { fetchContributions, parseContributionsData } from './src/api-client.js'
import { renderIsometricChart, calculateStats, exportToPNG } from './src/renderer.js'

const username = process.argv[2]
const year = process.argv[3] ? Number.parseInt(process.argv[3], 10) : null
const output = process.argv[4] || `${username}-contributions.png`

if (!username) {
  console.error('Usage: node generate.js <username> [year] [output]')
  console.error('Example: node generate.js spectrewolf8 2025 graph.png')
  process.exit(1)
}

async function main() {
  try {
    console.log(`Fetching contribution data for ${username}...`)

    // Fetch data from API
    const data = await fetchContributions(username, year)
    const days = parseContributionsData(data)

    if (days.length === 0) {
      console.error('No contribution data found')
      process.exit(1)
    }

    console.log(`Parsed ${days.length} days of contribution data`)

    // Calculate statistics
    const stats = calculateStats(days)
    console.log('\n=== Statistics ===')
    console.log(`Total: ${stats.countTotal} contributions`)
    console.log(`Best day: ${stats.dateBest} (${stats.maxCount} contributions)`)
    console.log(`Average: ${stats.averageCount} per day`)
    console.log(`Longest streak: ${stats.streakLongest} days`)
    console.log(`Current streak: ${stats.streakCurrent} days`)

    // Render isometric chart
    console.log('\nRendering isometric chart...')
    const canvas = renderIsometricChart(days, {
      width: 1000,
      height: 600
    })

    // Export to PNG
    console.log(`Exporting to ${output}...`)
    const buffer = exportToPNG(canvas)
    writeFileSync(output, buffer)

    console.log(`\n✓ Successfully generated ${output}`)
    console.log(`  Size: ${(buffer.length / 1024).toFixed(1)} KB`)
    console.log(`  Dimensions: ${canvas.width}x${canvas.height}`)
  } catch (error) {
    console.error('\n✗ Error:', error.message)
    process.exit(1)
  }
}

main()
