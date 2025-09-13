import os
import json
import numpy as np
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MongoSafeJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder that safely handles MongoDB ObjectIds and datetime objects"""
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

class GestureDataExtractor:
    """Fixed gesture data extractor for SecuADR CNN training - reads from 'data' field"""
    
    def __init__(self, mongo_uri):
        self.mongo_uri = mongo_uri
        self.client = None
        self.db = None
        self.features = []
        self.labels = []
        self.raw_patterns = []
        
    def connect_to_database(self):
        """Establish connection to MongoDB"""
        try:
            self.client = MongoClient(self.mongo_uri)
            self.db = self.client.patternLogin
            # Test connection
            self.client.admin.command('ping')
            logger.info("✅ Connected to MongoDB Atlas")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to connect to MongoDB: {e}")
            return False
    
    def clean_data(self, data):
        """Recursively clean data to remove non-JSON serializable objects"""
        if isinstance(data, dict):
            cleaned = {}
            for key, value in data.items():
                if key == '_id' and isinstance(value, ObjectId):
                    cleaned[key] = str(value)
                else:
                    cleaned[key] = self.clean_data(value)
            return cleaned
        elif isinstance(data, list):
            return [self.clean_data(item) for item in data]
        elif isinstance(data, ObjectId):
            return str(data)
        elif isinstance(data, datetime):
            return data.isoformat()
        elif isinstance(data, (np.integer, np.int64)):
            return int(data)
        elif isinstance(data, (np.floating, np.float64)):
            return float(data)
        elif isinstance(data, np.ndarray):
            return data.tolist()
        else:
            return data
    
    def extract_pattern_features(self, points_array):
        """Extract features from gesture points array (FIXED to handle X,Y coordinates)"""
        try:
            if not points_array or len(points_array) < 2:
                return None
            
            # Extract X, Y coordinates from the points
            x_coords = [p.get('X', 0) for p in points_array]
            y_coords = [p.get('Y', 0) for p in points_array]
            
            # Normalize coordinates
            if len(x_coords) > 1 and len(y_coords) > 1:
                x_min, x_max = min(x_coords), max(x_coords)
                y_min, y_max = min(y_coords), max(y_coords)
                
                # Avoid division by zero
                x_range = x_max - x_min if x_max != x_min else 1
                y_range = y_max - y_min if y_max != y_min else 1
                
                # Normalize to [0, 1]
                norm_x = [(x - x_min) / x_range for x in x_coords]
                norm_y = [(y - y_min) / y_range for y in y_coords]
                
                # Fixed-length feature vector (pad/truncate to 64 points)
                target_length = 64
                features = []
                
                # Resample points to fixed length
                for i in range(target_length):
                    if len(norm_x) > 1:
                        idx = int(i * (len(norm_x) - 1) / (target_length - 1))
                    else:
                        idx = 0
                    features.extend([norm_x[idx], norm_y[idx]])
                
                return features
            
            return None
        except Exception as e:
            logger.warning(f"Failed to extract features: {e}")
            return None
    
    def generate_negative_samples(self, positive_features):
        """Generate negative samples by perturbing positive samples"""
        negative_samples = []
        
        for features in positive_features:
            # Add noise to create negative samples
            noise_scale = 0.3
            noisy_features = []
            
            for i in range(0, len(features), 2):  # Process x,y pairs
                x, y = features[i], features[i+1]
                
                # Add random noise
                noise_x = np.random.normal(0, noise_scale)
                noise_y = np.random.normal(0, noise_scale)
                
                noisy_x = max(0, min(1, x + noise_x))  # Clamp to [0,1]
                noisy_y = max(0, min(1, y + noise_y))  # Clamp to [0,1]
                
                noisy_features.extend([noisy_x, noisy_y])
            
            negative_samples.append(noisy_features)
        
        return negative_samples
    
    def process_user_patterns(self, username):
        """Process patterns for a specific user - FIXED to read from 'data' field"""
        try:
            # Get user records from database
            user_records = list(self.db.patterns.find({'username': username}))
            
            if not user_records:
                logger.warning(f"No user records found for user: {username}")
                return
            
            total_patterns_processed = 0
            positive_features = []
            
            # Process each user record
            for user_record in user_records:
                # Get the patterns array from the user record
                patterns_array = user_record.get('patterns', [])
                
                logger.info(f"📊 Processing {len(patterns_array)} patterns for user: {username}")
                
                # Process each pattern in the patterns array
                for i, pattern in enumerate(patterns_array):
                    # FIXED: Read from 'data' field instead of 'points'
                    data_array = pattern.get('data', [])
                    
                    if not data_array:
                        logger.warning(f"❌ No data array found in pattern {i+1}")
                        continue
                    
                    logger.info(f"🔄 Processing pattern {i+1} with {len(data_array)} data items")
                    
                    # Extract coordinate points from data array
                    points = []
                    for data_item in data_array:
                        if isinstance(data_item, dict) and 'X' in data_item and 'Y' in data_item:
                            points.append({
                                'X': data_item['X'],
                                'Y': data_item['Y']
                            })
                    
                    if len(points) < 2:
                        logger.warning(f"❌ Insufficient coordinate points in pattern {i+1}: {len(points)}")
                        continue
                    
                    logger.info(f"📍 Extracted {len(points)} coordinate points from pattern {i+1}")
                    
                    # Extract features from the coordinate points
                    features = self.extract_pattern_features(points)
                    if features:
                        positive_features.append(features)
                        total_patterns_processed += 1
                        # Store raw pattern for reference
                        self.raw_patterns.append(self.clean_data(pattern))
                        logger.info(f"✅ Extracted {len(features)} features from pattern {i+1}")
                    else:
                        logger.warning(f"❌ Failed to extract features from pattern {i+1}")
            
            if not positive_features:
                logger.error(f"❌ No valid features extracted from any patterns for {username}")
                return
            
            # Generate negative samples
            negative_features = self.generate_negative_samples(positive_features)
            
            # Combine positive and negative samples
            all_features = positive_features + negative_features
            all_labels = [1] * len(positive_features) + [0] * len(negative_features)
            
            # Add to overall dataset
            self.features.extend(all_features)
            self.labels.extend(all_labels)
            
            logger.info(f"📈 Successfully extracted {len(all_features)} samples "
                       f"({len(positive_features)} positive, {len(negative_features)} negative)")
                       
        except Exception as e:
            logger.error(f"Error processing patterns for {username}: {e}")
    
    def save_training_data(self, output_path='dataset/training_data.json'):
        """Save processed training data to JSON file"""
        try:
            dataset = {
                'metadata': {
                    'total_samples': len(self.features),
                    'positive_samples': sum(self.labels),
                    'negative_samples': len(self.labels) - sum(self.labels),
                    'feature_dimension': len(self.features[0]) if self.features else 0,
                    'created_at': datetime.now().isoformat(),
                    'version': '2.1',
                    'description': 'SecuADR CNN training dataset - reads from data field'
                },
                'features': self.clean_data(self.features),
                'labels': self.clean_data(self.labels),
                'raw_patterns': self.clean_data(self.raw_patterns[:3])  # Store sample patterns
            }
            
            # Ensure output directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Save with custom encoder
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(dataset, f, indent=2, cls=MongoSafeJSONEncoder, ensure_ascii=False)
            
            logger.info(f"✅ Saved {len(self.features)} samples to {output_path}")
            
            # Also save in numpy format for faster loading
            np_path = output_path.replace('.json', '_numpy.npz')
            np.savez_compressed(np_path, 
                              features=np.array(self.features, dtype=np.float32),
                              labels=np.array(self.labels, dtype=np.int32))
            
            logger.info(f"✅ Saved numpy arrays to {np_path}")
            
        except Exception as e:
            logger.error(f"❌ Failed to save training data: {e}")
            raise
    
    def validate_dataset(self):
        """Validate the extracted dataset"""
        if not self.features or not self.labels:
            raise ValueError("No training data extracted")
            
        if len(self.features) != len(self.labels):
            raise ValueError("Features and labels length mismatch")
            
        # Check feature dimensions
        feature_dims = [len(f) for f in self.features]
        if len(set(feature_dims)) > 1:
            raise ValueError("Inconsistent feature dimensions")
            
        positive_ratio = sum(self.labels) / len(self.labels)
        if positive_ratio < 0.3 or positive_ratio > 0.7:
            logger.warning(f"Imbalanced dataset: {positive_ratio:.2%} positive samples")
            
        logger.info(f"✅ Dataset validation passed: {len(self.features)} samples, "
                   f"{feature_dims[0]} features each")
    
    def close_connection(self):
        """Close database connection"""
        if self.client:
            self.client.close()
            logger.info("📊 Database connection closed")

def main():
    """Main execution function"""
    # MongoDB connection string
    mongo_uri = "mongodb+srv://sankargopan1_db_user:9dYtGGBGggwY1qkx@secuadr-cluster.j3ao9cx.mongodb.net/patternLogin?retryWrites=true&w=majority"
    
    # Initialize extractor
    extractor = GestureDataExtractor(mongo_uri)
    
    try:
        # Connect to database
        if not extractor.connect_to_database():
            return
        
        # Process patterns for user 'lucid'
        extractor.process_user_patterns('lucid')
        
        # Validate dataset
        extractor.validate_dataset()
        
        # Save training data
        extractor.save_training_data()
        
        logger.info("🎉 Data processing completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Data processing failed: {e}")
        raise
    finally:
        extractor.close_connection()

if __name__ == '__main__':
    main()
