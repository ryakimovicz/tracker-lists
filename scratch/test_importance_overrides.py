import sys
import os
from pydantic import ValidationError

# Append the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.list_item import ListItem, ItemTypeEnum
from app.schemas.list import ListItemCreate

def run_tests():
    # Use in-memory SQLite database
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    try:
        print("=== Test 1: Creating User and Guide with Custom Labels & Section Defaults ===")
        user = User(username="coro", email="coro@example.com", hashed_password="hashed")
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Guide with custom names and defaults
        rlist = ReadingList(
            creator_id=user.id,
            title="Anime Watch Order",
            visibility=VisibilityEnum.PUBLIC,
            importance_labels={"1": "Filler", "2": "Recommended", "5": "Canon Story"},
            section_importances={"Filler Arc": 1, "Canon Arc": 5}
        )
        db.add(rlist)
        db.commit()
        db.refresh(rlist)
        print("Guide created successfully with custom labels and section default importances.")
        
        print("\n=== Test 2: Hierarchical Importance Inheritance and Overrides ===")
        # Item 1: Inherits 'Filler Arc' default (1)
        item1 = ListItem(
            list_id=rlist.id,
            order_index=1,
            item_type=ItemTypeEnum.SERIES,
            title="Episode 10 (Filler)",
            section="Filler Arc",
            importance_rank=None # Should inherit 1
        )
        # Item 2: Overrides 'Filler Arc' default to Canon (5)
        item2 = ListItem(
            list_id=rlist.id,
            order_index=2,
            item_type=ItemTypeEnum.SERIES,
            title="Episode 11 (Main plot introduction)",
            section="Filler Arc",
            importance_rank=5 # Overrides to 5
        )
        db.add_all([item1, item2])
        db.commit()
        db.refresh(item1)
        db.refresh(item2)
        
        # Simulate lists.py mapping logic
        sec_importances = rlist.section_importances or {}
        
        # Check Item 1
        inherited_1 = item1.importance_rank
        if inherited_1 is None and item1.section:
            inherited_1 = sec_importances.get(item1.section)
            
        # Check Item 2
        inherited_2 = item2.importance_rank
        if inherited_2 is None and item2.section:
            inherited_2 = sec_importances.get(item2.section)
            
        print(f"Item 1 '{item1.title}': Explicit priority={item1.importance_rank}, Resolved priority={inherited_1}")
        print(f"Item 2 '{item2.title}': Explicit priority={item2.importance_rank}, Resolved priority={inherited_2}")
        
        assert inherited_1 == 1, "Item 1 should inherit priority 1 from section default"
        assert inherited_2 == 5, "Item 2 should override section default to priority 5"
        print("Hierarchical priority inheritance and override logic successfully verified.")
        
        print("\n=== Test 3: Schema validation bounds checking (1 to 5) ===")
        # Try to validate schema payload with priority out of bounds (6)
        try:
            ListItemCreate(
                title="Invalid priority item",
                item_type=ItemTypeEnum.CUSTOM,
                importance_rank=6 # Validation should fail (le=5)
            )
            raise AssertionError("Schema allowed importance rank greater than 5")
        except ValidationError as e:
            print("Pydantic successfully blocked value 6: ", e.errors()[0]["msg"])
            
        # Try to validate schema payload with priority out of bounds (0)
        try:
            ListItemCreate(
                title="Invalid priority item",
                item_type=ItemTypeEnum.CUSTOM,
                importance_rank=0 # Validation should fail (ge=1)
            )
            raise AssertionError("Schema allowed importance rank less than 1")
        except ValidationError as e:
            print("Pydantic successfully blocked value 0: ", e.errors()[0]["msg"])
            
        print("\nSUCCESS: All Section Importance & Override logic tests passed!")
        
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
