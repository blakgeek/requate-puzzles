/**
 * Daily Puzzle Rotation Script
 *
 * Reads daily/manifest.json and individual .rq puzzle files (MessagePack),
 * generates daily/pool.json with a rolling 7-day window.
 *
 * Run: node scripts/rotate-daily-puzzles.js
 */

const fs = require('fs');
const path = require('path');
const { decode } = require('@msgpack/msgpack');

const DEFAULT_EPOCH = '2026-02-18';
const MAX_WINDOW = 7;

// Resolve paths relative to repo root
const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'daily', 'manifest.json');
const puzzlesDir = path.join(repoRoot, 'daily', 'puzzles');
const poolPath = path.join(repoRoot, 'daily', 'pool.json');

// Read manifest
if (!fs.existsSync(manifestPath)) {
  console.error('Error: daily/manifest.json not found');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const { puzzles } = manifest;
const epoch = manifest.epoch || DEFAULT_EPOCH;

if (!puzzles || puzzles.length === 0) {
  console.log('No puzzles in manifest');
  process.exit(0);
}

// Helper to read .rq puzzle file (MessagePack)
function readPuzzle(id) {
  const puzzlePath = path.join(puzzlesDir, id + '.rq');
  if (!fs.existsSync(puzzlePath)) {
    console.error('Puzzle file not found: ' + puzzlePath);
    return null;
  }
  const buffer = fs.readFileSync(puzzlePath);
  return decode(buffer);
}

// Calculate days since epoch
const today = new Date().toISOString().split('T')[0];
const epochDate = new Date(epoch + 'T00:00:00Z');
const currentDate = new Date(today + 'T00:00:00Z');
const daysSinceEpoch = Math.floor((currentDate - epochDate) / (1000 * 60 * 60 * 24));

if (daysSinceEpoch < 0) {
  console.log(`Before epoch (${epoch}) - generating empty pool`);
  const pool = {
    generatedAt: new Date().toISOString(),
    epoch,
    puzzles: []
  };
  fs.writeFileSync(poolPath, JSON.stringify(pool, null, 2));
  process.exit(0);
}

// Calculate window: grows from 1 to MAX_WINDOW, then rolls
const currentDayIndex = Math.min(daysSinceEpoch, puzzles.length - 1);
const windowSize = Math.min(currentDayIndex + 1, MAX_WINDOW);
const startIndex = Math.max(0, currentDayIndex - windowSize + 1);

// Build pool with dated puzzles (read full data from .rq files)
const poolPuzzles = [];
for (let i = startIndex; i <= currentDayIndex; i++) {
  const puzzleMeta = puzzles[i];
  const puzzleData = readPuzzle(puzzleMeta.id);

  if (puzzleData) {
    const puzzleDate = new Date(epochDate);
    puzzleDate.setUTCDate(puzzleDate.getUTCDate() + i);

    poolPuzzles.push({
      ...puzzleData,
      date: puzzleDate.toISOString().split('T')[0]
    });
  }
}

const pool = {
  generatedAt: new Date().toISOString(),
  epoch,
  currentDate: today,
  dayNumber: daysSinceEpoch + 1,
  puzzles: poolPuzzles
};

fs.writeFileSync(poolPath, JSON.stringify(pool, null, 2));

console.log(`Generated pool for ${today} (Day ${daysSinceEpoch + 1})`);
console.log(`  Epoch: ${epoch}`);
console.log(`  Window: indices ${startIndex}-${currentDayIndex} (${poolPuzzles.length} puzzles)`);
console.log(`  Total in manifest: ${puzzles.length} puzzles`);
