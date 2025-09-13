import tensorflow as tf
import numpy as np
import json
import os

def create_simple_cnn():
    """Create a simple neural network for gesture recognition - FIXED"""
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(128,)),  # Explicit input shape
        tf.keras.layers.Dense(128, activation='relu'),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(64, activation='relu'),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(32, activation='relu'),
        tf.keras.layers.Dense(1, activation='sigmoid')
    ])
    
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy']
    )
    
    return model

def load_training_data():
    """Load and validate training data"""
    try:
        # Try loading numpy format first
        if os.path.exists('dataset/training_data_numpy.npz'):
            with np.load('dataset/training_data_numpy.npz') as data:
                features = data['features']
                labels = data['labels']
        else:
            # Fallback to JSON format
            with open('dataset/training_data.json', 'r') as f:
                dataset = json.load(f)
            features = np.array(dataset['features'])
            labels = np.array(dataset['labels'])
        
        # Debug shapes
        print(f"📊 Original features shape: {features.shape}")
        print(f"📊 Original labels shape: {labels.shape}")
        
        # Ensure features are 2D
        if len(features.shape) == 1:
            features = features.reshape(1, -1)
        
        # Ensure labels are 1D
        if len(labels.shape) > 1 and labels.shape[1] == 1:
            labels = labels.reshape(-1)
        elif len(labels.shape) > 1:
            labels = labels.flatten()
        
        # Validate data
        if features.size == 0 or labels.size == 0:
            raise ValueError("Features or labels are empty")
        
        if len(features) != len(labels):
            raise ValueError(f"Feature count ({len(features)}) != Label count ({len(labels)})")
        
        print(f"✅ Final features shape: {features.shape}")
        print(f"✅ Final labels shape: {labels.shape}")
        print(f"📈 Sample count: {len(features)}")
        print(f"🎯 Unique labels: {np.unique(labels)}")
        
        return features, labels
        
    except Exception as e:
        print(f"❌ Error loading training data: {e}")
        raise

def main():
    print("🚀 Training Quick CNN Model for SecuADR...")
    
    try:
        # Load and validate training data
        features, labels = load_training_data()
        
        # Minimum sample check
        if len(features) < 2:
            print("❌ Not enough training samples. Need at least 2 samples.")
            return
        
        # Create model
        model = create_simple_cnn()
        print("✅ Model created successfully")
        
        # Train model
        print("🎯 Starting training...")
        history = model.fit(
            features, labels,
            epochs=20,
            batch_size=min(8, len(features)),  # Adjust batch size for small datasets
            validation_split=0.2 if len(features) > 5 else 0.0,  # Skip validation if too few samples
            verbose=1
        )
        
        # Save model
        os.makedirs('models/secuadr-cnn', exist_ok=True)
        model.save('models/secuadr-cnn/secuadr_cnn_model.h5')
        print("✅ Model saved to models/secuadr-cnn/secuadr_cnn_model.h5")
        
        # Evaluate final accuracy
        final_loss, final_accuracy = model.evaluate(features, labels, verbose=0)
        print(f"🎯 Final Training Accuracy: {final_accuracy:.4f}")
        
        # Test prediction
        print("🧪 Testing prediction...")
        sample_prediction = model.predict(features[:1])
        print(f"📊 Sample prediction: {sample_prediction[0][0]:.4f}")
        
        print("🎉 Training completed successfully!")
        
    except FileNotFoundError:
        print("❌ Training data not found!")
        print("Please run data_processor.py first to generate training data.")
    except Exception as e:
        print(f"❌ Training failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
