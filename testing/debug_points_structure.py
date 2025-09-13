import json
from pymongo import MongoClient
from bson import ObjectId

mongo_uri = "mongodb+srv://sankargopan1_db_user:9dYtGGBGggwY1qkx@secuadr-cluster.j3ao9cx.mongodb.net/patternLogin?retryWrites=true&w=majority"

def debug_pattern_structure():
    client = MongoClient(mongo_uri)
    db = client.patternLogin
    
    print("🔍 Debugging pattern structure for user 'lucid'...")
    
    # Get user records
    user_records = list(db.patterns.find({'username': 'lucid'}))
    
    for i, user_record in enumerate(user_records):
        print(f"\n📋 User record {i+1}:")
        patterns_array = user_record.get('patterns', [])
        print(f"  - Contains {len(patterns_array)} patterns")
        
        # Check each pattern in detail
        for j, pattern in enumerate(patterns_array):
            points = pattern.get('points', [])
            print(f"  - Pattern {j+1}: {len(points)} points")
            
            # Show pattern structure
            print(f"    - Pattern keys: {list(pattern.keys())}")
            
            # If points exist, show sample
            if points:
                print(f"    - First point: {points}")
                print(f"    - Last point: {points[-1]}")
            else:
                print(f"    - Points array is empty or missing")
                # Look for alternative field names
                for key, value in pattern.items():
                    if isinstance(value, list) and len(value) > 0:
                        print(f"    - Alternative array field '{key}': {len(value)} items")
                        if isinstance(value, dict) and any(coord in value for coord in ['x', 'y', 'X', 'Y']):
                            print(f"      - Contains coordinate-like data: {value}")
    
    # Also check for patterns with non-empty points
    print(f"\n🔍 Searching for patterns with non-empty points arrays...")
    patterns_with_points = list(db.patterns.find({
        'username': 'lucid',
        'patterns.points': {'$exists': True, '$not': {'$size': 0}}
    }))
    
    print(f"Found {len(patterns_with_points)} records with non-empty points")
    
    client.close()

if __name__ == '__main__':
    debug_pattern_structure()
