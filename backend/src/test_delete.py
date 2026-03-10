from app.core import database as db
import os

# Set DATABASE_URL if not set
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5432/growth"

def test_delete():
    # List businesses
    businesses = db.list_user_businesses("default_user")
    if not businesses:
        businesses = db.list_user_businesses("joao@example.com") # another guess
        
    if not businesses:
        print("No businesses found for default_user or joao@example.com")
        # Try to find ANY business
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, user_id, name FROM businesses WHERE status = 'active' LIMIT 1")
        row = cursor.fetchone()
        conn.close()
        if row:
            print(f"Found business: {row[0]} for user: {row[1]}")
            biz_id = row[0]
        else:
            print("No active businesses found in DB")
            return
    else:
        biz_id = businesses[0]['id']
        print(f"Testing delete for business: {biz_id}")

    success = db.delete_business(biz_id)
    print(f"Soft delete success: {success}")
    
    # Check status
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT status FROM businesses WHERE id = %s", (biz_id,))
    status = cursor.fetchone()[0]
    conn.close()
    print(f"New status: {status}")

if __name__ == "__main__":
    try:
        test_delete()
    except Exception as e:
        print(f"Error: {e}")
