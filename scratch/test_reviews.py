import sys
import os
from datetime import datetime, timezone

# Append the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.user import User
from app.models.library import UserLibraryItem, UserLibraryStatusEnum
from app.models.review import MediaReview, MediaReviewVote, MediaReviewReport

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
        
        print("\n=== Test 2: Semantic status validations ===")
        # 2.1 Game with correct status
        game_item = UserLibraryItem(
            user_id=user1.id,
            item_type="game",
            external_id="1099",
            title="Batman Arkham VR",
            status=UserLibraryStatusEnum.PLAYING
        )
        db.add(game_item)
        
        # 2.2 Movie with correct status
        movie_item = UserLibraryItem(
            user_id=user2.id,
            item_type="movie",
            external_id="272",
            title="Batman Begins",
            status=UserLibraryStatusEnum.COMPLETED
        )
        db.add(movie_item)
        db.commit()
        print("Successfully added items with valid semantic statuses!")
        
        # 2.3 Dropped status is allowed on everything
        dropped_game = UserLibraryItem(
            user_id=user2.id,
            item_type="game",
            external_id="4123",
            title="Batman Arkham Asylum",
            status=UserLibraryStatusEnum.DROPPED
        )
        db.add(dropped_game)
        db.commit()
        print("Successfully verified 'dropped' status is allowed on game items!")
        
        print("\n=== Test 3: Creating Media Reviews and Star Ratings ===")
        review1 = MediaReview(
            user_id=user1.id,
            item_type="game",
            external_id="1099",
            rating=4,
            content="Great gameplay, highly immersive VR experience."
        )
        db.add(review1)
        db.commit()
        db.refresh(review1)
        print(f"User coro reviewed game '1099': {review1.rating} stars - '{review1.content}'")
        
        print("\n=== Test 4: Upvoting Reviews ===")
        vote = MediaReviewVote(user_id=user2.id, review_id=review1.id)
        db.add(vote)
        db.commit()
        
        # Fetch votes count
        votes_count = db.query(MediaReviewVote).filter(MediaReviewVote.review_id == review1.id).count()
        print(f"Review has {votes_count} upvote(s)")
        assert votes_count == 1, "Upvote count mismatch"
        
        print("\n=== Test 5: Reporting/Flagging Reviews ===")
        report = MediaReviewReport(user_id=user2.id, review_id=review1.id, reason="Spam / Off-topic content")
        db.add(report)
        db.commit()
        
        # Fetch reports count
        reports_count = db.query(MediaReviewReport).filter(MediaReviewReport.review_id == review1.id).count()
        print(f"Review reported {reports_count} time(s) for reason: '{report.reason}'")
        assert reports_count == 1, "Report count mismatch"
        
        print("\nSUCCESS: All Review and Status Validation logic tests passed!")
        
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
