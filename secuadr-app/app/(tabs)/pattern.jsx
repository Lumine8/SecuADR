import React, { useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Button,
  Alert,
  Text,
  TextInput,
  Dimensions,
  PanResponder,
} from "react-native";
import Svg, { Path } from "react-native-svg";

/* ------------------ $1 Recognizer ------------------ */
class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

class DollarRecognizer {
  constructor() {
    this.NumPoints = 64;
    this.SquareSize = 250.0;
    this.Origin = new Point(0, 0);
    this.templates = [];
  }

  addGesture(name, points) {
    const processed = this.processPoints(points);
    this.templates.push({ name, points: processed });
    return this.templates.length;
  }

  recognize(points) {
    if (points.length < 10) return { name: "Too few points", score: 0 };
    const processed = this.processPoints(points);
    let bestScore = Infinity;
    let bestTemplate = null;

    for (let template of this.templates) {
      const d = this.pathDistance(processed, template.points);
      if (d < bestScore) {
        bestScore = d;
        bestTemplate = template;
      }
    }

    return bestTemplate
      ? {
          name: bestTemplate.name,
          score: 1 - bestScore / (0.5 * Math.sqrt(2 * this.SquareSize ** 2)),
        }
      : { name: "No match", score: 0 };
  }

  processPoints(points) {
    let pts = points.map((p) => new Point(p.x, p.y));
    pts = this.resample(pts, this.NumPoints);
    const radians = this.indicativeAngle(pts);
    pts = this.rotateBy(pts, -radians);
    pts = this.scaleToSquare(pts, this.SquareSize);
    pts = this.translateToOrigin(pts);
    return pts;
  }

  resample(points, n) {
    let I = this.pathLength(points) / (n - 1);
    let D = 0.0;
    let newPoints = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const d = this.distance(points[i - 1], points[i]);
      if (D + d >= I) {
        const qx =
          points[i - 1].x + ((I - D) / d) * (points[i].x - points[i - 1].x);
        const qy =
          points[i - 1].y + ((I - D) / d) * (points[i].y - points[i - 1].y);
        const q = new Point(qx, qy);
        newPoints.push(q);
        points.splice(i, 0, q);
        D = 0.0;
      } else {
        D += d;
      }
    }
    if (newPoints.length === n - 1) {
      newPoints.push(points[points.length - 1]);
    }
    return newPoints;
  }

  indicativeAngle(points) {
    const c = this.centroid(points);
    return Math.atan2(points[0].y - c.y, points[0].x - c.x);
  }

  rotateBy(points, radians) {
    const c = this.centroid(points);
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return points.map((p) => {
      const qx = (p.x - c.x) * cos - (p.y - c.y) * sin + c.x;
      const qy = (p.x - c.x) * sin + (p.y - c.y) * cos + c.y;
      return new Point(qx, qy);
    });
  }

  scaleToSquare(points, size) {
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));
    const scale = Math.max(maxX - minX, maxY - minY);
    return points.map(
      (p) =>
        new Point(((p.x - minX) / scale) * size, ((p.y - minY) / scale) * size)
    );
  }

  translateToOrigin(points) {
    const c = this.centroid(points);
    return points.map((p) => new Point(p.x - c.x, p.y - c.y));
  }

  centroid(points) {
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return new Point(x, y);
  }

  pathLength(points) {
    let d = 0;
    for (let i = 1; i < points.length; i++)
      d += this.distance(points[i - 1], points[i]);
    return d;
  }

  pathDistance(pts1, pts2) {
    let d = 0;
    for (let i = 0; i < pts1.length; i++) d += this.distance(pts1[i], pts2[i]);
    return d / pts1.length;
  }

  distance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/* ------------------ Pattern Screen ------------------ */
export default function Pattern() {
  const [paths, setPaths] = useState([]);
  const [allPoints, setAllPoints] = useState([]);
  const [gestureName, setGestureName] = useState("");
  const [feedback, setFeedback] = useState({ name: "", score: 0 });
  const currentPath = useRef([]);
  const recognizer = useRef(new DollarRecognizer()).current;

  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  const getPathString = (points) => {
    if (!points.length) return "";
    return points
      .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
      .join(" ");
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current = [{ x: locationX, y: locationY }];
        setPaths((prev) => [...prev, currentPath.current]);
        setAllPoints((prev) => [...prev, { x: locationX, y: locationY }]);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current = [
          ...currentPath.current,
          { x: locationX, y: locationY },
        ];
        setPaths((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = currentPath.current;
          return updated;
        });
        setAllPoints((prev) => [...prev, { x: locationX, y: locationY }]);

        // Real-time recognition feedback
        if (recognizer.templates.length > 0) {
          const result = recognizer.recognize(
            allPoints.concat({ x: locationX, y: locationY })
          );
          setFeedback(result);
        }
      },
      onPanResponderRelease: () => {
        currentPath.current = [];
      },
    })
  ).current;

  const handleClear = () => {
    setPaths([]);
    setAllPoints([]);
    setFeedback({ name: "", score: 0 });
  };

  const handleUndo = () => {
    setPaths((prevPaths) => {
      if (prevPaths.length === 0) return prevPaths;

      const updatedPaths = prevPaths.slice(0, -1); // remove last stroke
      const lastStrokeLength = prevPaths[prevPaths.length - 1].length;

      setAllPoints((prevPoints) =>
        prevPoints.slice(0, prevPoints.length - lastStrokeLength)
      );

      return updatedPaths;
    });
  };

  const handleSaveGesture = () => {
    if (!gestureName.trim()) {
      Alert.alert("Name Required", "Please enter a name for this gesture.");
      return;
    }
    if (allPoints.length < 10) {
      Alert.alert("Too Few Points", "Draw a more complete pattern.");
      return;
    }
    recognizer.addGesture(gestureName, allPoints);
    Alert.alert("Saved!", `Gesture "${gestureName}" saved successfully.`);
    setGestureName("");
    handleClear();
  };

  return (
    <View style={styles.container}>
      <Svg height={screenHeight} width={screenWidth} style={styles.canvas}>
        {paths.map((points, idx) => (
          <Path
            key={idx}
            d={getPathString(points)}
            stroke="blue"
            strokeWidth={4}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </Svg>

      <View
        style={[
          styles.touchLayer,
          { width: screenWidth, height: screenHeight },
        ]}
        {...panResponder.panHandlers}
      />

      <View style={styles.controls}>
        <Button title="Undo" onPress={handleUndo} />
        <Button title="Clear" onPress={handleClear} />
      </View>

      <View style={styles.saveContainer}>
        <TextInput
          placeholder="Gesture Name"
          value={gestureName}
          onChangeText={setGestureName}
          style={styles.input}
        />
        <Button title="Save Gesture" onPress={handleSaveGesture} />
      </View>

      {feedback.name ? (
        <Text style={styles.feedback}>
          Recognized: {feedback.name} ({(feedback.score * 100).toFixed(1)}%)
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  canvas: { position: "absolute", top: 0, left: 0 },
  touchLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "transparent",
  },
  controls: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-evenly",
  },
  saveContainer: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#aaa",
    padding: 8,
    marginRight: 10,
    borderRadius: 8,
  },
  feedback: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    fontSize: 18,
    fontWeight: "bold",
    color: "green",
  },
});
