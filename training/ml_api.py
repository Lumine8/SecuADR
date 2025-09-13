import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global model variable
model = None

def load_model():
    """Load the trained CNN model with detailed error reporting"""
    global model
    try:
        model_path = 'models/secuadr-cnn/secuadr_cnn_model.h5'
        
        if not os.path.exists(model_path):
            logger.error(f"❌ Model file not found at: {model_path}")
            logger.info("📁 Available files in models/secuadr-cnn/:")
            if os.path.exists('models/secuadr-cnn/'):
                for file in os.listdir('models/secuadr-cnn/'):
                    logger.info(f"  - {file}")
            else:
                logger.error("❌ Models directory does not exist")
            return False
        
        logger.info(f"🔄 Loading model from: {model_path}")
        
        # Import TensorFlow here to catch any import errors
        import tensorflow as tf
        model = tf.keras.models.load_model(model_path)
        
        logger.info("✅ CNN model loaded successfully")
        logger.info(f"📊 Model input shape: {model.input_shape}")
        logger.info(f"📊 Model output shape: {model.output_shape}")
        return True
        
    except ImportError as e:
        logger.error(f"❌ TensorFlow import error: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Failed to load model: {e}")
        import traceback
        traceback.print_exc()
        return False

def preprocess_gesture_data(gesture_data):
    """Preprocess gesture data for CNN input"""
    try:
        if isinstance(gesture_data, list):
            # Convert to numpy array and ensure correct shape
            data_array = np.array(gesture_data, dtype=np.float32)
            
            # Ensure we have 128 features (64 points * 2 coordinates)
            expected_size = 128
            if len(data_array) < expected_size:
                # Pad with zeros
                data_array = np.pad(data_array, (0, expected_size - len(data_array)))
            elif len(data_array) > expected_size:
                # Truncate
                data_array = data_array[:expected_size]
            
            # Reshape for model input (1, 128)
            return data_array.reshape(1, -1)
        else:
            raise ValueError("Gesture data must be a list")
    except Exception as e:
        logger.error(f"Preprocessing error: {e}")
        return None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'service': 'SecuADR ML Service',
        'version': '1.0'
    })

@app.route('/predict', methods=['POST'])
def predict_gesture():
    """Main prediction endpoint"""
    try:
        data = request.json
        gesture_data = data.get('gestureData') or data.get('gesture_data')
        
        if not gesture_data:
            return jsonify({'error': 'No gesture data provided'}), 400

        logger.info(f"🔄 Received prediction request with {len(gesture_data)} data points")

        # Preprocess input
        processed_input = preprocess_gesture_data(gesture_data)
        
        if processed_input is None:
            return jsonify({'error': 'Failed to preprocess gesture data'}), 400

        if model:
            # Real CNN prediction
            prediction = model.predict(processed_input, verbose=0)
            confidence = float(prediction[0][0])
            logger.info(f"🎯 CNN prediction: {confidence:.4f}")
        else:
            # Mock prediction with realistic variance
            base_confidence = 0.75
            variance = np.random.uniform(-0.1, 0.2)
            confidence = max(0.0, min(1.0, base_confidence + variance))
            logger.info(f"🎲 Mock prediction: {confidence:.4f}")

        result = {
            'success': True,
            'confidence': confidence,
            'prediction': 'gesture_matched' if confidence > 0.6 else 'gesture_rejected',
            'model': 'SecuADR_CNN_v3' if model else 'SecuADR_Mock_CNN',
            'timestamp': int(np.datetime64('now').astype('datetime64[ms]').astype(int))
        }
        
        return jsonify(result)

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'CNN prediction failed'
        }), 500

if __name__ == '__main__':
    print("🚀 Starting SecuADR ML Microservice...")
    
    # Try to load model
    model_loaded = load_model()
    
    if model_loaded:
        print("✅ CNN model loaded successfully")
        print("🧠 Model status: Loaded")
    else:
        print("⚠️ Model file not found, using mock predictions")
        print("🧠 Model status: Mock mode")
    
    print("🌐 Starting Flask server on http://0.0.0.0:5001")
    
    try:
        app.run(host='0.0.0.0', port=5001, debug=False)
    except Exception as e:
        print(f"❌ Failed to start Flask server: {e}")
        sys.exit(1)
