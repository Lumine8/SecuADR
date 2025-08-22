import React, { useRef, useState } from "react";
import {
  View,
  StyleSheet,
  PanResponder,
  Dimensions,
  Button,
  Alert,
} from "react-native";
import Svg, { Path } from "react-native-svg";

export default function Pattern() {
  const [paths, setPaths] = useState([]);
  const currentPath = useRef("");

  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;

  const getPath = (points) => {
    return points.reduce(
      (acc, point, i) =>
        i === 0 ? `M${point.x},${point.y}` : `${acc} L${point.x},${point.y}`,
      ""
    );
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current = getPath([{ x: locationX, y: locationY }]);
        setPaths((prev) => [...prev, currentPath.current]);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current += ` L${locationX},${locationY}`;
        setPaths((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = currentPath.current;
          return updated;
        });
      },
      onPanResponderRelease: () => {
        currentPath.current = "";
      },
    })
  ).current;

  // 🎯 Controls
  const handleClear = () => {
    setPaths([]);
  };

  const handleUndo = () => {
    setPaths((prev) => prev.slice(0, -1));
  };

  const handleSave = () => {
    if (paths.length === 0) {
      Alert.alert("No pattern", "Draw something before saving!");
      return;
    }
    // Here you can send "paths" to backend or secure storage
    Alert.alert("Pattern Saved", JSON.stringify(paths));
  };

  return (
    <View style={styles.container}>
      {/* Drawing Canvas */}
      <Svg height={screenHeight} width={screenWidth} style={styles.canvas}>
        {paths.map((d, index) => (
          <Path
            key={index}
            d={d}
            stroke="blue"
            strokeWidth={4}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </Svg>

      {/* Transparent gesture layer */}
      <View
        style={[
          styles.touchLayer,
          { width: screenWidth, height: screenHeight },
        ]}
        {...panResponder.panHandlers}
      />

      {/* Controls */}
      <View style={styles.controls}>
        <Button title="Undo" onPress={handleUndo} />
        <Button title="Clear" onPress={handleClear} />
        <Button title="Save" onPress={handleSave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  touchLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "transparent",
  },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-evenly",
  },
});
