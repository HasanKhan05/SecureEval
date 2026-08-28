from source.app import hash_password, verify_password


def test_hash_password_is_deterministic() -> None:
    assert hash_password("correct horse", b"salt") == hash_password("correct horse", b"salt")


def test_verify_password_accepts_match_and_rejects_mismatch() -> None:
    digest = hash_password("correct horse", b"salt")

    assert verify_password("correct horse", b"salt", digest)
    assert not verify_password("wrong", b"salt", digest)
