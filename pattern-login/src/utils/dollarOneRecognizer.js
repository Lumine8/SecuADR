// src/utils/dollarOneRecognizer.js

function Point(x, y, id) {
  this.X = x;
  this.Y = y;
  this.ID = id;
}

function Result(name, score) {
  this.Name = name;
  this.Score = score;
}

function DollarRecognizer() {
  this.PointClouds = [];

  this.AddGesture = function (name, points) {
    this.PointClouds.push(new PointCloud(name, points));
    return this.PointClouds.length;
  };

  this.Recognize = function (points) {
    if (!points || points.length < 5) return new Result("No match", 0.0);

    points = Resample(points, 32);
    points = Scale(points);
    points = TranslateTo(points, Origin);

    let b = +Infinity;
    let u = -1;

    for (let i = 0; i < this.PointClouds.length; i++) {
      const d = GreedyCloudMatch(points, this.PointClouds[i].Points);
      if (d < b) {
        b = d;
        u = i;
      }
    }

    return u === -1
      ? new Result("No match", 0.0)
      : new Result(this.PointClouds[u].Name, Math.max((b - 2.0) / -2.0, 0.0));
  };
}

function PointCloud(name, points) {
  this.Name = name;
  this.Points = Resample(points, 32);
  this.Points = Scale(this.Points);
  this.Points = TranslateTo(this.Points, Origin);
}

const Origin = new Point(0, 0, 0);

function GreedyCloudMatch(points, P) {
  const e = 0.50;
  const step = Math.floor(Math.pow(points.length, 1 - e));
  let min = +Infinity;

  for (let i = 0; i < points.length; i += step) {
    const d1 = CloudDistance(points, P, i);
    const d2 = CloudDistance(P, points, i);
    min = Math.min(min, Math.min(d1, d2));
  }

  return min;
}

function CloudDistance(pts1, pts2, start) {
  const n = pts1.length;
  let matched = new Array(n).fill(false);
  let sum = 0;
  let i = start;

  do {
    let index = -1;
    let min = +Infinity;

    for (let j = 0; j < n; j++) {
      if (!matched[j]) {
        const d = Distance(pts1[i], pts2[j]);
        if (d < min) {
          min = d;
          index = j;
        }
      }
    }

    matched[index] = true;
    const weight = 1 - ((i - start + n) % n) / n;
    sum += weight * min;
    i = (i + 1) % n;
  } while (i !== start);

  return sum;
}

function Resample(points, n) {
  const I = PathLength(points) / (n - 1);
  let D = 0.0;
  const newPoints = [points[0]];

  for (let i = 1; i < points.length; i++) {
    if (points[i].ID === points[i - 1].ID) {
      const d = Distance(points[i - 1], points[i]);
      if (D + d >= I) {
        const qx =
          points[i - 1].X + ((I - D) / d) * (points[i].X - points[i - 1].X);
        const qy =
          points[i - 1].Y + ((I - D) / d) * (points[i].Y - points[i - 1].Y);
        const q = new Point(qx, qy, points[i].ID);
        newPoints.push(q);
        points.splice(i, 0, q);
        D = 0.0;
      } else {
        D += d;
      }
    }
  }

  if (newPoints.length === n - 1) {
    newPoints.push(points[points.length - 1]);
  }

  return newPoints;
}

function Scale(points) {
  let minX = +Infinity,
    maxX = -Infinity,
    minY = +Infinity,
    maxY = -Infinity;

  for (let pt of points) {
    minX = Math.min(minX, pt.X);
    maxX = Math.max(maxX, pt.X);
    minY = Math.min(minY, pt.Y);
    maxY = Math.max(maxY, pt.Y);
  }

  const size = Math.max(maxX - minX, maxY - minY);
  return points.map(
    (p) => new Point((p.X - minX) / size, (p.Y - minY) / size, p.ID)
  );
}

function TranslateTo(points, pt) {
  const c = Centroid(points);
  return points.map(
    (p) => new Point(p.X + pt.X - c.X, p.Y + pt.Y - c.Y, p.ID)
  );
}

function Centroid(points) {
  let x = 0.0,
    y = 0.0;
  for (let pt of points) {
    x += pt.X;
    y += pt.Y;
  }
  return new Point(x / points.length, y / points.length, 0);
}

function PathLength(points) {
  let d = 0.0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].ID === points[i - 1].ID) {
      d += Distance(points[i - 1], points[i]);
    }
  }
  return d;
}

function Distance(p1, p2) {
  if (!p1 || !p2) return Infinity;
  const dx = p2.X - p1.X;
  const dy = p2.Y - p1.Y;
  return Math.sqrt(dx * dx + dy * dy);
}

export default DollarRecognizer;
export { Point };
