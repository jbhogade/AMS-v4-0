"""Password hashing + JWT, parity with the .NET API.

PBKDF2-SHA256, 100 000 iterations, 16-byte random salt, 32-byte digest, all
hex-encoded upper-case (matches HashUtils in server/AMS.API). Existing
ams_users rows therefore keep working across both backends.
"""

import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone

import jwt

_PBKDF2_ITERATIONS = 100_000
_DIGEST_BYTES = 32
_SALT_BYTES = 16


def new_salt() -> str:
    return os.urandom(_SALT_BYTES).hex().upper()


def hash_password(password: str, salt_hex: str) -> str:
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), _PBKDF2_ITERATIONS, dklen=_DIGEST_BYTES
    )
    return digest.hex().upper()


def verify_password(password: str, salt_hex: str, expected_hash_hex: str) -> bool:
    if not password:
        return False
    actual = hash_password(password, salt_hex)
    return hmac.compare_digest(actual, expected_hash_hex)


def create_token(username: str, role: str, name: str, config) -> str:
    """HS256 token with the same claims as AuthController.CreateToken."""
    now = datetime.now(tz=timezone.utc)
    claims = {
        "sub": username,
        "jti": str(uuid.uuid4()),
        "nameidentifier": username,
        "role": role,
        "name": name,
        "iss": config.JWT_ISSUER,
        "aud": config.JWT_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(minutes=config.JWT_EXPIRY_MINUTES),
        "nbf": now,
    }
    return jwt.encode(claims, config.JWT_KEY, algorithm="HS256")


def validate_token(token: str, config):
    """Returns the claims dict or raises jwt.PyJWTError (401 in views)."""
    return jwt.decode(
        token,
        config.JWT_KEY,
        algorithms=["HS256"],
        issuer=config.JWT_ISSUER,
        audience=config.JWT_AUDIENCE,
        options={"require": ["exp", "sub"]},
    )
