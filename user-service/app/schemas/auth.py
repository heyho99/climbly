from pydantic import BaseModel, EmailStr
from .users import UserOut


class RegisterReq(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginReq(BaseModel):
    username_or_email: str
    password: str


class TokenOut(BaseModel):
    token: str
    user: UserOut
