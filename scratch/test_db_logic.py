import sys
import os

# Append the project root to sys.path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.list_item import ListItem, ItemTypeEnum
from app.models.saved_list import SavedList
from app.models.item_progress import ItemProgress

def run_tests():
    # Use an in-memory SQLite database for testing
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    try:
        print("=== Test 1: User Creation ===")
        user1 = User(username="coro", email="coro@example.com", hashed_password="hashed_password_1")
        user2 = User(username="roman", email="roman@example.com", hashed_password="hashed_password_2")
        db.add_all([user1, user2])
        db.commit()
        print(f"Created users: {user1.username} (ID: {user1.id}), {user2.username} (ID: {user2.id})")
        
        print("\n=== Test 2: Reading List & Items Creation ===")
        # User 1 creates a list
        new_list = ReadingList(
            creator_id=user1.id,
            title="Batman Reading Order",
            description="Complete Batman chronology",
            visibility=VisibilityEnum.PUBLIC
        )
        db.add(new_list)
        db.commit()
        
        # Add 3 items to the list
        item1 = ListItem(list_id=new_list.id, order_index=1, item_type=ItemTypeEnum.COMIC, external_id="cv-101", title="Batman Year One", section="Parte 1: El Origen")
        item2 = ListItem(list_id=new_list.id, order_index=2, item_type=ItemTypeEnum.COMIC, external_id="cv-102", title="Batman The Long Halloween", section="Parte 2: Crossovers")
        item3 = ListItem(list_id=new_list.id, order_index=3, item_type=ItemTypeEnum.COMIC, external_id="cv-103", title="Batman Dark Victory", section="Parte 2: Crossovers")
        db.add_all([item1, item2, item3])
        db.commit()
        print(f"List '{new_list.title}' created with {len(new_list.items)} items.")
        for item in new_list.items:
            print(f" - [{item.order_index}] {item.title} (Section: {item.section}, Type: {item.item_type})")
            if item.id == item1.id:
                assert item.section == "Parte 1: El Origen", "Section not saved correctly"
            
        print("\n=== Test 3: User 2 saves/follows User 1's list ===")
        saved_list = SavedList(user_id=user2.id, list_id=new_list.id)
        db.add(saved_list)
        db.commit()
        print(f"User '{user2.username}' saved the list '{saved_list.reading_list.title}'")

        print("\n=== Test 4: User 2 marks progress (checks items) ===")
        # User 2 completes item1 and item2, but not item3
        progress1 = ItemProgress(user_id=user2.id, list_item_id=item1.id, is_completed=True)
        progress2 = ItemProgress(user_id=user2.id, list_item_id=item2.id, is_completed=True)
        db.add_all([progress1, progress2])
        db.commit()
        
        # Verify progress calculation for User 2
        items = db.query(ListItem).filter(ListItem.list_id == new_list.id).all()
        total_items = len(items)
        
        # Check progress records for User 2
        user2_progress_records = db.query(ItemProgress).filter(
            ItemProgress.user_id == user2.id,
            ItemProgress.list_item_id.in_([i.id for i in items])
        ).all()
        
        completed_items = sum(1 for p in user2_progress_records if p.is_completed)
        progress_percentage = (completed_items / total_items) * 100
        
        print(f"User '{user2.username}' progress on '{new_list.title}':")
        print(f" - Completed: {completed_items} of {total_items} items")
        print(f" - Progress: {progress_percentage:.2f}%")
        assert completed_items == 2, "Should have 2 completed items"
        assert progress_percentage == 66.66666666666666, "Progress percentage mismatch"
        
        print("\n=== Test 5: Creator adds a new item to the list ===")
        # Creator adds item4
        item4 = ListItem(list_id=new_list.id, order_index=4, item_type=ItemTypeEnum.COMIC, external_id="cv-104", title="Batman Robin Year One")
        db.add(item4)
        db.commit()
        
        # Recalculate progress for User 2
        items_updated = db.query(ListItem).filter(ListItem.list_id == new_list.id).all()
        total_items_updated = len(items_updated)
        
        user2_progress_records_updated = db.query(ItemProgress).filter(
            ItemProgress.user_id == user2.id,
            ItemProgress.list_item_id.in_([i.id for i in items_updated])
        ).all()
        
        completed_items_updated = sum(1 for p in user2_progress_records_updated if p.is_completed)
        progress_percentage_updated = (completed_items_updated / total_items_updated) * 100
        
        print(f"List updated! New item added by creator.")
        print(f"User '{user2.username}' updated progress on '{new_list.title}':")
        print(f" - Completed: {completed_items_updated} of {total_items_updated} items")
        print(f" - Progress: {progress_percentage_updated:.2f}%")
        assert completed_items_updated == 2, "Completed items count should remain 2"
        assert progress_percentage_updated == 50.0, "Progress should drop to 50% after new item is added"
        print("\n=== Test 6: Database local searches (Users & Lists) ===")
        search_list_results = db.query(ReadingList).filter(
            ReadingList.visibility == VisibilityEnum.PUBLIC,
            (ReadingList.title.like("%Batman%") | ReadingList.description.like("%Batman%"))
        ).all()
        print(f"List search for 'Batman' found: {len(search_list_results)} lists")
        assert len(search_list_results) == 1, "Should find 1 list with 'Batman'"
        
        search_user_results = db.query(User).filter(User.username.like("%ro%")).all()
        print(f"User search for 'ro' found: {len(search_user_results)} users ({[u.username for u in search_user_results]})")
        assert len(search_user_results) == 2, "Should find 2 users containing 'ro' ('coro' and 'roman')"
        
        print("\nSUCCESS: All DB logic tests passed!")
        
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
