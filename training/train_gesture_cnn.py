import tensorflow as tf
import numpy as np
import json
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import tf2onnx

# Import with error handling
try:
    from data_collection import GestureDataCollector # type: ignore
except ImportError:
    print("❌ data_collection.py not found. Creating it...")
    # Create a minimal version
    class GestureDataCollector:
        def __init__(self):
            pass
        def load_all_patterns(self):
            return []

class GestureCNNTrainer:
    def __init__(self, max_points=100):
        self.max_points = max_points
        self.model = None
        self.label_encoder = LabelEncoder()
        self.collector = GestureDataCollector()
    
    def preprocess_gesture_data(self, gesture_points):
        """Preprocess gesture coordinate data"""
        if len(gesture_points) == 0:
            return np.zeros((self.max_points, 2))
        
        points = np.array([[p.get('X', 0), p.get('Y', 0)] for p in gesture_points])
        
        # Normalize to 0-1 range
        if points.max() > points.min():
            points = (points - points.min()) / (points.max() - points.min())
        
        # Pad or truncate to fixed length
        if len(points) > self.max_points:
            points = points[:self.max_points]
        else:
            padding = np.zeros((self.max_points - len(points), 2))
            points = np.vstack([points, padding])
        
        return points
    
    def create_cnn_model(self, input_shape, num_classes):
        """Create CNN model for gesture recognition"""
        model = tf.keras.Sequential([
            # Input layer
            tf.keras.layers.Input(shape=input_shape),
            
            # Reshape for CNN processing
            tf.keras.layers.Reshape((input_shape[0], input_shape[1], 1)),
            
            # First convolutional block
            tf.keras.layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.MaxPooling2D((2, 2)),
            tf.keras.layers.Dropout(0.25),
            
            # Second convolutional block
            tf.keras.layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.MaxPooling2D((2, 2)),
            tf.keras.layers.Dropout(0.25),
            
            # Third convolutional block
            tf.keras.layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.GlobalAveragePooling2D(),
            tf.keras.layers.Dropout(0.5),
            
            # Dense layers
            tf.keras.layers.Dense(128, activation='relu'),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.Dropout(0.5),
            
            # Output layer
            tf.keras.layers.Dense(num_classes, activation='softmax')
        ])
        
        return model
    
    def prepare_data(self):
        """Load and prepare training data"""
        print("📊 Loading training data...")
        
        training_data = self.collector.load_all_patterns()
        
        if len(training_data) < 10:
            print(f"❌ Need at least 10 gesture patterns to train.")
            print(f"   Currently have: {len(training_data)} patterns")
            print("\n💡 To collect data:")
            print("   1. Run: python data_collection.py")
            print("   2. Or use your SecuADR web app to collect patterns")
            print("   3. Export patterns from MongoDB if you have existing data")
            raise ValueError("Insufficient training data")
        
        X = []
        y = []
        
        for data in training_data:
            try:
                processed_pattern = self.preprocess_gesture_data(data['pattern'])
                X.append(processed_pattern)
                y.append(data['username'])
            except Exception as e:
                print(f"⚠️ Skipping invalid pattern: {e}")
                continue
        
        if len(X) == 0:
            raise ValueError("No valid patterns found")
        
        X = np.array(X)
        y = self.label_encoder.fit_transform(y)
        
        print(f"✅ Prepared {len(X)} samples from {len(self.label_encoder.classes_)} users")
        print(f"   Users: {list(self.label_encoder.classes_)}")
        return X, y
    
    def train(self, epochs=50, batch_size=32, validation_split=0.2):
        """Train the CNN model"""
        print("🚀 Starting CNN training...")
        
        try:
            # Prepare data
            X, y = self.prepare_data()
        except ValueError as e:
            print(f"❌ Training failed: {e}")
            return None
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=validation_split, random_state=42, stratify=y
        )
        
        # Create model
        self.model = self.create_cnn_model(
            input_shape=(X.shape[1], X.shape[2]), 
            num_classes=len(self.label_encoder.classes_)
        )
        
        # Compile model
        self.model.compile(
            optimizer='adam',
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        
        print(f"🏗️ Model architecture:")
        self.model.summary()
        
        # Train model
        history = self.model.fit(
            X_train, y_train,
            batch_size=batch_size,
            epochs=epochs,
            validation_data=(X_test, y_test),
            callbacks=[
                tf.keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
                tf.keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5),
            ],
            verbose=1
        )
        
        # Evaluate
        test_loss, test_accuracy = self.model.evaluate(X_test, y_test, verbose=0)
        print(f"🎯 Final Test Accuracy: {test_accuracy:.3f}")
        
        return history
    
    def export_to_onnx(self):
        """Export trained model to ONNX format"""
        if self.model is None:
            raise ValueError("❌ No model to export. Train the model first.")
        
        print("📦 Exporting to ONNX format...")
        
        # Create models directory in server
        models_dir = "../server/models"
        if not os.path.exists(models_dir):
            os.makedirs(models_dir)
        
        try:
            # Convert to ONNX
            onnx_model, _ = tf2onnx.convert.from_keras(self.model)
            
            # Save ONNX model
            onnx_path = os.path.join(models_dir, "gesture_cnn.onnx")
            with open(onnx_path, 'wb') as f:
                f.write(onnx_model.SerializeToString())
            
            # Save label encoder
            import pickle
            encoder_path = os.path.join(models_dir, "label_encoder.pkl")
            with open(encoder_path, 'wb') as f:
                pickle.dump(self.label_encoder, f)
            
            print(f"✅ ONNX model saved to: {onnx_path}")
            print(f"✅ Label encoder saved to: {encoder_path}")
            print("🎉 Model ready for SecuADR server!")
        
        except Exception as e:
            print(f"❌ ONNX export failed: {e}")
            print("💡 Try installing: pip install tf2onnx")

def main():
    """Main training pipeline"""
    trainer = GestureCNNTrainer()
    
    try:
        print("🔍 Checking for training data...")
        
        # Check if we have data
        data = trainer.collector.load_all_patterns()
        if len(data) < 10:
            print("\n❌ Insufficient training data!")
            print("\n💡 Next steps:")
            print("   1. Create sample data: python data_collection.py")
            print("   2. Or collect real data using your SecuADR web app")
            print("   3. Then run this script again")
            return
        
        # Train the model
        history = trainer.train(epochs=50, batch_size=16)
        
        if history is not None:
            # Export to ONNX
            trainer.export_to_onnx()
            
            print("\n🎉 Training completed successfully!")
            print("🚀 Restart your SecuADR server to use the new CNN model")
        
    except Exception as e:
        print(f"❌ Training failed: {str(e)}")
        print("💡 Make sure you have collected enough gesture data first")

if __name__ == "__main__":
    main()
