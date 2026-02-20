/**
 * Daily Puzzle Rotation Script
 *
 * Reads daily/pool.json (all daily puzzles) and generates sets/daily.rqs
 * (MessagePack) with a rolling 7-day window.
 *
 * Run: node scripts/rotate-daily-puzzles.js
 */

const fs = require('fs');
const path = require('path');
const { encode } = require('@msgpack/msgpack');

const DEFAULT_EPOCH = '2026-02-18';
const MAX_WINDOW = 7;

// Resolve paths relative to repo root
const repoRoot = path.resolve(__dirname, '..');
const poolPath = path.join(repoRoot, 'daily', 'pool.json');
const outputPath = path.join(repoRoot, 'sets', 'daily.rqs');

// Read pool
if (!fs.existsSync(poolPath)) {
  console.error('Error: daily/pool.json not found');
  process.exit(1);
}

const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
const { puzzles } = pool;
const epoch = pool.epoch || DEFAULT_EPOCH;

if (!puzzles || puzzles.length === 0) {
  console.log('No puzzles in pool');
  process.exit(0);
}

// Calculate days since epoch
const today = new Date().toISOString().split('T')[0];
const epochDate = new Date(epoch + 'T00:00:00Z');
const currentDate = new Date(today + 'T00:00:00Z');
const daysSinceEpoch = Math.floor((currentDate - epochDate) / (1000 * 60 * 60 * 24));

if (daysSinceEpoch < 0) {
  console.log(`Before epoch (${epoch}) - not yet started`);
  process.exit(0);
}

// Calculate window: grows from 1 to MAX_WINDOW, then rolls
const currentDayIndex = Math.min(daysSinceEpoch, puzzles.length - 1);
const windowSize = Math.min(currentDayIndex + 1, MAX_WINDOW);
const startIndex = Math.max(0, currentDayIndex - windowSize + 1);

// Build daily pack with puzzles in the window
const dailyPuzzles = [];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
for (let i = startIndex; i <= currentDayIndex; i++) {
  const puzzle = puzzles[i];
  const puzzleDate = new Date(epochDate);
  puzzleDate.setUTCDate(puzzleDate.getUTCDate() + i);
  const dateStr = puzzleDate.toISOString().split('T')[0];
  const title = `${months[puzzleDate.getUTCMonth()]} ${puzzleDate.getUTCDate()}, ${puzzleDate.getUTCFullYear()}`;

  dailyPuzzles.push({
    ...puzzle,
    t: title,
    date: dateStr
  });
}

// Build pack structure (same as any other .rqs)
const dailyPack = {
  id: 'daily',
  title: 'Daily Puzzles',
  level: 'progressive',
  puzzles: dailyPuzzles
};

// Ensure sets directory exists
const setsDir = path.dirname(outputPath);
if (!fs.existsSync(setsDir)) {
  fs.mkdirSync(setsDir, { recursive: true });
}

// Write as .rqs (MessagePack)
fs.writeFileSync(outputPath, Buffer.from(encode(dailyPack)));

console.log(`Generated daily.rqs for ${today} (Day ${daysSinceEpoch + 1})`);
console.log(`  Epoch: ${epoch}`);
console.log(`  Window: Day ${startIndex + 1} - Day ${currentDayIndex + 1} (${dailyPuzzles.length} puzzles)`);
console.log(`  Total in pool: ${puzzles.length} puzzles`);
