from .conftest import register


def test_register_login_logout(client):
    email = register(client)
    assert client.get("/api/auth/me").json()["email"] == email
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"email": email, "password": "wrong-pass"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": email.upper(), "password": "password123"}).status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_duplicate_and_short_password(client):
    email = register(client)
    assert client.post("/api/auth/register", json={"email": email, "password": "password123"}).status_code == 409
    assert client.post("/api/auth/register", json={"email": "x@example.com", "password": "short"}).status_code == 422


def test_refresh_and_change_password(client):
    email = register(client)
    assert client.post("/api/auth/refresh").status_code == 200
    old_refresh = client.cookies.get("refresh_token")
    r = client.post("/api/auth/change-password", json={"current_password": "bad", "new_password": "newpass123"})
    assert r.status_code == 400
    r = client.post("/api/auth/change-password", json={"current_password": "password123", "new_password": "newpass123"})
    assert r.status_code == 200
    # старый refresh-токен больше не действует
    client.cookies.set("refresh_token", old_refresh, path="/api/auth")
    assert client.post("/api/auth/refresh").status_code == 401
    client.cookies.clear()
    assert client.post("/api/auth/login", json={"email": email, "password": "newpass123"}).status_code == 200
