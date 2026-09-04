import sqlite3

def migrate():
    conn = sqlite3.connect("tracker_lists.db")
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN category_order VARCHAR(200)")
        print("Added category_order column.")
    except sqlite3.OperationalError as e:
        print(f"category_order might already exist: {e}")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
