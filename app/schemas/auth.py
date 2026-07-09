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
