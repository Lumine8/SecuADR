import json
from pymongo import MongoClient
from bson import ObjectId

# Your MongoDB connection URI
mongo_uri = "mongodb+srv://sankargopan1_db_user:9dYtGGBGggwY1qkx@secuadr-cluster.j3ao9cx.mongodb.net/patternLogin?retryWrites=true&w=majority"

def test_mongodb_data():
    """Test MongoDB connection and data structure"""
    try:
        # Connect to MongoDB
        client = MongoClient(mongo_uri)
        db = client.patternLogin
        
        print("✅ Connected to MongoDB Atlas")
        
        # Test connection
        client.admin.command('ping')
        print("✅ Database connection verified")
        
        # Check available collections
        collections = db.list_collection_names()
        print(f"📊 Available collections: {collections}")
        
        # Query patterns for user 'lucid'
        patterns = list(db.patterns.find({'username': 'lucid'}))
        print(f"📊 Found {len(patterns)} patterns for 'lucid'")
        
        if patterns:
            print("\n📋 First pattern structure:")
            first_pattern = patterns[0]
            
            # Print pattern with ObjectId converted to string
            pattern_copy = {}
            for key, value in first_pattern.items():
                if isinstance(value, ObjectId):
                    pattern_copy[key] = str(value)
                else:
                    pattern_copy[key] = value
            
            print(json.dumps(pattern_copy, indent=2, default=str))
            
            # Check for 'points' field specifically
            if 'points' in first_pattern:
                points = first_pattern['points']
                print(f"\n✅ 'points' field found with {len(points)} points")
                
                if points and len(points) > 0:
                    print(f"📍 First point structure: {points[0]}")
                    print(f"📍 Last point structure: {points[-1]}")
                    
                    # Check if points have x, y coordinates
                    first_point = points[0]
                    if isinstance(first_point, dict):
                        if 'x' in first_point and 'y' in first_point:
                            print(f"✅ Points have x,y coordinates: x={first_point['x']}, y={first_point['y']}")
                        else:
                            print(f"❌ Points missing x,y coordinates. Available keys: {list(first_point.keys())}")
                    else:
                        print(f"❌ Point is not a dictionary: {type(first_point)}")
                else:
                    print("❌ Points array is empty")
            else:
                print("❌ No 'points' field found in pattern")
                print(f"📋 Available fields: {list(first_pattern.keys())}")
                
                # Check for alternative field names
                possible_fields = ['gesturePoints', 'pattern', 'coordinates', 'data']
                for field in possible_fields:
                    if field in first_pattern:
                        print(f"✅ Found alternative field: '{field}'")
                        alt_data = first_pattern[field]
                        if isinstance(alt_data, list):
                            print(f"📊 '{field}' contains {len(alt_data)} items")
                        elif isinstance(alt_data, dict):
                            print(f"📊 '{field}' is a dict with keys: {list(alt_data.keys())}")
        else:
            print("❌ No patterns found for user 'lucid'")
            
            # Try to find patterns for any user
            all_patterns = list(db.patterns.find().limit(5))
            print(f"\n🔍 Found {len(all_patterns)} total patterns in database")
            
            if all_patterns:
                # Show available usernames
                usernames = db.patterns.distinct('username')
                print(f"📊 Available usernames: {usernames}")
                
                print("\n📋 Sample pattern from database:")
                sample_pattern = all_patterns[0]
                sample_copy = {}
                for key, value in sample_pattern.items():
                    if isinstance(value, ObjectId):
                        sample_copy[key] = str(value)
                    else:
                        sample_copy[key] = value
                print(json.dumps(sample_copy, indent=2, default=str))
            else:
                print("❌ No patterns found in database at all")
        
        client.close()
        print("\n📊 Database connection closed")
        
    except Exception as e:
        print(f"❌ Error testing MongoDB: {e}")

if __name__ == '__main__':
    test_mongodb_data()
