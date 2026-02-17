import requests
import json

BASE_URL = "http://localhost:5000/api/auth/login"

def test_login(email, password, description):
    print(f"Testing: {description}")
    payload = {
        "email": email,
        "password": password
    }
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(BASE_URL, json=payload, headers=headers)
        print(f"Status Code: {response.status_code}")
        try:
            print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        except:
            print(f"Response Text: {response.text}")
        print("-" * 30)
    except Exception as e:
        print(f"Error: {e}")
        print("-" * 30)

# 1. Test Invalid Email
test_login("nonexistent@example.com", "password123", "Invalid Email")

# 2. Test Invalid Password (need a valid user first, let's try to find one or assume one exists)
# If we don't know a valid user, we might only see the "Invalid Email" case. 
# But let's try a potentially valid email if we saw one in the file, or just rely on the first test to confirm the "Invalid email" message change.
# I will try to use 'admin@example.com' as a guess, or I can check the seed file if available.
# Actually, I can just create a test user first if needed, but for now let's see if the first test works.

