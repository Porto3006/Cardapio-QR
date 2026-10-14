"""Tests for Stripe subscription (owner) endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if 'REACT_APP_BACKEND_URL' in os.environ else "https://meu-cardapio-qr.preview.emergentagent.com"
OWNER_EMAIL = "alexandreporto01@outlook.com"
OWNER_PWD = "prato123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PWD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# --- Checkout endpoint ---
def test_checkout_requires_auth():
    r = requests.post(f"{BASE_URL}/api/payments/checkout", json={"lookup_key": "plano_intermediario_mensal", "origin_url": BASE_URL}, timeout=30)
    assert r.status_code == 401


@pytest.mark.parametrize("lookup_key,expected_plan", [
    ("plano_simples_mensal", "simples"),
    ("plano_intermediario_mensal", "intermediario"),
    ("plano_avancado_mensal", "avancado"),
])
def test_checkout_creates_session(auth_headers, lookup_key, expected_plan):
    r = requests.post(f"{BASE_URL}/api/payments/checkout",
                      json={"lookup_key": lookup_key, "origin_url": BASE_URL},
                      headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "checkout_url" in data and data["checkout_url"].startswith("https://checkout.stripe.com")
    assert "session_id" in data and data["session_id"].startswith("cs_")
    # Status check should return pending
    sid = data["session_id"]
    sr = requests.get(f"{BASE_URL}/api/payments/status/{sid}", timeout=30)
    assert sr.status_code == 200
    sdata = sr.json()
    assert sdata["session_id"] == sid
    assert sdata["payment_status"] in ("pending", "unpaid")
    assert sdata["plan"] == expected_plan


def test_checkout_invalid_lookup(auth_headers):
    r = requests.post(f"{BASE_URL}/api/payments/checkout",
                      json={"lookup_key": "plano_inexistente", "origin_url": BASE_URL},
                      headers=auth_headers, timeout=30)
    assert r.status_code in (400, 404, 500)


def test_payment_status_not_found():
    r = requests.get(f"{BASE_URL}/api/payments/status/cs_test_doesnotexist_999", timeout=30)
    assert r.status_code == 404


def test_restaurant_initial_plan(auth_headers):
    r = requests.get(f"{BASE_URL}/api/restaurant", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    data = r.json()
    # Owner's restaurant should exist with a plan field
    assert "plan" in data
