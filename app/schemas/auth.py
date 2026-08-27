from pydantic import BaseModel, Field, EmailStr
from typing import Optional

class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=6)

class UsernameUpdateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)

class GoogleLoginRequest(BaseModel):
    id_token: str
    username: Optional[str] = None

class GoogleAuthResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    needs_username: bool = False
    suggested_username: Optional[str] = None
    email: Optional[str] = None

class ResendVerificationRequest(BaseModel):
    email: EmailStr

class VerifyEmailResponse(BaseModel):
    message: str
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"


