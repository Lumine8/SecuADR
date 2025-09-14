import json
import numpy as np
from datetime import datetime
import os

class GestureDataCollector:
    def __init__(self):
        self.data_dir = "training_data"
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
    
    def save_gesture_pattern(self, username, pattern_points, metadata=None):
        """Save a single gesture pattern for training"""
        
        timestamp = datetime.now().isoformat()
        
        gesture_data = {
            "username": username,
            "pattern": pattern_points,
            "timestamp": timestamp,
            "metadata": metadata or {}
        }
        
        # Create user-specific file
        filename = f"{self.data_dir}/{username}_patterns.jsonl"
        
        # Append to file (JSONL format - one JSON object per line)
        with open(filename, 'a') as f:
            f.write(json.dumps(gesture_data) + '\n')
        
        print(f"✅ Saved pattern for {username}")
    
    def load_all_patterns(self):
        """Load all collected patterns for training"""
        all_patterns = []
        
        if not os.path.exists(self.data_dir):
            print("⚠️ No training data directory found")
            return all_patterns
            
        files = [f for f in os.listdir(self.data_dir) if f.endswith('_patterns.jsonl')]
        
        if not files:
            print("⚠️ No pattern files found")
            return all_patterns
        
        for filename in files:
            filepath = os.path.join(self.data_dir, filename)
            
            try:
                with open(filepath, 'r') as f:
                    for line in f:
                        if line.strip():
                            pattern_data = json.loads(line)
                            all_patterns.append(pattern_data)
            except Exception as e:
                print(f"❌ Error reading {filename}: {e}")
        
        print(f"📊 Loaded {len(all_patterns)} patterns from {len(files)} users")
        return all_patterns
    
    def get_user_stats(self):
        """Get statistics about collected data"""
        patterns = self.load_all_patterns()
        
        if not patterns:
            print("📊 No patterns found. Start collecting data first!")
            return {}
        
        user_counts = {}
        for pattern in patterns:
            username = pattern['username']
            user_counts[username] = user_counts.get(username, 0) + 1
        
        print("👥 User Statistics:")
        for user, count in user_counts.items():
            print(f"   {user}: {count} patterns")
        
        return user_counts

# Example usage and testing
if __name__ == "__main__":
    collector = GestureDataCollector()
    
    # Example: simulate saving patterns
    sample_patterns = [
        {
            "username": "testuser1",
            "pattern": [
                {"X": 100, "Y": 150, "ID": 0},
                {"X": 105, "Y": 155, "ID": 1},
                {"X": 110, "Y": 160, "ID": 2}
            ]
        },
        {
            "username": "testuser2", 
            "pattern": [
                {"X": 200, "Y": 250, "ID": 0},
                {"X": 210, "Y": 260, "ID": 1}, 
                {"X": 220, "Y": 270, "ID": 2}
            ]
        }
    ]
    
    print("🚀 Testing data collection...")
    
    for pattern_data in sample_patterns:
        collector.save_gesture_pattern(
            pattern_data["username"], 
            pattern_data["pattern"]
        )
    
    print("\n📊 Current statistics:")
    collector.get_user_stats()
    
    print("\n✅ Data collection test completed!")
