import tensorflow as tf
import numpy as np
import json
import sys
import os

class CNNPredictor:
    def __init__(self, model_path):
        self.model_path = model_path
        self.model = None
        self.canvas_size = 64
        
    def load_model(self):
        if os.path.exists(self.model_path):
            self.model = tf.keras.models.load_model(self.model_path)
            return True
        return False
        
    def points_to_tensor(self, points):
        # Create 64x64 image from gesture points
        canvas = np.zeros((self.canvas_size, self.canvas_size))
        
        if len(points) < 2:
            return np.zeros((1, self.canvas_size, self.canvas_size, 1))
            
        # Normalize points to canvas size
        xs = [p['X'] for p in points]
        ys = [p['Y'] for p in points]
        
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        
        width = max(max_x - min_x, 1)
        height = max(max_y - min_y, 1)
        
        # Draw gesture on canvas
        for i, point in enumerate(points):
            x = int(((point['X'] - min_x) / width) * (self.canvas_size - 4) + 2)
            y = int(((point['Y'] - min_y) / height) * (self.canvas_size - 4) + 2)
            
            x = max(0, min(x, self.canvas_size - 1))
            y = max(0, min(y, self.canvas_size - 1))
            
            canvas[y, x] = 1.0
            
            # Draw line to previous point
            if i > 0:
                prev_point = points[i-1]
                prev_x = int(((prev_point['X'] - min_x) / width) * (self.canvas_size - 4) + 2)
                prev_y = int(((prev_point['Y'] - min_y) / height) * (self.canvas_size - 4) + 2)
                
                # Simple line drawing
                steps = max(abs(x - prev_x), abs(y - prev_y))
                if steps > 0:
                    for step in range(steps + 1):
                        interp_x = int(prev_x + (x - prev_x) * step / steps)
                        interp_y = int(prev_y + (y - prev_y) * step / steps)
                        if 0 <= interp_x < self.canvas_size and 0 <= interp_y < self.canvas_size:
                            canvas[interp_y, interp_x] = 1.0
        
        # Convert to tensor format
        tensor = canvas.reshape(1, self.canvas_size, self.canvas_size, 1)
        return tensor.astype(np.float32)
        
    def predict(self, points):
        if not self.model:
            if not self.load_model():
                return 0.0
                
        tensor = self.points_to_tensor(points)
        prediction = self.model.predict(tensor, verbose=0)
        confidence = float(prediction[0][0])
        
        return confidence

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python cnn-predictor.py '<points_json>'")
        sys.exit(1)
        
    try:
        points_json = sys.argv[1]
        points = json.loads(points_json)
        
        predictor = CNNPredictor('../training/models/secuadr_cnn_model.h5')
        confidence = predictor.predict(points)
        
        print(confidence)
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
