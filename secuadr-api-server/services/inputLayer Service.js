/**
 * Input Layer Service
 * Processes raw behavioral input from the client
 * Extracts physics and features from gesture, typing, touch data
 */

class InputLayerService {
  /**
   * Process gesture input and extract physics
   */
  processGestureInput(gestureInput) {
    if (!gestureInput || !Array.isArray(gestureInput)) {
      return {
        raw_points: [],
        duration_ms: 0,
        bounding_box: { min_x: 0, min_y: 0, max_x: 0, max_y: 0 },
        velocity_mean: 0,
        acceleration_mean: 0,
        jerk_mean: 0,
      };
    }

    const points = gestureInput;

    // Extract timing and position
    const firstTime = points[0]?.timestamp || 0;
    const lastTime = points[points.length - 1]?.timestamp || 0;
    const duration_ms = Math.max(lastTime - firstTime, 1); // Avoid division by zero

    // Calculate bounding box
    const xs = points.map((p) => p.x || 0);
    const ys = points.map((p) => p.y || 0);
    const bounding_box = {
      min_x: Math.min(...xs),
      min_y: Math.min(...ys),
      max_x: Math.max(...xs),
      max_y: Math.max(...ys),
    };

    // Calculate physics: velocity, acceleration, jerk
    const physics = this._calculatePhysics(points);

    return {
      raw_points: points,
      duration_ms,
      bounding_box,
      ...physics,
    };
  }

  /**
   * Process typing input (keystroke dynamics)
   */
  processTypingInput(typingInput) {
    if (!typingInput) {
      return {
        dwell_times: [],
        flight_times: [],
        hold_duration: 0,
        dwell_time_mean: 0,
        dwell_time_std: 0,
        flight_time_mean: 0,
        flight_time_std: 0,
      };
    }

    const dwell_times = typingInput.dwell_times || [];
    const flight_times = typingInput.flight_times || [];
    const hold_duration = typingInput.hold_duration || 0;

    // Calculate statistics
    const dwellStats = this._calculateStats(dwell_times);
    const flightStats = this._calculateStats(flight_times);

    return {
      dwell_times,
      flight_times,
      hold_duration,
      dwell_time_mean: dwellStats.mean,
      dwell_time_std: dwellStats.std,
      flight_time_mean: flightStats.mean,
      flight_time_std: flightStats.std,
    };
  }

  /**
   * Process touch input (pressure, area, gesture dynamics)
   */
  processTouchInput(touchInput) {
    if (!touchInput) {
      return {
        pressure_curve: [],
        touch_area: [],
        pressure_mean: 0,
        pressure_std: 0,
        area_mean: 0,
        area_std: 0,
        multi_touch: false,
      };
    }

    const pressure_curve = touchInput.pressure_curve || [];
    const touch_area = touchInput.touch_area || [];
    const multi_touch = touchInput.multi_touch || false;

    const pressureStats = this._calculateStats(pressure_curve);
    const areaStats = this._calculateStats(touch_area);

    return {
      pressure_curve,
      touch_area,
      multi_touch,
      pressure_mean: pressureStats.mean,
      pressure_std: pressureStats.std,
      area_mean: areaStats.mean,
      area_std: areaStats.std,
    };
  }

  /**
   * Process session context (device, location, timing)
   */
  processSessionContext(context = {}) {
    return {
      timestamp: new Date(context.timestamp || Date.now()),
      hour_of_day: new Date(context.timestamp || Date.now()).getHours(),
      ip_address: context.ip_address || "unknown",
      user_agent: context.user_agent || "unknown",
      device: context.device || { id: "unknown", type: "web", name: "Unknown" },
      location: context.location || { lat: 0, lon: 0, accuracy: 0 },
    };
  }

  /**
   * Main entry: Process all input types
   */
  processAllInput(input) {
    return {
      gesture: this.processGestureInput(input.gesture),
      typing: this.processTypingInput(input.typing),
      touch: this.processTouchInput(input.touch),
      session: this.processSessionContext(input.session),
    };
  }

  /**
   * Calculate physics: velocity, acceleration, jerk
   */
  _calculatePhysics(points) {
    if (!points || points.length < 2) {
      return { velocity_mean: 0, acceleration_mean: 0, jerk_mean: 0 };
    }

    const velocities = [];
    const accelerations = [];
    const jerks = [];

    // Calculate velocities
    for (let i = 1; i < points.length; i++) {
      const dt = points[i].timestamp - points[i - 1].timestamp || 1;
      if (dt === 0) continue;

      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const vel = Math.sqrt(dx * dx + dy * dy) / dt;
      velocities.push(vel);
    }

    // Calculate accelerations from velocities
    for (let i = 1; i < velocities.length; i++) {
      const dt = points[i + 1].timestamp - points[i].timestamp || 1;
      if (dt === 0) continue;

      const acc = (velocities[i] - velocities[i - 1]) / dt;
      accelerations.push(acc);
    }

    // Calculate jerks from accelerations
    for (let i = 1; i < accelerations.length; i++) {
      const dt = points[i + 2].timestamp - points[i + 1].timestamp || 1;
      if (dt === 0) continue;

      const jerk = (accelerations[i] - accelerations[i - 1]) / dt;
      jerks.push(jerk);
    }

    // Calculate means
    const velocity_mean =
      velocities.length > 0
        ? velocities.reduce((a, b) => a + b) / velocities.length
        : 0;
    const acceleration_mean =
      accelerations.length > 0
        ? accelerations.reduce((a, b) => a + b) / accelerations.length
        : 0;
    const jerk_mean =
      jerks.length > 0 ? jerks.reduce((a, b) => a + b) / jerks.length : 0;

    return {
      velocity_mean,
      velocity_std: this._calculateStd(velocities),
      acceleration_mean,
      acceleration_std: this._calculateStd(accelerations),
      jerk_mean,
      jerk_std: this._calculateStd(jerks),
    };
  }

  /**
   * Helper: Calculate mean and std of array
   */
  _calculateStats(arr) {
    if (!arr || arr.length === 0) {
      return { mean: 0, std: 0 };
    }

    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const std = this._calculateStd(arr);

    return { mean, std };
  }

  /**
   * Helper: Calculate standard deviation
   */
  _calculateStd(arr) {
    if (!arr || arr.length === 0) return 0;

    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance =
      arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }
}

export const inputLayerService = new InputLayerService();
export default inputLayerService;
