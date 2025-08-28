// Minimal $1 Unistroke Recognizer (JS version)
export default function DollarRecognizer() {
  this.NumPoints = 64;
  this.SquareSize = 250;
  this.Origin = { x: 0, y: 0 };
  this.Diagonal = Math.sqrt(this.SquareSize ** 2 + this.SquareSize ** 2);
  this.HalfDiagonal = 0.5 * this.Diagonal;
  this.AngleRange = Deg2Rad(45);
  this.AnglePrecision = Deg2Rad(2);
  this.Phi = 0.5 * (-1.0 + Math.sqrt(5.0)); // Golden Ratio

  this.templates = [];

  this.addGesture = function(name, points) {
    let processed = Resample(points, this.NumPoints);
    processed = RotateToZero(processed);
    processed = ScaleToSquare(processed, this.SquareSize);
    processed = TranslateToOrigin(processed, this.Origin);
    this.templates.push({ name, points: processed });
  };

  this.recognize = function(points) {
    let candidate = Resample(points, this.NumPoints);
    candidate = RotateToZero(candidate);
    candidate = ScaleToSquare(candidate, this.SquareSize);
    candidate = TranslateToOrigin(candidate, this.Origin);

    let bestDist = Infinity;
    let bestName = "No match";

    for (let tmpl of this.templates) {
      const d = DistanceAtBestAngle(
        candidate,
        tmpl.points,
        -this.AngleRange,
        +this.AngleRange,
        this.AnglePrecision
      );
      if (d < bestDist) {
        bestDist = d;
        bestName = tmpl.name;
      }
    }

    const score = 1.0 - bestDist / this.HalfDiagonal;
    return { name: bestName, score };
  };
}

// --- Helpers ---
function Resample(points, n) {
  const I = PathLength(points) / (n - 1);
  let D = 0.0;
  const newPoints = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const d = Distance(points[i - 1], points[i]);
    if ((D + d) >= I) {
      const qx = points[i - 1].x + ((I - D) / d) * (points[i].x - points[i - 1].x);
      const qy = points[i - 1].y + ((I - D) / d) * (points[i].y - points[i - 1].y);
      const q = { x: qx, y: qy };
      newPoints.push(q);
      points.splice(i, 0, q);
      D = 0.0;
    } else {
      D += d;
    }
  }
  if (newPoints.length === n - 1) newPoints.push(points[points.length - 1]);
  return newPoints;
}
function RotateToZero(points) {
  const c = Centroid(points);
  const theta = Math.atan2(c.y - points[0].y, c.x - points[0].x);
  return RotateBy(points, -theta, c);
}
function ScaleToSquare(points, size) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const newPoints = [];
  for (let p of points) {
    newPoints.push({
      x: (p.x - minX) / (maxX - minX) * size,
      y: (p.y - minY) / (maxY - minY) * size
    });
  }
  return newPoints;
}
function TranslateToOrigin(points, origin) {
  const c = Centroid(points);
  const newPoints = [];
  for (let p of points) {
    newPoints.push({ x: p.x + origin.x - c.x, y: p.y + origin.y - c.y });
  }
  return newPoints;
}
function DistanceAtBestAngle(points, template, a, b, threshold) {
  let x1 = this.Phi * a + (1.0 - this.Phi) * b;
  let f1 = DistanceAtAngle(points, template, x1);
  let x2 = (1.0 - this.Phi) * a + this.Phi * b;
  let f2 = DistanceAtAngle(points, template, x2);
  while (Math.abs(b - a) > threshold) {
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = this.Phi * a + (1.0 - this.Phi) * b;
      f1 = DistanceAtAngle(points, template, x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = (1.0 - this.Phi) * a + this.Phi * b;
      f2 = DistanceAtAngle(points, template, x2);
    }
  }
  return Math.min(f1, f2);
}
function DistanceAtAngle(points, template, theta) {
  const newPoints = RotateBy(points, theta, Centroid(points));
  return PathDistance(newPoints, template);
}
function Centroid(points) {
  let x = 0, y = 0;
  for (let p of points) { x += p.x; y += p.y; }
  return { x: x / points.length, y: y / points.length };
}
function RotateBy(points, theta, c) {
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const newPoints = [];
  for (let p of points) {
    newPoints.push({
      x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
      y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y
    });
  }
  return newPoints;
}
function PathDistance(pts1, pts2) {
  let d = 0.0;
  for (let i = 0; i < pts1.length; i++) {
    d += Distance(pts1[i], pts2[i]);
  }
  return d / pts1.length;
}
function PathLength(points) {
  let d = 0.0;
  for (let i = 1; i < points.length; i++) d += Distance(points[i - 1], points[i]);
  return d;
}
function Distance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}
function Deg2Rad(d) { return (d * Math.PI / 180.0); }
