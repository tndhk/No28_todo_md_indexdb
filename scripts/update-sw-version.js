#!/usr/bin/env node

/**
 * Update Service Worker cache version with build timestamp
 * This script runs during build to ensure each deployment gets a unique cache version
 */

const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '../public/sw.js');
const CACHE_VERSION = `v${Date.now()}`;

console.log(`[Build] Updating Service Worker cache version to: ${CACHE_VERSION}`);

try {
  let swContent = fs.readFileSync(SW_PATH, 'utf8');

  // Replace the placeholder with actual version
  swContent = swContent.replace(/__CACHE_VERSION__/g, CACHE_VERSION);

  fs.writeFileSync(SW_PATH, swContent, 'utf8');
  console.log(`[Build] ✓ Service Worker updated successfully`);
} catch (error) {
  console.error('[Build] ✗ Failed to update Service Worker:', error);
  process.exit(1);
}
