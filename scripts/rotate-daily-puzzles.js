/**
 * Daily Puzzle Rotation Script
 *
 * Reads daily/manifest.json and individual .rq puzzle files (MessagePack),
 * generates sets/daily.rqs (MessagePack) with a rolling 7-day window.
 *
 * Run: node scripts/rotate-daily-puzzles.js
 */

const fs = require('fs');
const path = require('path');
const { decode, encode } = require('@msgpack/msgpack');

const DEFAULT_EPOCH = '2026-02-18';
const MAX_WINDOW = 7;

// Resolve paths relative to repo root
const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'daily', 'manifest.json');
const puzzlesDir = path.join(repoRoot, 'daily', 'puzzles');
const outputPath = path.join(repoRoot, 'sets', 'daily.rqs');

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
  console.log(`Before epoch (${epoch}) - generating empty daily pack`);
  const dailyPack = {
    id: 'daily',
    title: 'Daily Puzzles',
    level: 'progressive',
    puzzles: []
  };
  const setsDir = path.dirname(outputPath);
  if (!fs.existsSync(setsDir)) {
    fs.mkdirSync(setsDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, Buffer.from(encode(dailyPack)));
  process.exit(0);
}

// Calculate window: grows from 1 to MAX_WINDOW, then rolls
const currentDayIndex = Math.min(daysSinceEpoch, puzzles.length - 1);
const windowSize = Math.min(currentDayIndex + 1, MAX_WINDOW);
const startIndex = Math.max(0, currentDayIndex - windowSize + 1);

// Build daily pack with puzzles in the window (read full data from .rq files)
const dailyPuzzles = [];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
for (let i = startIndex; i <= currentDayIndex; i++) {
  const puzzleMeta = puzzles[i];
  const puzzleData = readPuzzle(puzzleMeta.id);

  if (puzzleData) {
    const puzzleDate = new Date(epochDate);
    puzzleDate.setUTCDate(puzzleDate.getUTCDate() + i);
    const dateStr = puzzleDate.toISOString().split('T')[0];
    const title = `${months[puzzleDate.getUTCMonth()]} ${puzzleDate.getUTCDate()}, ${puzzleDate.getUTCFullYear()}`;

    dailyPuzzles.push({
      ...puzzleData,
      t: title,
      date: dateStr,
      // The day number players see ("REquate #47"). Positional: only the
      // rotation knows a puzzle's place in the queue, so clients should not
      // have to re-derive it from the epoch.
      day: i + 1
    });
  }
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
console.log(`  Total in manifest: ${puzzles.length} puzzles`);
