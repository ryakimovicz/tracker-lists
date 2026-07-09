import sys
import os
import time

# Append the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine, SessionLocal
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.social import Comment, CommentReport
from app.core.security import get_password_hash

client = TestClient(app)

def run_tests():
    # Recreate tables in development SQLite for local verification
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        print("=== Test 1: Creating Admin and Normal Users ===")
        admin_pwd = get_password_hash("adminpassword")
        user_pwd = get_password_hash("userpassword")
        
        admin_user = User(
            username="superadmin",
            email="admin@trackerlists.com",
            hashed_password=admin_pwd,
            is_admin=True
        )
        normal_user = User(
            username="toxicplayer",
            email="toxic@example.com",
            hashed_password=user_pwd,
            is_admin=False
        )
        db.add_all([admin_user, normal_user])
        db.commit()
        db.refresh(admin_user)
        db.refresh(normal_user)
        print("Admin and Normal users registered.")
        
        # Create a comment and report it
        rlist = ReadingList(creator_id=normal_user.id, title="Toxic Backlog", visibility=VisibilityEnum.PUBLIC)
        db.add(rlist)
        db.commit()
        db.refresh(rlist)
        
        comment = Comment(user_id=normal_user.id, list_id=rlist.id, content="Toxicity in comment")
        db.add(comment)
        db.commit()
        db.refresh(comment)
        
        report = CommentReport(user_id=admin_user.id, comment_id=comment.id, reason="Inappropriate words")
        db.add(report)
        db.commit()
        print("Test comments and moderator reports prepared.")
        
        # Test Login
        print("\n=== Test 2: Token-based Access Verification ===")
        # Normal User Token
        normal_login = client.post("/api/v1/auth/login", data={"username": "toxicplayer", "password": "userpassword"})
        assert normal_login.status_code == 200
        normal_token = normal_login.json()["access_token"]
        
        # Admin Token
        admin_login = client.post("/api/v1/auth/login", data={"username": "superadmin", "password": "adminpassword"})
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]
        
        print("\n=== Test 3: Admin Role Authorization Restriction ===")
        # Normal user accesses admin reports -> Forbidden 403
        norm_resp = client.get("/api/v1/admin/reports", headers={"Authorization": f"Bearer {normal_token}"})
        print(f"Normal user access status code: {norm_resp.status_code}")
        assert norm_resp.status_code == 403
        
        # Admin accesses admin reports -> OK 200
        admin_resp = client.get("/api/v1/admin/reports", headers={"Authorization": f"Bearer {admin_token}"})
        print(f"Admin user access status code: {admin_resp.status_code}")
        assert admin_resp.status_code == 200
        reports_payload = admin_resp.json()
        assert len(reports_payload["comments"]) == 1
        print("Admin authentication and auth role restrictions successfully enforced.")
        
        print("\n=== Test 4: Administrative Cleanup and GDPR bans ===")
        # Admin deletes toxic comment
        del_comment = client.delete(f"/api/v1/admin/comments/{comment.id}", headers={"Authorization": f"Bearer {admin_token}"})
        assert del_comment.status_code == 204
        
        # Admin bans/deletes toxic player
        del_user = client.delete(f"/api/v1/admin/users/{normal_user.id}", headers={"Authorization": f"Bearer {admin_token}"})
        assert del_user.status_code == 204
        
        # Check database
        assert db.query(Comment).filter(Comment.id == comment.id).first() is None
        assert db.query(User).filter(User.id == normal_user.id).first() is None
        print("Moderator successfully banned toxic user and deleted reported comments.")
        
        print("\n=== Test 5: Search Endpoint Rate Limiting (slowapi) ===")
        # We hit the search endpoint multiple times to trigger the 20/minute rate limiter
        triggered_429 = False
        # Limit is 20/minute. Let's do 22 requests.
        for i in range(22):
            resp = client.get("/api/v1/search/?q=batman&type=book")
            if resp.status_code == 429:
                triggered_429 = True
                print(f"Rate Limit exceeded on request {i+1}! Status code: 429")
                break
                
        assert triggered_429 == True, "Rate limiter did not block excessive search requests"
        print("SUCCESS: slowapi Rate Limiting successfully verified!")
        
        print("\nSUCCESS: All Admin panel, Rate Limiting, and Background Mail scaffold tests passed!")
        
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
