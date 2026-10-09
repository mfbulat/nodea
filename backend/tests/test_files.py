def test_upload_download(client, user):
    r = client.post("/api/files", files={"file": ("отчёт.txt", b"hello", "text/plain")})
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    d = client.get(url)
    assert d.content == b"hello"
    assert "filename*=UTF-8''" in d.headers["content-disposition"]


def test_upload_requires_auth(client):
    assert client.post("/api/files", files={"file": ("a.txt", b"x", "text/plain")}).status_code == 401
