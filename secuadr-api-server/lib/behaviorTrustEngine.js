/**
 * Behavioral Trust Engine
 * INPUT -> FEATURE EXTRACTION -> SFAM -> IDENTITY VECTOR -> BASELINE MODEL -> RLFS -> S-ADR -> TRUST SCORE
 */

const FEATURE_NAMES = [
  "normalized_time",
  "avg_speed",
  "speed_variance",
  "tortuosity",
  "curvature",
  "shape_signature",
  "rhythm_consistency",
];

const EPSILON = 1e-6;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function mean(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function variance(values, avg) {
  if (!values || values.length === 0) return 0;
  return mean(values.map((v) => (v - avg) ** 2));
}

function stdDev(values, avg = mean(values)) {
  return Math.sqrt(variance(values, avg));
}

function quantizeBinary(vector, threshold = 0.5) {
  return vector.map((v) => (v >= threshold ? 1 : 0));
}

function normalizePoints(points) {
  if (!points || points.length === 0) return [];
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = Math.max(maxX - minX, maxY - minY, 1);

  return points.map((p) => ({
    x: (p.x - cx) / scale,
    y: (p.y - cy) / scale,
    t: p.t,
  }));
}

function cosineSimilarity(a = [], b = []) {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (!normA || !normB) return 0;
  return dot / (normA * normB);
}

function euclideanDistance(a = [], b = []) {
  if (!a.length || !b.length || a.length !== b.length) return 1;
  return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
}

function hammingDistance(aBits = [], bBits = []) {
  if (!aBits.length || !bBits.length || aBits.length !== bBits.length) return 1;
  const diff = aBits.reduce(
    (sum, bit, i) => sum + (bit === bBits[i] ? 0 : 1),
    0,
  );
  return diff / aBits.length;
}

function dtwDistance(seriesA = [], seriesB = []) {
  if (!seriesA.length || !seriesB.length) return 1;
  const n = seriesA.length;
  const m = seriesB.length;
  const dtw = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
  dtw[0][0] = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(seriesA[i - 1] - seriesB[j - 1]);
      dtw[i][j] =
        cost + Math.min(dtw[i - 1][j], dtw[i][j - 1], dtw[i - 1][j - 1]);
    }
  }

  const raw = dtw[n][m] / (n + m);
  return clamp01(raw);
}

function aggregateShapeSignature(angles = [], directions = []) {
  if (!angles.length) return 0;
  const angleMean = mean(angles.map((a) => Math.abs(a) / Math.PI));
  const directionEnergy = mean(directions.map((d) => Math.abs(d) / Math.PI));
  return clamp01(angleMean * 0.6 + directionEnergy * 0.4);
}

function smoothPoints(points) {
  if (!Array.isArray(points) || points.length < 3) return points || [];

  const result = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];

    result.push({
      x: (prev.x + cur.x + next.x) / 3,
      y: (prev.y + cur.y + next.y) / 3,
      t: cur.t,
    });
  }
  result.push(points[points.length - 1]);
  return result;
}

function sanitizePoints(rawPoints = []) {
  return (rawPoints || [])
    .map((p, idx) => ({
      x: Number(p.x),
      y: Number(p.y),
      t: Number(p.t ?? p.timestamp ?? idx),
    }))
    .filter(
      (p) =>
        Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.t),
    )
    .sort((a, b) => a.t - b.t);
}

function extractBehaviorFeatures(rawPoints) {
  const points = smoothPoints(sanitizePoints(rawPoints));
  if (points.length < 5) {
    throw new Error(
      "At least 5 gesture points are required for behavioral analysis",
    );
  }

  const durations = [];
  const velocities = [];
  const speedSamples = [];
  const accelerations = [];
  const curvatures = [];
  const directionVectors = [];
  const angleSequence = [];
  const directionChanges = [];
  let pathLength = 0;
  let pauseCount = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.hypot(dx, dy);
    const dt = Math.max(curr.t - prev.t, 1);
    const v = dist / dt;

    durations.push(dt);
    velocities.push(v);
    speedSamples.push(v);
    pathLength += dist;
    directionVectors.push(Math.atan2(dy, dx));

    if (v < 0.03 && dt > 45) {
      pauseCount += 1;
    }

    if (velocities.length > 1) {
      const prevV = velocities[velocities.length - 2];
      accelerations.push((v - prevV) / dt);
    }
  }

  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];

    const v1x = b.x - a.x;
    const v1y = b.y - a.y;
    const v2x = c.x - b.x;
    const v2y = c.y - b.y;

    const angle1 = Math.atan2(v1y, v1x);
    const angle2 = Math.atan2(v2y, v2x);
    let delta = Math.abs(angle2 - angle1);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    angleSequence.push(delta);
    curvatures.push(delta / (Math.hypot(v1x, v1y) + EPSILON));
    if (delta > 0.45) {
      directionChanges.push(1);
    }
  }

  const totalTime = Math.max(points[points.length - 1].t - points[0].t, 1);
  const averageInterval = mean(durations);
  const avgVelocity = mean(velocities);
  const maxSpeed = speedSamples.length ? Math.max(...speedSamples) : 0;
  const velocityVar = variance(velocities, avgVelocity);
  const rhythmVariance = variance(durations, averageInterval);
  const rhythmConsistency = clamp01(1 - Math.min(rhythmVariance / 2000, 1));
  const curvature = mean(curvatures);
  const directionChangeFrequency = directionChanges.length
    ? mean(directionChanges)
    : 0;

  const start = points[0];
  const end = points[points.length - 1];
  const directDistance = Math.hypot(end.x - start.x, end.y - start.y);
  const tortuosity = pathLength / (directDistance + EPSILON);

  const normalizedShape = normalizePoints(points);
  const shapeSignature = aggregateShapeSignature(
    angleSequence,
    directionVectors,
  );

  return {
    points,
    normalizedShape,
    totalTime,
    averageInterval,
    pauseCount,
    rhythmConsistency,
    rhythmVariance,
    instantaneousVelocity: velocities,
    avgVelocity,
    maxSpeed,
    velocityVariance: velocityVar,
    accelerationPatterns: accelerations,
    pauseRatio: pauseCount / Math.max(velocities.length, 1),
    curvature,
    curvaturePerSegment: curvatures,
    directionChangeFrequency,
    angleSequence,
    directionVectors,
    shapeSignature,
    tortuosity,
    raw: {
      velocities,
      durations,
      angleChanges: angleSequence,
    },
  };
}

function normalizeIdentityVector(features) {
  // SFAM abstraction into fixed-size normalized identity vector.
  const normalizedTime = clamp01(features.totalTime / 3000);
  const normalizedVelocity = clamp01(features.avgVelocity / 1.2);
  const normalizedVelocityVariance = clamp01(features.velocityVariance / 0.08);
  const normalizedTortuosity = clamp01((features.tortuosity - 1) / 4);
  const normalizedCurvature = clamp01(features.curvature * 4);
  const normalizedShapeSignature = clamp01(features.shapeSignature);
  const normalizedRhythmConsistency = clamp01(features.rhythmConsistency);

  return [
    normalizedTime,
    normalizedVelocity,
    normalizedVelocityVariance,
    normalizedTortuosity,
    normalizedCurvature,
    normalizedShapeSignature,
    normalizedRhythmConsistency,
  ];
}

function computeBaseline(vectors = []) {
  if (vectors.length === 0) {
    return {
      baseline_vector: [],
      variance_vector: [],
      range_min_vector: [],
      range_max_vector: [],
    };
  }

  const dims = vectors[0].length;
  const baseline = [];
  const varianceVec = [];
  const minVec = [];
  const maxVec = [];

  for (let i = 0; i < dims; i++) {
    const series = vectors.map((v) => v[i]);
    const avg = mean(series);
    baseline.push(avg);
    varianceVec.push(variance(series, avg));
    minVec.push(Math.min(...series));
    maxVec.push(Math.max(...series));
  }

  return {
    baseline_vector: baseline,
    variance_vector: varianceVec,
    range_min_vector: minVec,
    range_max_vector: maxVec,
  };
}

function classifyDeviation(distance) {
  if (distance < 0.12) return "normal";
  if (distance < 0.3) return "slightly_unusual";
  return "highly_unusual";
}

function runRLFS(currentVector, baselineModel) {
  const baseline = baselineModel.baseline_vector || [];
  const varianceVec = baselineModel.variance_vector || [];

  if (baseline.length === 0) {
    return {
      anomaly_score: 0,
      cosine_similarity: 1,
      euclidean_distance: 0,
      hamming_distance: 0,
      dtw_distance: 0,
      top_anomalies: [],
      deviation_vector: FEATURE_NAMES.map(() => 0),
      classification: "normal",
    };
  }

  const cosine = cosineSimilarity(currentVector, baseline);
  const euclidean = euclideanDistance(currentVector, baseline);
  const currentBits = quantizeBinary(currentVector);
  const baselineBits = quantizeBinary(baseline);
  const hamming = hammingDistance(currentBits, baselineBits);
  const dtw = dtwDistance(currentVector, baseline);

  const deviations = currentVector.map((value, i) =>
    Math.abs(value - baseline[i]),
  );

  const normalizedDeviations = deviations.map((d, i) => {
    const sigma = Math.sqrt(varianceVec[i] || 0.0025);
    return clamp01(d / (2 * sigma + 0.05));
  });

  const anomalyScore = clamp01(
    mean(normalizedDeviations) * 0.5 +
      (1 - cosine) * 0.25 +
      clamp01(euclidean / 2.0) * 0.15 +
      hamming * 0.1,
  );

  const topAnomalies = normalizedDeviations
    .map((score, i) => ({ key: FEATURE_NAMES[i], score }))
    .sort((a, b) => b.score - a.score)
    .filter((item) => item.score > 0.35)
    .slice(0, 2)
    .map((item) => item.key);

  const classification = classifyDeviation(mean(deviations));

  return {
    anomaly_score: anomalyScore,
    cosine_similarity: cosine,
    euclidean_distance: euclidean,
    hamming_distance: hamming,
    dtw_distance: dtw,
    top_anomalies: topAnomalies,
    deviation_vector: normalizedDeviations,
    classification,
  };
}

function runSADR(rlfsOutput) {
  const deviationMean = mean(rlfsOutput.deviation_vector || [0]);
  const normalizedDistance = clamp01(
    (clamp01((rlfsOutput.euclidean_distance || 0) / 2) +
      (rlfsOutput.hamming_distance || 0)) /
      2,
  );
  const riskScore = clamp01(
    0.4 * rlfsOutput.anomaly_score +
      0.3 * (1 - (rlfsOutput.cosine_similarity || 0)) +
      0.3 * normalizedDistance,
  );

  let decision = "allow";
  if (riskScore >= 0.8) decision = "block";
  else if (riskScore >= 0.6) decision = "step_up";
  else if (riskScore >= 0.3) decision = "allow_with_warning";

  let riskLevel = "low";
  if (riskScore >= 0.6) riskLevel = "high";
  else if (riskScore >= 0.3) riskLevel = "medium";

  return {
    risk_score: riskScore,
    risk_level: riskLevel,
    decision,
    deviation_mean: deviationMean,
    normalized_distance: normalizedDistance,
  };
}

function buildExplanation(topAnomalies = []) {
  if (!topAnomalies.length) {
    return ["Behavior aligned with baseline"];
  }

  const labelMap = {
    normalized_time: "timing inconsistency",
    avg_speed: "speed anomaly",
    speed_variance: "speed variance anomaly",
    tortuosity: "tortuosity anomaly",
    curvature: "curvature mismatch",
    shape_signature: "shape mismatch",
    rhythm_consistency: "rhythm inconsistency",
  };

  return topAnomalies.map((key) => labelMap[key] || `${key} anomaly`);
}

function computeDriftState(vectors = []) {
  if (vectors.length < 4) return "stable";

  const latest = vectors[vectors.length - 1];
  const previous = vectors[vectors.length - 2];
  const olderAvg = computeBaseline(
    vectors.slice(Math.max(0, vectors.length - 6), vectors.length - 1),
  ).baseline_vector;

  if (!olderAvg?.length) return "stable";

  const suddenDelta = mean(latest.map((v, i) => Math.abs(v - previous[i])));
  const gradualDelta = mean(latest.map((v, i) => Math.abs(v - olderAvg[i])));

  if (suddenDelta > 0.25) return "sudden";
  if (gradualDelta > 0.12) return "gradual";
  return "stable";
}

function createScenarioPoints(basePoints, scenario = "normal") {
  const points = basePoints.map((p) => ({ ...p }));

  if (scenario === "attacker") {
    return points.map((p, i) => ({
      ...p,
      t: p.t + i * 14,
      x: p.x + Math.sin(i / 2) * 5,
      y: p.y + Math.cos(i / 3) * 4,
    }));
  }

  if (scenario === "variation") {
    return points.map((p, i) => ({
      ...p,
      t: p.t + i * 4,
      x: p.x + Math.sin(i / 4) * 2,
      y: p.y + Math.cos(i / 4) * 1.5,
    }));
  }

  return points;
}

export {
  FEATURE_NAMES,
  cosineSimilarity,
  euclideanDistance,
  hammingDistance,
  dtwDistance,
  extractBehaviorFeatures,
  normalizeIdentityVector,
  computeBaseline,
  runRLFS,
  runSADR,
  buildExplanation,
  computeDriftState,
  createScenarioPoints,
};
