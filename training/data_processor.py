
import numpy as np
import json
from pymongo import MongoClient
import os
from dotenv import load_dotenv

class MongoDataExtractor:
    def __init__(self):
        load_dotenv('../server/.env')
        self.mongo_uri = os.getenv('MONGO_URI')
        self.client = None

    def connect(self):
        """Connect to MongoDB Atlas"""
        try:
            self.client = MongoClient(self.mongo_uri)
            print("✅ Connected to MongoDB Atlas")
            return True
        except Exception as e:
            print(f"❌ Failed to connect to MongoDB: {e}")
            return False

    def extract_training_data(self, min_samples_per_user=3):
        """Extract training data from SecuADR patterns collection"""
        if not self.client:
            if not self.connect():
                return [], []

        db = self.client.get_database()  # Uses database from connection string
        patterns_collection = db.patterns

        training_data = []
        labels = []

        # Get all users with sufficient pattern samples
        users = patterns_collection.find({
            "$expr": {"$gte": [{"$size": "$patterns"}, min_samples_per_user]}
        })

        for user in users:
            user_patterns = user['patterns']
            username = user['username']

            print(f"📊 Processing {len(user_patterns)} patterns for user: {username}")

            # Create positive samples (correct patterns for this user)
            for i, pattern in enumerate(user_patterns):
                training_data.append({
                    'points': pattern['data'],
                    'username': username,
                    'pattern_id': i,
                    'metadata': pattern.get('trainingMetadata', {})
                })
                labels.append(1)  # Positive sample

                # Create negative samples (this pattern vs other users)
                other_users = patterns_collection.find({
                    'username': {'$ne': username}
                }).limit(2)  # Limit negative samples

                for other_user in other_users:
                    if other_user['patterns']:
                        training_data.append({
                            'points': pattern['data'],
                            'username': other_user['username'],  # Wrong user
                            'pattern_id': i,
                            'metadata': pattern.get('trainingMetadata', {})
                        })
                        labels.append(0)  # Negative sample

        print(f"📈 Extracted {len(training_data)} samples ({sum(labels)} positive, {len(labels) - sum(labels)} negative)")

        return training_data, labels

    def save_training_data(self, filename='training_data.json'):
        """Save extracted data to JSON file"""
        data, labels = self.extract_training_data()

        import datetime
        dataset = {
            'data': data,
            'labels': labels,
            'metadata': {
                'total_samples': len(data),
                'positive_samples': sum(labels),
                'negative_samples': len(labels) - sum(labels),
                'created_at': str(datetime.datetime.now())
            }
        }

        with open(filename, 'w') as f:
            json.dump(dataset, f, indent=2)

        print(f"💾 Training data saved to {filename}")
        return filename


if __name__ == "__main__":
    extractor = MongoDataExtractor()
    extractor.save_training_data()
