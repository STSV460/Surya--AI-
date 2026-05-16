from dataclasses import dataclass

import httpx
from fastapi import HTTPException, Request, status

from app.config import get_settings


@dataclass(frozen=True)
class AuthContext:
    user_id: str
    email: str | None
    name: str | None
    cookie: str


async def require_session(request: Request) -> AuthContext:
    cookie = request.headers.get("cookie", "")
    if not cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing session cookie")

    settings = get_settings()
    url = f"{settings.auth_base_url}/api/auth/session"
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
            res = await client.get(url, headers={"Cookie": cookie, "Accept": "application/json"})
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Auth service unavailable") from exc

    if res.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    data = res.json()
    user = data.get("user") or {}
    user_id = user.get("id") or data.get("userId")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session user")

    return AuthContext(
        user_id=str(user_id),
        email=user.get("email"),
        name=user.get("name"),
        cookie=cookie,
    )
