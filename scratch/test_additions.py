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
from app.models.saved_list import SavedList
from app.models.item_progress import ItemProgress
from app.models.addition import ListAddition, ListAdditionItem, UserAdoptedAddition, AdditionVote, AdditionComment

def run_tests():
    # Use in-memory SQLite database
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    try:
        print("=== Test 1: User Registration ===")
        user1 = User(username="coro", email="coro@example.com", hashed_password="hashed_password_1")
        user2 = User(username="roman", email="roman@example.com", hashed_password="hashed_password_2")
        db.add_all([user1, user2])
        db.commit()
        db.refresh(user1)
        db.refresh(user2)
        print(f"Created users: {user1.username} and {user2.username}")
        
        print("\n=== Test 2: Base Reading List Creation ===")
        rlist = ReadingList(
            creator_id=user1.id,
            title="Batman Main Arc",
            description="The core storyline",
            visibility=VisibilityEnum.PUBLIC
        )
        db.add(rlist)
        db.commit()
        db.refresh(rlist)
        
        item1 = ListItem(list_id=rlist.id, order_index=1, item_type=ItemTypeEnum.COMIC, external_id="1", title="Batman #404")
        item2 = ListItem(list_id=rlist.id, order_index=2, item_type=ItemTypeEnum.COMIC, external_id="2", title="Batman #406")
        db.add_all([item1, item2])
        db.commit()
        db.refresh(item1)
        db.refresh(item2)
        print(f"List '{rlist.title}' created with base items: '{item1.title}' and '{item2.title}'")
        
        print("\n=== Test 3: Creating and Populating a List Addition ===")
        # Roman follows the list
        saved_list = SavedList(user_id=user2.id, list_id=rlist.id)
        db.add(saved_list)
        db.commit()
        
        # Roman creates a private addition anchored after Item 1 (Batman #404)
        addition = ListAddition(
            list_id=rlist.id,
            user_id=user2.id,
            title="Roman's Batman Filler",
            description="Batman #405 is essential context!",
            is_shared=False,
            created_at=datetime.now(timezone.utc)
        )
        db.add(addition)
        db.commit()
        db.refresh(addition)
        
        # Add the addition item
        add_item = ListAdditionItem(
            addition_id=addition.id,
            after_item_id=item1.id,
            order_index=1,
            item_type=ItemTypeEnum.COMIC,
            external_id="1-filler",
            title="Batman #405 (Optional)"
        )
        db.add(add_item)
        db.commit()
        db.refresh(add_item)
        print(f"User roman created addition '{addition.title}' with item: '{add_item.title}' anchored after '{item1.title}'")
        
        print("\n=== Test 4: Merging/Injections inside List Details ===")
        # Let's perform the same injection query lists.py does:
        user_additions = db.query(ListAddition).filter(
            ListAddition.list_id == rlist.id,
            ListAddition.user_id == user2.id
        ).all()
        adopted_additions = db.query(ListAddition).join(
            UserAdoptedAddition, UserAdoptedAddition.addition_id == ListAddition.id
        ).filter(
            ListAddition.list_id == rlist.id,
            UserAdoptedAddition.user_id == user2.id
        ).all()
        
        all_active_additions = list(set(user_additions + adopted_additions))
        
        add_items = []
        for add in all_active_additions:
            add_items.extend(add.items)
        add_items.sort(key=lambda x: x.order_index)
        
        # Merge items
        merged = []
        for i in [item1, item2]:
            merged.append({"id": i.id, "title": i.title, "is_addition": False})
            
        for ai in add_items:
            inserted = False
            if ai.after_item_id:
                for idx, base_item in enumerate(merged):
                    if not base_item["is_addition"] and base_item["id"] == ai.after_item_id:
                        insert_idx = idx + 1
                        while insert_idx < len(merged) and merged[insert_idx]["is_addition"]:
                            insert_idx += 1
                        merged.insert(insert_idx, {"id": ai.id, "title": ai.title, "is_addition": True})
                        inserted = True
                        break
            if not inserted:
                merged.append({"id": ai.id, "title": ai.title, "is_addition": True})
                
        print("Merged item sequence:")
        for idx, m in enumerate(merged, start=1):
            print(f" {idx}. [{m['id']}] {m['title']} (Addition? {m['is_addition']})")
            
        assert len(merged) == 3, "Total items should be 3 (2 base + 1 addition)"
        assert merged[1]["title"] == "Batman #405 (Optional)", "Batman #405 should be injected at index 1 (second place)"
        
        print("\n=== Test 5: Progress Toggling on Injected Items ===")
        # Roman marks the addition item as completed
        progress = ItemProgress(
            user_id=user2.id,
            addition_item_id=add_item.id,
            is_completed=True,
            is_skipped=False,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(progress)
        db.commit()
        
        # Verify progress count
        comp_count = db.query(ItemProgress).filter(
            ItemProgress.user_id == user2.id,
            ItemProgress.is_completed == True
        ).count()
        print(f"User roman completed {comp_count} item(s)")
        assert comp_count == 1, "Completed items count mismatch"
        
        print("\nSUCCESS: All List Addition and Extension logic tests passed!")
        
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
