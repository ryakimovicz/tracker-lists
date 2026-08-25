import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import smtplib
from email.mime.text import MIMEText

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, verify_password, get_password_hash
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest, GoogleLoginRequest, GoogleAuthResponse

router = APIRouter()


def send_reset_email(to_email: str, username: str, token: str):
    # Print local fallback simulation for developer logs
    reset_link = f"http://localhost:5173/reset-password?token={token}"
    print("\n" + "="*50)
    print("SIMULATED RESET PASSWORD EMAIL SEND")
    print(f"To: {to_email}")
    print(f"Token: {token}")
    print(f"Reset URL: {reset_link}")
    print("="*50 + "\n")

    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[SMTP Warning] SMTP credentials not set. Skipping real email dispatch to {to_email}")
        return
        
    try:
        msg_content = f"Hello {username},\n\nYou requested a password reset. Click the link below to reset your password:\n{reset_link}\n\nThis link is valid for 1 hour."
        
        msg = MIMEText(msg_content)
        msg['Subject'] = "Reset your Password - Tracker Lists"
        msg['From'] = settings.EMAILS_FROM_EMAIL
        msg['To'] = to_email
        
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_TLS:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAILS_FROM_EMAIL, [to_email], msg.as_string())
            
        print(f"[SMTP Success] Password reset email sent to {to_email}")
    except Exception as e:
        print(f"[SMTP Error] Failed to send password reset email: {str(e)}")

# Helper to set cookie
def set_refresh_cookie(response: Response, refresh_token: str):
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False, # Set to True in production with HTTPS
        samesite="lax",
        max_age=14 * 24 * 60 * 60  # 14 days
    )

from sqlalchemy import func

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if username or email already exists (case-insensitive)
    user_db = db.query(User).filter(
        (func.lower(User.email) == user_in.email.strip().lower()) |
        (func.lower(User.username) == user_in.username.strip().lower())
    ).first()
    if user_db:
        if user_db.email.lower() == user_in.email.strip().lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    hashed_password = get_password_hash(user_in.password)

    new_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    # Authenticate by username or email
    user = db.query(User).filter(
        (User.username == form_data.username) | (User.email == form_data.username)
    ).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate Refresh Token
    rf_token = secrets.token_urlsafe(64)
    user.refresh_token = rf_token
    db.commit()
    
    # Set HttpOnly Cookie
    set_refresh_cookie(response, rf_token)
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh", response_model=Token)
def refresh_session(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is missing"
        )
        
    user = db.query(User).filter(User.refresh_token == refresh_token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
        
    # Rotate refresh token
    new_rf_token = secrets.token_urlsafe(64)
    user.refresh_token = new_rf_token
    db.commit()
    
    set_refresh_cookie(response, new_rf_token)
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    if refresh_token:
        user = db.query(User).filter(User.refresh_token == refresh_token).first()
        if user:
            user.refresh_token = None
            db.commit()
            
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}

# --- Google OAuth2 Scaffold ---
@router.post("/google", response_model=GoogleAuthResponse)
def google_auth(
    response: Response,
    payload: GoogleLoginRequest,
    db: Session = Depends(get_db)
):
    email = None
    suggested_username = None
    
    # Try mock token first for easy integration and local developer verification
    if payload.id_token.startswith("mock-google-"):
        parts = payload.id_token.split("-")
        # format: mock-google-<email>-<username>
        if len(parts) >= 4:
            email = parts[2]
            suggested_username = parts[3]
        else:
            email = "googleuser@example.com"
            suggested_username = "googleuser"
    else:
        # Standard Google validation using google-auth library
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests
            import re
            
            # Specify the CLIENT_ID of the app if configured, otherwise verify against Google certs
            audience = settings.GOOGLE_CLIENT_ID if settings.GOOGLE_CLIENT_ID else None
            id_info = id_token.verify_oauth2_token(payload.id_token, requests.Request(), audience=audience, clock_skew_in_seconds=10)
            
            email = id_info.get("email")
            # Generate clean suggested username from email name part or name field
            raw_name = id_info.get("name") or email.split("@")[0]
            clean_name = re.sub(r'[^a-zA-Z0-9_]', '', raw_name.replace(" ", "_")).lower()
            suggested_username = clean_name[:30] if clean_name else f"user_{secrets.token_hex(4)}"
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Google OAuth helper dependencies are not installed on server"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid Google ID token: {str(e)}"
            )
            
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not retrieve email from Google token"
        )
        
    # Check if user already exists
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # If no custom username provided yet, ask frontend to prompt the user
        if not payload.username or not payload.username.strip():
            # Check availability of suggested username, generate alternative if taken
            base_suggested = suggested_username
            counter = 1
            while db.query(User).filter(func.lower(User.username) == suggested_username.lower()).first():
                suggested_username = f"{base_suggested}{counter}"
                counter += 1
                
            return {
                "needs_username": True,
                "suggested_username": suggested_username,
                "email": email,
                "access_token": None,
                "token_type": None
            }
        
        # User provided their chosen username: validate format and uniqueness
        chosen_username = payload.username.strip()
        import re
        if len(chosen_username) < 3 or len(chosen_username) > 30:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username must be between 3 and 30 characters"
            )
        if not re.match(r'^[a-zA-Z0-9_]+$', chosen_username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username can only contain letters, numbers and underscores"
            )
            
        existing_username = db.query(User).filter(func.lower(User.username) == chosen_username.lower()).first()
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered"
            )

            
        # Create new user definitely
        random_pwd = secrets.token_urlsafe(24)
        user = User(
            username=chosen_username,
            email=email,
            hashed_password=get_password_hash(random_pwd)
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    # Generate Refresh Token
    rf_token = secrets.token_urlsafe(64)
    user.refresh_token = rf_token
    db.commit()
    
    set_refresh_cookie(response, rf_token)
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "needs_username": False,
        "suggested_username": user.username,
        "email": user.email
    }


# --- Password Reset Flow ---
@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.email).first()
    # Always return a success response to avoid email enumeration attacks
    if not user:
        return {"message": "If the email is registered, a password reset link has been generated."}
        
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()
    
    # Asynchronously dispatch reset email via BackgroundTasks
    background_tasks.add_task(send_reset_email, user.email, user.username, token)
    
    return {"message": "If the email is registered, a password reset link has been generated."}

@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.reset_token == payload.token,
        User.reset_token_expires > datetime.now(timezone.utc)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
        
    user.hashed_password = get_password_hash(payload.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    user.refresh_token = None # Force re-login on all devices
    db.commit()
    
    return {"message": "Password reset successfully"}
