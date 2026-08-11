import sys
from datetime import datetime, timezone
from sqlalchemy import create_engine
from app.core.database import SessionLocal, engine, Base
from app.models.library import UserLibraryItem, UserLibraryStatusEnum
from app.models.item_progress import ItemProgress
from app.models.consumption import ConsumptionHistory
from app.models.list_item import ListItem

def migrate():
    # 1. Create the new table
    print("Creating consumption_history table if it doesn't exist...")
    ConsumptionHistory.__table__.create(bind=engine, checkfirst=True)
    
    db = SessionLocal()
    try:
        # 2. Backfill from UserLibraryItem
        print("Backfilling from UserLibraryItem...")
        library_items = db.query(UserLibraryItem).filter(
            UserLibraryItem.status == UserLibraryStatusEnum.COMPLETED,
            UserLibraryItem.completed_at.isnot(None)
        ).all()
        
        added_count = 0
        for lib_item in library_items:
            # Check if consumption already exists for this library item
            existing = db.query(ConsumptionHistory).filter(
                ConsumptionHistory.user_id == lib_item.user_id,
                ConsumptionHistory.item_type == lib_item.item_type,
                ConsumptionHistory.external_id == lib_item.external_id,
                ConsumptionHistory.consumed_at == lib_item.completed_at
            ).first()
            
            if not existing:
                c = ConsumptionHistory(
                    user_id=lib_item.user_id,
                    item_type=lib_item.item_type,
                    external_id=lib_item.external_id,
                    consumed_at=lib_item.completed_at
                )
                db.add(c)
                added_count += 1
                
        # 3. Backfill from ItemProgress
        print("Backfilling from ItemProgress...")
        progress_items = db.query(ItemProgress).filter(
            ItemProgress.is_completed == True,
            ItemProgress.completed_at.isnot(None)
        ).all()
        
        for prog in progress_items:
            # Check if consumption already exists
            existing = db.query(ConsumptionHistory).filter(
                ConsumptionHistory.user_id == prog.user_id,
                ConsumptionHistory.list_item_id == prog.list_item_id,
                ConsumptionHistory.consumed_at == prog.completed_at
            ).first()
            
            if not existing:
                # We need item_type and external_id.
                # If progress doesn't have it, we might need to query the ListItem
                item_type = prog.item_type
                external_id = prog.external_id
                
                if not item_type and prog.list_item_id:
                    list_item = db.query(ListItem).filter(ListItem.id == prog.list_item_id).first()
                    if list_item:
                        item_type = list_item.item_type.value if hasattr(list_item.item_type, 'value') else list_item.item_type
                        external_id = list_item.external_id
                
                # Default to something if still None to satisfy NOT NULL constraint
                if not item_type:
                    item_type = "unknown"
                    
                c = ConsumptionHistory(
                    user_id=prog.user_id,
                    item_type=item_type,
                    external_id=external_id,
                    list_item_id=prog.list_item_id,
                    consumed_at=prog.completed_at
                )
                db.add(c)
                added_count += 1
                
        db.commit()
        print(f"Migration completed. Added {added_count} consumption records.")
        
    except Exception as e:
        db.rollback()
        print("Error during migration:")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
