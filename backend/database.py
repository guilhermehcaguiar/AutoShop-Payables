import sqlite3
import os

# Use DATABASE_URL env var; fallback to local file
DB_PATH = os.getenv("DATABASE_URL", "sqlite:///./financeiro.db")

def get_connection():
    """Return a SQLite connection using the DB_PATH from environment."""
    return sqlite3.connect(DB_PATH)