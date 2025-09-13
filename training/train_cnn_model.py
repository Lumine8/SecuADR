import tensorflow as tf
import numpy as np
import os

def create_gesture_cnn():
    """Create CNN model for SecuADR gesture recognition"""
    model = tf.keras.Sequential([
        # Input layer for gesture images (224x224 grayscale)
        tf.keras.layers.Conv2D(32, (3, 3), activation='relu', input_shape=(224, 224, 1)),
        tf.keras.layers.MaxPooling2D((2, 2)),
        
        tf.keras.layers.Conv2D(64, (3, 3), activation='relu'),
        tf.keras.layers.MaxPooling2D((2, 2)),
        
        tf.keras.layers.Conv2D(128, (3, 3), activation='relu'),
        tf.keras.layers.MaxPooling2D((2, 2)),
        
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(128, activation='relu'),
        tf.keras.layers.Dropout(0.5),
        tf.keras.layers.Dense(64, activation='relu'),
        tf.keras.layers.Dense(1, activation='sigmoid')  # Binary: gesture match/no match
    ])
    
    model.compile(
        optimizer='adam',
        loss='binary_crossentropy',
        metrics=['accuracy']
    )
    
    return model

def create_sample_data():
    """Create sample training data for demonstration"""
    X_train = np.random.rand(1000, 224, 224, 1)  # 1000 samples
    y_train = np.random.randint(0, 2, (1000, 1))  # Binary labels
    
    X_val = np.random.rand(200, 224, 224, 1)     # 200 validation samples
    y_val = np.random.randint(0, 2, (200, 1))
    
    return (X_train, y_train), (X_val, y_val)

if __name__ == "__main__":
    print("🚀 Training SecuADR CNN Model...")
    
    # Create model
    model = create_gesture_cnn()
    print("📊 Model Architecture:")
    model.summary()
    
    # Create sample data
    (X_train, y_train), (X_val, y_val) = create_sample_data()
    
    print("🎯 Training model...")
    history = model.fit(
        X_train, y_train,
        epochs=5,  # Quick training for demo
        batch_size=32,
        validation_data=(X_val, y_val),
        verbose=1
    )
    
    # Create models directory
    os.makedirs('models/secuadr-cnn', exist_ok=True)
    
    # Save the trained model
    model.save('models/secuadr-cnn/secuadr_cnn_model.h5')
    print("✅ Model saved to models/secuadr-cnn/secuadr_cnn_model.h5")
    
    # Evaluate model
    val_loss, val_accuracy = model.evaluate(X_val, y_val, verbose=0)
    print(f"🎯 Validation Accuracy: {val_accuracy:.4f}")
