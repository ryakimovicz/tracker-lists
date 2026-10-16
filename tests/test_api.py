def test_login_invalid_credentials(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "nonexistent_user@test.com", "password": "wrongpassword123"}
    )
    # Fast-failing with 401 or 400 for incorrect credentials
    assert response.status_code in (400, 401, 403)


def test_popular_works_endpoint(client):
    response = client.get("/api/v1/search/popular?media_type=movie")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_search_validation_empty_query(client):
    response = client.get("/api/v1/search/all?q=")
    # FastAPI rejects query parameter with min_length constraint with 422
    assert response.status_code == 422
