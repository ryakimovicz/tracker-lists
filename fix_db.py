from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    db.execute(text("UPDATE list_items SET external_id = REPLACE(external_id, 'tmdb-ep-', 'tvm-ep-') WHERE external_id LIKE 'tmdb-ep-%'"))
    db.execute(text("UPDATE user_library_items SET external_id = REPLACE(external_id, 'tmdb-ep-', 'tvm-ep-') WHERE external_id LIKE 'tmdb-ep-%'"))
    # Also for loose episodes that got incorrectly classified as series, we should fix their item_type to 'episode'
    db.execute(text("UPDATE user_library_items SET item_type = 'episode' WHERE external_id LIKE 'tvm-ep-%' AND item_type = 'series'"))
    db.execute(text("UPDATE item_progress SET external_id = REPLACE(external_id, 'tmdb-ep-', 'tvm-ep-') WHERE external_id LIKE 'tmdb-ep-%'"))
    db.execute(text("UPDATE item_progress SET item_type = 'episode' WHERE external_id LIKE 'tvm-ep-%' AND item_type = 'series'"))
    db.execute(text("UPDATE consumption_history SET external_id = REPLACE(external_id, 'tmdb-ep-', 'tvm-ep-') WHERE external_id LIKE 'tmdb-ep-%'"))
    db.execute(text("UPDATE user_activity_logs SET external_id = REPLACE(external_id, 'tmdb-ep-', 'tvm-ep-') WHERE external_id LIKE 'tmdb-ep-%'"))
    db.commit()
    print('DB updated successfully')
except Exception as e:
    db.rollback()
    print(f'Error: {e}')
finally:
    db.close()
