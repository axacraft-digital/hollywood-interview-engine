/**
 * scoring.js
 *
 * Pure scoring functions over the instrument JSON. No React, no DOM —
 * easy to unit-test and to reuse server-side.
 */

const BORDERLINE_THRESHOLD = 0.1;

/**
 * Compute normalized axis scores for a candidate.
 *
 * @param {object} instrument - parsed instrument JSON.
 * @param {Record<string, number>} responses - map of questionId -> selected option index.
 * @returns {Record<string, number>} map of axisId -> normalized score in [-1, 1].
 */
export function computeAxisScores(instrument, responses) {
  const axisRaw = {};
  const axisMax = {};

  for (const axis of instrument.axes) {
    axisRaw[axis.id] = 0;
    axisMax[axis.id] = 0;
  }

  for (const group of instrument.groups) {
    for (const q of group.questions) {
      const weight = q.weight ?? 1;
      // For max-possible contribution, take the option with the largest |score|.
      const optMax = Math.max(...q.options.map((o) => Math.abs(o.score)));
      const axisForQ = q.options[0]?.axis;
      if (axisForQ && axisMax[axisForQ] !== undefined) {
        axisMax[axisForQ] += optMax * weight;
      }
      const choiceIdx = responses[q.id];
      if (choiceIdx == null) continue;
      const opt = q.options[choiceIdx];
      if (!opt) continue;
      if (axisRaw[opt.axis] === undefined) continue;
      axisRaw[opt.axis] += opt.score * weight;
    }
  }

  const normalized = {};
  for (const axis of instrument.axes) {
    const max = axisMax[axis.id] || 1;
    normalized[axis.id] = axisRaw[axis.id] / max;
  }
  return normalized;
}

/**
 * Pick the matching quadrant based on signs of normalized axis scores.
 * Returns the quadrant object plus a `borderline` flag if either axis is near zero.
 */
export function resolveQuadrant(instrument, axisScores) {
  const [axisX, axisY] = instrument.axes;
  const xScore = axisScores[axisX.id];
  const yScore = axisScores[axisY.id];
  const xDir = xScore >= 0 ? 'high' : 'low';
  const yDir = yScore >= 0 ? 'high' : 'low';

  const quadrant = instrument.quadrants.find(
    (q) => q.x === xDir && q.y === yDir
  );

  const borderline =
    Math.abs(xScore) < BORDERLINE_THRESHOLD ||
    Math.abs(yScore) < BORDERLINE_THRESHOLD;

  return { quadrant, borderline, xScore, yScore };
}

/**
 * Count total questions in the instrument.
 */
export function totalQuestions(instrument) {
  return instrument.groups.reduce((acc, g) => acc + g.questions.length, 0);
}

/**
 * Flatten ordered list of {groupIdx, question}.
 */
export function flattenQuestions(instrument) {
  const out = [];
  instrument.groups.forEach((g, groupIdx) => {
    g.questions.forEach((q) => {
      out.push({ groupIdx, group: g, question: q });
    });
  });
  return out;
}
