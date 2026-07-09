import sys
import os
from datetime import datetime, timezone

# Append the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.list_item import ListItem, ItemTypeEnum
from app.models.item_progress import ItemProgress

def run_tests():
    # Use in-memory SQLite database
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    try:
        print("=== Test 1: User Registration ===")
        user = User(username="coro", email="coro@example.com", hashed_password="hashed")
        db.add(user)
        db.commit()
        db.refresh(user)
        
        print("\n=== Test 2: Creating List A and List B ===")
        list_a = ReadingList(creator_id=user.id, title="Batman Arc A", visibility=VisibilityEnum.PUBLIC)
        list_b = ReadingList(creator_id=user.id, title="Batman Arc B", visibility=VisibilityEnum.PUBLIC)
        db.add_all([list_a, list_b])
        db.commit()
        db.refresh(list_a)
        db.refresh(list_b)
        
        # Add identical comic to both lists
        comic_a = ListItem(list_id=list_a.id, order_index=1, item_type=ItemTypeEnum.COMIC, external_id="cv-100", title="Batman #404")
        comic_b = ListItem(list_id=list_b.id, order_index=1, item_type=ItemTypeEnum.COMIC, external_id="cv-100", title="Batman #404")
        
        # Add custom items to both lists
        custom_a = ListItem(list_id=list_a.id, order_index=2, item_type=ItemTypeEnum.CUSTOM, external_id=None, title="Read introduction")
        custom_b = ListItem(list_id=list_b.id, order_index=2, item_type=ItemTypeEnum.CUSTOM, external_id=None, title="Read introduction")
        
        db.add_all([comic_a, comic_b, custom_a, custom_b])
        db.commit()
        db.refresh(comic_a)
        db.refresh(comic_b)
        db.refresh(custom_a)
        db.refresh(custom_b)
        
        print("Lists created successfully with overlapping comic and distinct custom items.")
        
        print("\n=== Test 3: Toggling progress (Comic Vine Item) on List A ===")
        # Mark comic_a as completed
        progress_comic = ItemProgress(
            user_id=user.id,
            item_type=comic_a.item_type,
            external_id=comic_a.external_id,
            list_item_id=comic_a.id,
            is_completed=True,
            is_skipped=False,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(progress_comic)
        db.commit()
        
        # Now query progress for List B
        progress_records = db.query(ItemProgress).filter(ItemProgress.user_id == user.id).all()
        external_map = {(p.item_type, p.external_id): (p.is_completed, p.is_skipped) for p in progress_records if p.external_id}
        
        # Check if comic_b shows as completed
        is_completed, is_skipped = external_map.get((comic_b.item_type, comic_b.external_id), (False, False))
        print(f"Status of '{comic_b.title}' in List B: Completed? {is_completed}")
        assert is_completed == True, "Global sync failed for external media items"
        
        print("\n=== Test 4: Toggling progress (Custom Item) on List A ===")
        # Mark custom_a as completed
        progress_custom = ItemProgress(
            user_id=user.id,
            list_item_id=custom_a.id,
            is_completed=True,
            is_skipped=False,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(progress_custom)
        db.commit()
        
        # Now query progress for custom_b in List B (should not be completed!)
        custom_map = {p.list_item_id: (p.is_completed, p.is_skipped) for p in progress_records if p.list_item_id and not p.external_id}
        
        # Fetch fresh progress records to see new custom progress
        fresh_progress = db.query(ItemProgress).filter(ItemProgress.user_id == user.id).all()
        fresh_custom_map = {p.list_item_id: (p.is_completed, p.is_skipped) for p in fresh_progress if p.list_item_id and not p.external_id}
        
        is_completed_b, _ = fresh_custom_map.get(custom_b.id, (False, False))
        is_completed_a, _ = fresh_custom_map.get(custom_a.id, (False, False))
        print(f"Status of custom item in List A: Completed? {is_completed_a}")
        print(f"Status of custom item in List B: Completed? {is_completed_b}")
        
        assert is_completed_a == True, "Local item should be completed in List A"
        assert is_completed_b == False, "Custom list items should NOT sync globally across lists"
        
        print("\nSUCCESS: Global Cross-List Sync logic tests passed!")
        
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
