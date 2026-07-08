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
from app.models.library import UserLibraryItem, UserLibraryStatusEnum
from app.models.social import ListVote, ListReport, Comment, CommentVote, CommentReport, Follow

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
        print(f"Created users: {user1.username} (ID: {user1.id}), {user2.username} (ID: {user2.id})")
        
        print("\n=== Test 2: Social Follows ===")
        # Roman follows Coro
        follow = Follow(follower_id=user2.id, followed_id=user1.id)
        db.add(follow)
        db.commit()
        
        # Verify follows
        is_following = db.query(Follow).filter(Follow.follower_id == user2.id, Follow.followed_id == user1.id).first() is not None
        print(f"Roman follows Coro? {is_following}")
        assert is_following == True, "Follow relationship failed"
        
        print("\n=== Test 3: List Creation & Comments & Votes ===")
        # Coro creates a list
        list1 = ReadingList(
            creator_id=user1.id,
            title="Coro's Favorite Manga",
            description="A list of my personal favorites",
            visibility=VisibilityEnum.PUBLIC
        )
        db.add(list1)
        db.commit()
        db.refresh(list1)
        
        # Roman comments on Coro's list
        comment1 = Comment(user_id=user2.id, list_id=list1.id, content="Awesome list, Coro!")
        db.add(comment1)
        db.commit()
        db.refresh(comment1)
        print(f"Roman commented: '{comment1.content}' on List '{list1.title}'")
        
        # Roman upvotes Coro's list
        vote = ListVote(user_id=user2.id, list_id=list1.id)
        db.add(vote)
        db.commit()
        
        vote_count = db.query(ListVote).filter(ListVote.list_id == list1.id).count()
        print(f"List '{list1.title}' has {vote_count} upvote(s)")
        assert vote_count == 1, "Upvote counting failed"
        
        print("\n=== Test 4: Personal Library & Episode Tracker Auto-Creation ===")
        # Coro adds Stranger Things (series) to library
        # We simulate the private list creation
        private_tracker = ReadingList(
            creator_id=user1.id,
            title="Tracker: Stranger Things",
            description="Auto-generated tracker list",
            visibility=VisibilityEnum.PRIVATE
        )
        db.add(private_tracker)
        db.commit()
        db.refresh(private_tracker)
        
        # Add 3 episodes to the private tracker list
        ep1 = ListItem(list_id=private_tracker.id, order_index=1, item_type=ItemTypeEnum.SERIES, external_id="tmdb-ep-1", title="ST - S01E01 - Pilot")
        ep2 = ListItem(list_id=private_tracker.id, order_index=2, item_type=ItemTypeEnum.SERIES, external_id="tmdb-ep-2", title="ST - S01E02 - Weird")
        ep3 = ListItem(list_id=private_tracker.id, order_index=3, item_type=ItemTypeEnum.SERIES, external_id="tmdb-ep-3", title="ST - S01E03 - Holly")
        db.add_all([ep1, ep2, ep3])
        
        lib_item = UserLibraryItem(
            user_id=user1.id,
            item_type="series",
            external_id="66732",
            title="Stranger Things",
            status=UserLibraryStatusEnum.WATCHING,
            tracking_list_id=private_tracker.id
        )
        db.add(lib_item)
        db.commit()
        print(f"Coro added '{lib_item.title}' to library. Status: {lib_item.status}, Linked Tracker ID: {lib_item.tracking_list_id}")
        
        print("\n=== Test 5: Up Next Splitting (Guides vs Personal) ===")
        # Coro also follows/saves Roman's list (which we will create here)
        roman_list = ReadingList(
            creator_id=user2.id,
            title="Roman's Comics",
            description="Comics I recommend",
            visibility=VisibilityEnum.PUBLIC
        )
        db.add(roman_list)
        db.commit()
        db.refresh(roman_list)
        
        r_item = ListItem(list_id=roman_list.id, order_index=1, item_type=ItemTypeEnum.COMIC, external_id="cv-99", title="Sandman #1")
        db.add(r_item)
        db.commit()
        db.refresh(r_item)
        
        # Coro saves Roman's list
        saved_link = SavedList(user_id=user1.id, list_id=roman_list.id)
        db.add(saved_link)
        db.commit()
        
        # Now Coro has completed:
        # - Stranger Things: ep1 completed (is_completed=True). So ep2 should be "Up Next" under personal!
        # - Roman's Comics: nothing completed yet. So "Sandman #1" should be "Up Next" under guides!
        progress_ep1 = ItemProgress(user_id=user1.id, list_item_id=ep1.id, is_completed=True, completed_at=datetime.now(timezone.utc))
        db.add(progress_ep1)
        db.commit()
        
        # Let's perform the same query users.py does:
        all_coro_lists = db.query(ReadingList).filter(
            (ReadingList.creator_id == user1.id) | 
            ReadingList.id.in_(db.query(SavedList.list_id).filter(SavedList.user_id == user1.id))
        ).all()
        
        personal_tracker_ids = {
            item.tracking_list_id for item in 
            db.query(UserLibraryItem).filter(
                UserLibraryItem.user_id == user1.id,
                UserLibraryItem.tracking_list_id.isnot(None)
            ).all()
        }
        
        completed_item_ids = {
            p.list_item_id for p in 
            db.query(ItemProgress).filter(
                ItemProgress.user_id == user1.id,
                ItemProgress.is_completed == True
            ).all()
        }
        
        guides_up_next = []
        personal_up_next = []
        
        for rlist in all_coro_lists:
            first_uncompleted = None
            for item in rlist.items:
                if item.id not in completed_item_ids:
                    first_uncompleted = item
                    break
            if first_uncompleted:
                if rlist.id in personal_tracker_ids:
                    personal_up_next.append(first_uncompleted)
                else:
                    guides_up_next.append(first_uncompleted)
                    
        print(f"Coro's split Up Next:")
        print(" - Guides:")
        for item in guides_up_next:
            print(f"   * '{item.title}' in List '{item.reading_list.title}'")
        print(" - Personal Trackers:")
        for item in personal_up_next:
            print(f"   * '{item.title}' in Tracker '{item.reading_list.title}'")
            
        # Guides_up_next has exactly 1 item ("Sandman #1") since Coro's Favorite Manga list has 0 items.
        assert len(guides_up_next) == 1, "Should have exactly 1 guide Up Next item"
        assert guides_up_next[0].title == "Sandman #1"
        assert len(personal_up_next) == 1, "Should have exactly 1 personal Up Next item"
        assert personal_up_next[0].title == "ST - S01E02 - Weird"
        
        print("\n=== Test 6: Social Activity Feed (Roman following Coro) ===")
        # Roman follows Coro. Coro completed ep1.
        # Roman checks feed. It should show Coro's activity!
        followed_ids_query = db.query(Follow.followed_id).filter(Follow.follower_id == user2.id)
        roman_feed_records = db.query(ItemProgress).filter(
            ItemProgress.user_id.in_(followed_ids_query),
            ItemProgress.is_completed == True
        ).all()
        
        print(f"Roman's activity feed has {len(roman_feed_records)} items:")
        for rec in roman_feed_records:
            print(f" - User '{rec.user_id}' completed Item '{rec.list_item_id}' at {rec.completed_at}")
            
        assert len(roman_feed_records) == 1, "Roman's feed should show 1 activity from followed user Coro"
        
        print("\nSUCCESS: All Social & Library DB logic tests passed!")
        
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
