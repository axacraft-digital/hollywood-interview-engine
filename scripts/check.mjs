/**
 * Sanity check — verifies the instrument JSON is well-formed and that the
 * scoring engine returns expected results for canonical response sets.
 *
 * Run: npm run check
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  computeAxisScores,
  resolveQuadrant,
  flattenQuestions,
  totalQuestions,
} from '../src/scoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const instrumentPath = path.join(
  __dirname,
  '..',
  'instruments',
  'vintage-mechanic-v1.json'
);

const instrument = JSON.parse(fs.readFileSync(instrumentPath, 'utf8'));

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log('  ✓', msg);
  } else {
    console.log('  ✗', msg);
    failures++;
  }
}

console.log('Instrument structure:');
assert(instrument.id === 'vintage-mechanic-v1', 'id is vintage-mechanic-v1');
assert(instrument.axes.length === 2, 'exactly 2 axes');
assert(instrument.quadrants.length === 4, 'exactly 4 quadrants');
assert(totalQuestions(instrument) === 24, '24 total questions');
assert(!!instrument.brochure?.hero, 'brochure.hero is set');
assert(
  instrument.quadrants.every((q) => !!q.postResultMessage),
  'every quadrant has a postResultMessage'
);
assert(
  instrument.leadCapture?.mode === 'pre-test',
  'leadCapture.mode is pre-test'
);

// Every quadrant pair (high/low x high/low) is covered exactly once
const pairs = new Set(instrument.quadrants.map((q) => `${q.x}|${q.y}`));
assert(pairs.size === 4, 'each quadrant position is unique');

// Each option's axis must exist
const axisIds = new Set(instrument.axes.map((a) => a.id));
const flat = flattenQuestions(instrument);
let badAxis = 0;
flat.forEach(({ question }) => {
  question.options.forEach((o) => {
    if (!axisIds.has(o.axis)) badAxis++;
  });
});
assert(badAxis === 0, 'every option references a valid axis');

console.log('\nScoring — all "low" answers (option index 0):');
const allLow = {};
flat.forEach(({ question }) => (allLow[question.id] = 0));
const lowScores = computeAxisScores(instrument, allLow);
console.log('  axisScores:', lowScores);
const lowRes = resolveQuadrant(instrument, lowScores);
console.log('  quadrant:', lowRes.quadrant?.id);
assert(lowRes.quadrant?.id === 'service-mechanic', 'all-low maps to service-mechanic');
assert(lowScores.curiosity === -1 && lowScores.mastery === -1, 'all-low normalized to -1, -1');

console.log('\nScoring — all "high" answers (option index 1):');
const allHigh = {};
flat.forEach(({ question }) => (allHigh[question.id] = 1));
const highScores = computeAxisScores(instrument, allHigh);
console.log('  axisScores:', highScores);
const highRes = resolveQuadrant(instrument, highScores);
console.log('  quadrant:', highRes.quadrant?.id);
assert(highRes.quadrant?.id === 'vintage-specialist', 'all-high maps to vintage-specialist');
assert(highScores.curiosity === 1 && highScores.mastery === 1, 'all-high normalized to +1, +1');

console.log('\nScoring — high curiosity, low mastery:');
const mixedTinkerer = {};
flat.forEach(({ question }) => {
  // index 1 (high) for curiosity items, index 0 (low) for mastery items
  const axis = question.options[1].axis;
  mixedTinkerer[question.id] = axis === 'curiosity' ? 1 : 0;
});
const tinkererScores = computeAxisScores(instrument, mixedTinkerer);
const tinkererRes = resolveQuadrant(instrument, tinkererScores);
console.log('  axisScores:', tinkererScores, '-> quadrant:', tinkererRes.quadrant?.id);
assert(tinkererRes.quadrant?.id === 'tinkerer', 'mixed maps to tinkerer');

console.log('\nScoring — low curiosity, high mastery:');
const mixedMaster = {};
flat.forEach(({ question }) => {
  const axis = question.options[1].axis;
  mixedMaster[question.id] = axis === 'mastery' ? 1 : 0;
});
const masterScores = computeAxisScores(instrument, mixedMaster);
const masterRes = resolveQuadrant(instrument, masterScores);
console.log('  axisScores:', masterScores, '-> quadrant:', masterRes.quadrant?.id);
assert(masterRes.quadrant?.id === 'master-technician', 'mixed maps to master-technician');

console.log('');
if (failures === 0) {
  console.log('✓ All checks passed.');
  process.exit(0);
} else {
  console.log(`✗ ${failures} check(s) failed.`);
  process.exit(1);
}
