import os
import sys
import psycopg2
import smtplib
import threading
import pytest
from unittest.mock import patch
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.environ.get('DATABASE_URL', '')
if not DATABASE_URL:
    pytest.skip("DATABASE_URL not set", allow_module_level=True)

os.environ['DATABASE_URL'] = DATABASE_URL

from fastapi.testclient import TestClient


class _TestConnection:
    """Wraps a psycopg2 connection making commit/close no-ops.

    Every test runs inside a single transaction that is rolled back at
    the end, so no data ever persists to the database.
    """
    def __init__(self, conn):
        object.__setattr__(self, '_conn', conn)

    def __getattr__(self, name):
        if name in ('commit', 'close'):
            return lambda *a, **kw: None
        return getattr(object.__getattribute__(self, '_conn'), name)

    def __setattr__(self, name, value):
        setattr(object.__getattribute__(self, '_conn'), name, value)


_CONN = threading.local()


@pytest.fixture(scope="session")
def client():
    from main import app
    return TestClient(app)


@pytest.fixture(autouse=True)
def db_transaction():
    real = psycopg2.connect(DATABASE_URL)
    real.autocommit = False
    wrapped = _TestConnection(real)

    import database as db_mod
    import main as main_mod
    db_mod.get_connection = lambda: wrapped
    main_mod.get_connection = lambda: wrapped
    _CONN.conn = wrapped

    yield

    real.rollback()
    real.close()
    _CONN.conn = None
    db_mod.get_connection = _conectar
    main_mod.get_connection = _conectar


@pytest.fixture(autouse=True)
def mock_smtp():
    with patch.object(smtplib, 'SMTP') as mock:
        yield mock


# ── helpers ───────────────────────────────────────────────────────────

def _conectar():
    c = psycopg2.connect(DATABASE_URL)
    c.autocommit = False
    return c

_counter = 0


@pytest.fixture
def token_admin(client):
    global _counter
    _counter += 1
    uid = _counter
    username = f"admin_{uid}"

    resp = client.post("/usuarios/", json={
        "nome": f"Admin {uid}", "sexo": "M",
        "username": username, "senha": "pytest123",
    })
    assert resp.status_code == 200, resp.json()

    cur = _CONN.conn.cursor()
    cur.execute("UPDATE usuarios SET admin = 1 WHERE username = %s", (username,))
    cur.close()

    resp = client.post("/login", data={"username": username, "password": "pytest123"})
    assert resp.status_code == 200, resp.json()
    return resp.json()["access_token"]


@pytest.fixture
def token_user(client):
    global _counter
    _counter += 1
    uid = _counter
    username = f"user_{uid}"

    resp = client.post("/usuarios/", json={
        "nome": f"User {uid}", "sexo": "F",
        "username": username, "senha": "pytest123",
    })
    assert resp.status_code == 200, resp.json()

    resp = client.post("/login", data={"username": username, "password": "pytest123"})
    assert resp.status_code == 200, resp.json()
    return resp.json()["access_token"]
