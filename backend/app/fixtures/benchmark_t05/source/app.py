import hashlib
import hmac


def hash_password(password: str, salt: bytes) -> str:
    return hashlib.md5(salt + password.encode("utf-8")).hexdigest()


def verify_password(password: str, salt: bytes, expected: str) -> bool:
    return hmac.compare_digest(hash_password(password, salt), expected)
