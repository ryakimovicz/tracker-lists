import sqlite3

def migrate():
    conn = sqlite3.connect("tracker_lists.db")
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN is_pro BOOLEAN DEFAULT 0 NOT NULL")
        print("Added is_pro column.")
    except sqlite3.OperationalError as e:
        print(f"is_pro might already exist: {e}")
        
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN profile_color VARCHAR(20)")
        print("Added profile_color column.")
    except sqlite3.OperationalError as e:
        print(f"profile_color might already exist: {e}")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
