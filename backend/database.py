import sqlite3
import os
from datetime import datetime

# Use DATABASE_URL env var; fallback to local file
DB_PATH = os.getenv("DATABASE_URL", "sqlite:///./financeiro.db")

def migrar():
    """Adiciona colunas que podem não existir em bancos antigos."""
    conexao = sqlite3.connect(DB_PATH)
    cursor = conexao.cursor()

    migracoes = [
        ("ALTER TABLE usuarios ADD COLUMN admin INTEGER DEFAULT 0", "admin"),
        ("ALTER TABLE boletos ADD COLUMN categoria TEXT", "categoria"),
        ("ALTER TABLE boletos ADD COLUMN criado_em TEXT DEFAULT (datetime('now', 'localtime'))", "criado_em"),
    ]

    for sql, descricao in migracoes:
        try:
            cursor.execute(sql)
        except sqlite3.OperationalError:
            pass

    cursor.commit()
    cursor.close()

def get_connection():
    """Return a SQLite connection using the DB_PATH from environment."""
    return sqlite3.connect(DB_PATH)