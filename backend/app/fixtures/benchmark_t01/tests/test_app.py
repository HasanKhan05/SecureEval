import sqlite3

from source.app import find_user


def _connection() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    connection.execute(
        "CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, role TEXT)"
    )
    connection.execute(
        "INSERT INTO users (username, role) VALUES (?, ?)",
        ("alice", "analyst"),
    )
    return connection


def test_find_user_returns_matching_record() -> None:
    connection = _connection()

    assert find_user(connection, "alice") == {
        "id": 1,
        "username": "alice",
        "role": "analyst",
    }


def test_find_user_returns_none_for_unknown_user() -> None:
    connection = _connection()

    assert find_user(connection, "missing") is None
