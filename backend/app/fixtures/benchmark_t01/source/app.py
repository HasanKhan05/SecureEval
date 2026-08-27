import sqlite3


def find_user(connection: sqlite3.Connection, username: str) -> dict[str, object] | None:
    query = f"SELECT id, username, role FROM users WHERE username = '{username}'"
    row = connection.execute(query).fetchone()
    if row is None:
        return None
    return {"id": row[0], "username": row[1], "role": row[2]}
