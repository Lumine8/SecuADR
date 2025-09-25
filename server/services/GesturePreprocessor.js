class GesturePreprocessor {
  static normalizeGesture(rawPoints) {
    if (!rawPoints || rawPoints.length < 3) {
      throw new Error("Insufficient gesture data");
    }

    // 1. Extract coordinates
    const points = rawPoints.map((p) => ({ x: p.X || p.x, y: p.Y || p.y }));

    // 2. Normalize to bounding box
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));

    const width = maxX - minX || 1;
    const height = maxY - minY || 1;

    const normalized = points.map((p) => ({
      x: (p.x - minX) / width,
      y: (p.y - minY) / height,
    }));

    // 3. Resample to fixed length (64 points)
    return this.resamplePoints(normalized, 64);
  }

  static resamplePoints(points, targetLength) {
    if (points.length === targetLength) return points;

    const resampled = [];
    const step = (points.length - 1) / (targetLength - 1);

    for (let i = 0; i < targetLength; i++) {
      const index = i * step;
      const lowerIndex = Math.floor(index);
      const upperIndex = Math.ceil(index);

      if (lowerIndex === upperIndex) {
        resampled.push(points[lowerIndex]);
      } else {
        const ratio = index - lowerIndex;
        const x =
          points[lowerIndex].x +
          ratio * (points[upperIndex].x - points[lowerIndex].x);
        const y =
          points[lowerIndex].y +
          ratio * (points[upperIndex].y - points[lowerIndex].y);
        resampled.push({ x, y });
      }
    }

    return resampled;
  }

  static gestureToTensor(normalizedPoints) {
    // Convert to flat array [x1, y1, x2, y2, ...]
    const flatArray = normalizedPoints.flatMap((p) => [p.x, p.y]);
    return flatArray; // 128 features (64 points × 2 coordinates)
  }
}

module.exports = GesturePreprocessor;
