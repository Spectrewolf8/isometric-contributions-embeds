#!/usr/bin/env node

/**
 * Test script to fetch and display contribution data
 * Usage: node test-api-client.js <username> [year]
 */

import { fetchContributions, parseContributionsData, getContributionStats } from './src/api-client.js'

const username = process.argv[2]
const year = process.argv[3] ? parseInt(process.argv[3], 10) : null

if (!username) {
  console.error('Usage: node test-api-client.js <username> [year]')
  console.error('Example: node test-api-client.js spectrewolf8 2026')
  process.exit(1)
}

async function main() {
  try {
    console.log(`Fetching contribution data for ${username}...`)
    if (year) {
      console.log(`Year: ${year}`)
    }

    const data = await fetchContributions(username, year)

    console.log('\n=== API Response Stats ===')
    const stats = getContributionStats(data)
    console.log(`Username: ${stats.username}`)
    console.log(`Year: ${stats.year}`)
    console.log(`Total Contributions: ${stats.total}`)

    console.log('\n=== Parsing Data ===')
    const days = parseContributionsData(data)
    console.log(`Total days: ${days.length}`)
    console.log(`Total weeks: ${days.length > 0 ? Math.max(...days.map((d) => d.week)) + 1 : 0}`)

    if (days.length > 0) {
      console.log('\n=== Sample Data (first 7 days) ===')
      for (let i = 0; i < Math.min(7, days.length); i++) {
        const day = days[i]
        console.log(`${day.date.toISOString().split('T')[0]} - ${day.count} contributions (level ${day.level})`)
      }

      const maxDay = days.reduce((max, day) => (day.count > max.count ? day : max), days[0])
      console.log('\n=== Best Day ===')
      console.log(`${maxDay.date.toISOString().split('T')[0]} - ${maxDay.count} contributions`)
    }

    console.log('\n✓ API test successful!')
  } catch (error) {
    console.error('\n✗ Error:', error.message)
    process.exit(1)
  }
}

main()
