import tensorflow as tf
import numpy as np
import json
import os
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt

class GestureDataProcessor:
    def __init__(self, canvas_size=64):
        self.canvas_size = canvas_size
    
    def points_to_image(self, points):
        """Convert gesture points to image tensor"""
        # Create blank canvas
        canvas = np.zeros((self.canvas_size, self.canvas_size))
        
        if len(points) < 2:
            return canvas
            
        # Normalize points to canvas size
        xs = [p['X'] for p in points]
        ys = [p['Y'] for p in points]
        
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        
        # Avoid division by zero
        width = max(max_x - min_x, 1)
        height = max(max_y - min_y, 1)
        
        # Normalize and scale to canvas
        for i in range(len(points)):
            x = int(((points[i]['X'] - min_x) / width) * (self.canvas_size - 1))
            y = int(((points[i]['Y'] - min_y) / height) * (self.canvas_size - 1))
            x = max(0, min(x, self.canvas_size - 1))
            y = max(0, min(y, self.canvas_size - 1))
            canvas[y, x] = 1.0
            
            # Draw line between consecutive points
            if i > 0:
                prev_x = int(((points[i-1]['X'] - min_x) / width) * (self.canvas_size - 1))
                prev_y = int(((points[i-1]['Y'] - min_y) / height) * (self.canvas_size - 1))
                self._draw_line(canvas, prev_x, prev_y, x, y)
        
        return canvas
    
    def _draw_line(self, canvas, x1, y1, x2, y2):
        """Draw line between two points"""
        points = self._get_line_points(x1, y1, x2, y2)
        for x, y in points:
            if 0 <= x < self.canvas_size and 0 <= y < self.canvas_size:
                canvas[y, x] = 1.0
    
    def _get_line_points(self, x1, y1, x2, y2):
        """Bresenham's line algorithm"""
        points = []
        dx = abs(x2 - x1)
        dy = abs(y2 - y1)
        sx = 1 if x1 < x2 else -1
        sy = 1 if y1 < y2 else -1
        err = dx - dy
        
        while True:
            points.append((x1, y1))
            if x1 == x2 and y1 == y2:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x1 += sx
            if e2 < dx:
                err += dx
                y1 += sy
                
        return points

def create_cnn_model(input_shape=(64, 64, 1)):
    """Create CNN model for gesture recognition"""
    model = tf.keras.Sequential([
        tf.keras.layers.Conv2D(32, (3, 3), activation='relu', input_shape=input_shape),
        tf.keras.layers.MaxPooling2D(2, 2),
        tf.keras.layers.Conv2D(64, (3, 3), activation='relu'),
        tf.keras.layers.MaxPooling2D(2, 2),
        tf.keras.layers.Conv2D(128, (3, 3), activation='relu'),
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(256, activation='relu'),
        tf.keras.layers.Dropout(0.5),
        tf.keras.layers.Dense(128, activation='relu'),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(1, activation='sigmoid')  # Binary: match/no-match
    ])
    
    model.compile(
        optimizer='adam',
        loss='binary_crossentropy',
        metrics=['accuracy', 'precision', 'recall']
    )
    
    return model

def train_model():
    """Main training function"""
    # Load data from MongoDB export or JSON files
    processor = GestureDataProcessor(canvas_size=64)
    
    # For demo - create synthetic data
    # In production, load from your MongoDB database
    print("🔄 Generating training data...")
    X, y = generate_demo_data(processor, num_samples=1000)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"📊 Training samples: {len(X_train)}, Test samples: {len(X_test)}")
    
    # Create model
    model = create_cnn_model()
    model.summary()
    
    # Callbacks
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_accuracy',
            patience=10,
            restore_best_weights=True
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-6
        )
    ]
    
    # Train model
    print("🧠 Training CNN model...")
    history = model.fit(
        X_train, y_train,
        batch_size=32,
        epochs=50,
        validation_data=(X_test, y_test),
        callbacks=callbacks,
        verbose=1
    )
    
    # Evaluate
    test_loss, test_accuracy, test_precision, test_recall = model.evaluate(X_test, y_test)
    f1_score = 2 * (test_precision * test_recall) / (test_precision + test_recall)
    
    print(f"✅ Model Performance:")
    print(f"   Accuracy: {test_accuracy:.3f}")
    print(f"   Precision: {test_precision:.3f}")
    print(f"   Recall: {test_recall:.3f}")
    print(f"   F1-Score: {f1_score:.3f}")
    
    # Save model for TensorFlow.js
    os.makedirs('models', exist_ok=True)
    model.save('models/secuadr_cnn_model.h5')
    
    print("💾 Model saved to models/secuadr_cnn_model.h5")
    
    # Plot training history
    plot_training_history(history)
    
    return model

def generate_demo_data(processor, num_samples=1000):
    """Generate synthetic training data for demonstration"""
    X, y = [], []
    
    for i in range(num_samples):
        # Generate random gesture-like patterns
        if i % 2 == 0:
            # "Good" patterns - structured shapes
            points = generate_good_pattern()
            label = 1
        else:
            # "Bad" patterns - random scribbles
            points = generate_bad_pattern()
            label = 0
            
        image = processor.points_to_image(points)
        X.append(image)
        y.append(label)
    
    return np.array(X).reshape(-1, 64, 64, 1), np.array(y)

def generate_good_pattern():
    """Generate structured pattern (circle, square, etc.)"""
    import math
    points = []
    center_x, center_y = 150, 150
    radius = 50
    
    # Generate circle
    for i in range(32):
        angle = (i / 32) * 2 * math.pi
        x = center_x + radius * math.cos(angle)
        y = center_y + radius * math.sin(angle)
        points.append({'X': x, 'Y': y, 'ID': 1})
    
    return points

def generate_bad_pattern():
    """Generate random scribble pattern"""
    points = []
    for i in range(20):
        x = np.random.randint(50, 250)
        y = np.random.randint(50, 250)
        points.append({'X': x, 'Y': y, 'ID': 1})
    
    return points

def plot_training_history(history):
    """Plot training metrics"""
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))
    
    # Accuracy
    axes[0,0].plot(history.history['accuracy'], label='Training')
    axes[0,0].plot(history.history['val_accuracy'], label='Validation')
    axes[0,0].set_title('Model Accuracy')
    axes[0,0].legend()
    
    # Loss
    axes[0,1].plot(history.history['loss'], label='Training')
    axes[0,1].plot(history.history['val_loss'], label='Validation')
    axes[0,1].set_title('Model Loss')
    axes[0,1].legend()
    
    # Precision
    axes[1,0].plot(history.history['precision'], label='Training')
    axes[1,0].plot(history.history['val_precision'], label='Validation')
    axes[1,0].set_title('Model Precision')
    axes[1,0].legend()
    
    # Recall
    axes[1,1].plot(history.history['recall'], label='Training')
    axes[1,1].plot(history.history['val_recall'], label='Validation')
    axes[1,1].set_title('Model Recall')
    axes[1,1].legend()
    
    plt.tight_layout()
    plt.savefig('models/training_history.png', dpi=300, bbox_inches='tight')
    plt.show()

if __name__ == "__main__":
    print("🚀 Starting SecuADR CNN Training...")
    model = train_model()
    print("✅ Training complete!")
