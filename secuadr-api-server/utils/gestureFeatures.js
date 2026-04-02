/**
 * Gesture Feature Extraction
 * Converts raw gesture points to SFAM-compatible spatial and behavioral features
 */

/**
 * Extract behavioral features from gesture points
 * Features: [dx, dy, velocity, acceleration, pressure, azimuth]
 * @param {Array} points - Raw points [{X, Y, ID}]
 * @returns {Array} Behavioral feature vectors
 */
export function extractBehavioralFeatures(points) {
  if (!points || points.length < 2) {
    return [];
  }

  const features = [];
  const maxLength = Math.min(64, points.length); // SFAM expects up to 64 frames

  for (let i = 0; i < maxLength; i++) {
    const current = points[i];
    const prev = i > 0 ? points[i - 1] : current;
    const next = i < points.length - 1 ? points[i + 1] : current;

    const currentTime =
      Number(current.T ?? current.t ?? current.timestamp ?? i) || i;
    const prevTime =
      Number(prev.T ?? prev.t ?? prev.timestamp ?? Math.max(i - 1, 0)) ||
      Math.max(i - 1, 0);
    const dt = Math.max(currentTime - prevTime, 1);

    // Calculate deltas (dx, dy)
    const dx = current.X - prev.X;
    const dy = current.Y - prev.Y;

    // Calculate velocity (distance per millisecond)
    const velocity = Math.sqrt(dx * dx + dy * dy) / dt;

    // Calculate acceleration (change in velocity)
    const nextDx = next.X - current.X;
    const nextDy = next.Y - current.Y;
    const nextTime =
      Number(next.T ?? next.t ?? next.timestamp ?? i + 1) || i + 1;
    const nextDt = Math.max(nextTime - currentTime, 1);
    const nextVelocity = Math.sqrt(nextDx * nextDx + nextDy * nextDy) / nextDt;
    const acceleration = (nextVelocity - velocity) / dt;

    // Pressure (normalized from ID or constant)
    const pressure = (current.ID || 1) / 255; // Normalize to [0,1]

    // Azimuth (angle of motion)
    const azimuth = Math.atan2(dy, dx);

    features.push([dx, dy, velocity, acceleration, pressure, azimuth]);
  }

  // Pad with zeros if not enough frames
  while (features.length < 64) {
    features.push([0, 0, 0, 0, 0, 0]);
  }

  return features;
}

/**
 * Build strict behavioral summary features used for robustness gates.
 * These are modeled after the reference STRICT pipeline but use geometric
 * deltas because frontend payload currently has no timestamps.
 */
export function extractBehavioralStats(points) {
  if (!points || points.length < 2) {
    return null;
  }

  const velocities = [];
  const intervals = [];
  const headings = [];
  const angleChanges = [];
  const accels = [];
  let pathLength = 0;

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];

    const dx = p2.X - p1.X;
    const dy = p2.Y - p1.Y;
    const dist = Math.hypot(dx, dy);
    pathLength += dist;

    const t1 = Number(p1.T ?? p1.t ?? p1.timestamp ?? i - 1) || i - 1;
    const t2 = Number(p2.T ?? p2.t ?? p2.timestamp ?? i) || i;
    const dt = Math.max(t2 - t1, 1);
    intervals.push(dt);

    const v = dist / dt;
    velocities.push(v);
    headings.push(Math.atan2(dy, dx));

    if (i > 1) {
      const dv =
        velocities[velocities.length - 1] - velocities[velocities.length - 2];
      accels.push(Math.abs(dv) / dt);

      let dtheta = Math.abs(
        headings[headings.length - 1] - headings[headings.length - 2],
      );
      if (dtheta > Math.PI) dtheta = 2 * Math.PI - dtheta;
      angleChanges.push(dtheta);
    }
  }

  if (velocities.length === 0) {
    return null;
  }

  const logVels = velocities.map((v) => Math.log1p(v));
  const speed = median(logVels);
  const max_speed = Math.max(...logVels);
  const accel = Math.log1p(mean(accels.length > 0 ? accels : [0]));
  const stability = stddev(logVels);
  const duration = Math.max(mean(intervals) * points.length, 1);
  const speed_var = stddev(velocities);
  const curvature = mean(angleChanges) / Math.PI;
  const rhythm = clamp01(1 - stddev(intervals) / (mean(intervals) + 1e-5));

  const start = points[0];
  const end = points[points.length - 1];
  const euclidean = Math.hypot(end.X - start.X, end.Y - start.Y);
  const tortuosity = pathLength / (euclidean + 1e-5);
  const shape = clamp01(
    (mean(angleChanges) / Math.PI) * 0.5 +
      Math.min((tortuosity - 1) / 3, 1) * 0.5,
  );

  return {
    time: duration,
    speed,
    speed_var,
    max_speed,
    accel,
    stability,
    duration,
    tortuosity,
    curvature,
    shape,
    rhythm,
  };
}

/**
 * Resample and normalize a gesture path to a compact shape signature.
 */
export function computeShapeSignature(points, numPoints = 64) {
  if (!points || points.length < 2) {
    return null;
  }

  const xy = points.map((p) => [p.X, p.Y]);
  const resampled = resamplePolyline(xy, numPoints);
  if (resampled.length < 2) {
    return null;
  }

  const centered = centerPoints(resampled);
  const scale = maxAbs(centered) + 1e-5;

  return centered.map(([x, y]) => [x / scale, y / scale]);
}

/**
 * Create spatial representation from gesture points
 * Generates a 224x224 image of the gesture stroke
 * @param {Array} points - Raw points [{X, Y, ID}]
 * @param {number} width - Canvas width (default 320)
 * @param {number} height - Canvas height (default 320)
 * @returns {Array} 3-channel 224x224 image [3][224][224]
 */
export function createSpatialRepresentation(points, width = 320, height = 320) {
  // Initialize 3 channels (RGB)
  const spatial = [
    Array(224)
      .fill(null)
      .map(() => Array(224).fill(0)),
    Array(224)
      .fill(null)
      .map(() => Array(224).fill(0)),
    Array(224)
      .fill(null)
      .map(() => Array(224).fill(0)),
  ];

  if (!points || points.length === 0) {
    return spatial;
  }

  // Find bounding box
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.X);
    maxX = Math.max(maxX, p.X);
    minY = Math.min(minY, p.Y);
    maxY = Math.max(maxY, p.Y);
  }

  // Add padding
  const padding = 20;
  minX = Math.max(0, minX - padding);
  maxX = Math.min(width, maxX + padding);
  minY = Math.max(0, minY - padding);
  maxY = Math.min(height, maxY + padding);

  const boundWidth = maxX - minX || 1;
  const boundHeight = maxY - minY || 1;

  // Draw stroke on the image
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Normalize coordinates to [0, 224]
    const x1 = Math.round(((p1.X - minX) / boundWidth) * 223);
    const y1 = Math.round(((p1.Y - minY) / boundHeight) * 223);
    const x2 = Math.round(((p2.X - minX) / boundWidth) * 223);
    const y2 = Math.round(((p2.Y - minY) / boundHeight) * 223);

    // Bresenham line drawing
    drawLine(spatial, x1, y1, x2, y2, p1.ID || 255);
  }

  return spatial;
}

/**
 * Draw a line on the spatial representation using Bresenham's algorithm
 * @private
 */
function drawLine(spatial, x0, y0, x1, y1, intensity) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0,
    y = y0;

  // Normalize intensity to [0, 1]
  const value = Math.min(1, (intensity || 255) / 255);

  while (true) {
    // Clamp to bounds
    if (x >= 0 && x < 224 && y >= 0 && y < 224) {
      // Draw on red channel (primary)
      spatial[0][y][x] = Math.max(spatial[0][y][x], value);
      // Draw dimmer on green/blue for anti-aliasing effect
      if (spatial[1][y][x] < value * 0.7) spatial[1][y][x] = value * 0.7;
      if (spatial[2][y][x] < value * 0.5) spatial[2][y][x] = value * 0.5;
    }

    if (x === x1 && y === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

/**
 * Transform raw gesture points to SFAM format
 * @param {Array} points - Raw gesture points
 * @returns {Object} {spatial, behavioral} for SFAM service
 */
export function transformGestureToSFAM(points) {
  const stats = extractBehavioralStats(points);
  const shapeSignature = computeShapeSignature(points, 64);

  return {
    spatial: createSpatialRepresentation(points),
    behavioral: extractBehavioralFeatures(points),
    stats,
    shape_signature: shapeSignature,
  };
}

function mean(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function stddev(values) {
  if (!values || values.length === 0) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function resamplePolyline(points, numPoints) {
  if (!points || points.length < 2) return points || [];

  const dists = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    dists.push(dists[i - 1] + Math.hypot(dx, dy));
  }

  const total = dists[dists.length - 1];
  if (total === 0) return points;

  const sampled = [];
  for (let i = 0; i < numPoints; i++) {
    const target = (i / (numPoints - 1)) * total;
    let j = 1;
    while (j < dists.length && dists[j] < target) {
      j += 1;
    }

    if (j >= dists.length) {
      sampled.push(points[points.length - 1]);
      continue;
    }

    const prevDist = dists[j - 1];
    const nextDist = dists[j];
    const span = Math.max(nextDist - prevDist, 1e-8);
    const t = (target - prevDist) / span;

    const x = points[j - 1][0] + t * (points[j][0] - points[j - 1][0]);
    const y = points[j - 1][1] + t * (points[j][1] - points[j - 1][1]);
    sampled.push([x, y]);
  }

  return sampled;
}

function centerPoints(points) {
  const cx = mean(points.map((p) => p[0]));
  const cy = mean(points.map((p) => p[1]));
  return points.map(([x, y]) => [x - cx, y - cy]);
}

function maxAbs(points) {
  let v = 0;
  for (const [x, y] of points) {
    v = Math.max(v, Math.abs(x), Math.abs(y));
  }
  return v;
}
