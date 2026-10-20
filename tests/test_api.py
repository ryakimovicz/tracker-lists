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


def test_mock_google_token_blocked_in_production(client):
    from app.core.config import settings
    orig_env = settings.ENVIRONMENT
    try:
        settings.ENVIRONMENT = "production"
        response = client.post(
            "/api/v1/auth/google",
            json={"id_token": "mock-google-victim@test.com-victim"}
        )
        assert response.status_code == 403
    finally:
        settings.ENVIRONMENT = orig_env


def test_forgot_password_generic_response(client):
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "nonexistent_email_for_testing@domain.com"}
    )
    assert response.status_code == 200
    assert "password reset link has been generated" in response.json().get("message", "")


def test_admin_delete_shelf_requires_admin(client):
    response = client.delete("/api/v1/admin/users/1/shelf")
    assert response.status_code in (401, 403)


