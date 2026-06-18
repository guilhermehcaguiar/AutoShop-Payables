from sqlalchemy import Column, Integer, String, Numeric, DateTime, Float, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.pool import QueuePool

import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from sqlalchemy import create_engine

BASE_DIR = Path(__file__).resolve().parent
BASE_DIR = BASE_DIR.parent
dotenv_path = BASE_DIR / '.env'
load_dotenv(dotenv_path=dotenv_path)

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise RuntimeError('DATABASE_URL not set')

if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    poolclass=QueuePool,
    pool_recycle=300,
    pool_size=5,
    max_overflow=10,
    connect_args={
        "connect_timeout": 10,
        "options": "-c statement_timeout=30000",
    },
)
Base = declarative_base()


class Usuario(Base):
    __tablename__ = 'usuarios'
    id = Column(Integer, primary_key=True)
    nome = Column(String, nullable=False)
    sexo = Column(String, nullable=False)
    username = Column(String, unique=True, nullable=False)
    senha = Column(String, nullable=False)
    admin = Column(Integer, default=0)
    criado_em = Column(DateTime, server_default='now()')


class Boleto(Base):
    __tablename__ = 'boletos'
    id = Column(Integer, primary_key=True)
    fornecedor = Column(String, nullable=False)
    valor = Column(Numeric(10, 2), nullable=False)
    vencimento = Column(String, nullable=False)
    codigo_barras = Column(String, nullable=False)
    status = Column(String, default='Pendente')
    categoria = Column(String, nullable=False)
    usuario_id = Column(Integer)
    criado_em = Column(DateTime, server_default='now()')
    descricao = Column(String)
    metodo_pagamento = Column(String)
    banco = Column(String)


class Fornecedor(Base):
    __tablename__ = 'fornecedores'
    id = Column(Integer, primary_key=True)
    nome = Column(String, nullable=False)
    cnpj = Column(String)
    telefone = Column(String)
    email = Column(String)
    criado_em = Column(DateTime, server_default='now()')


class Auditoria(Base):
    __tablename__ = 'auditoria'
    id = Column(Integer, primary_key=True)
    acao = Column(String, nullable=False)
    entidade = Column(String, nullable=False)
    entidade_id = Column(Integer)
    usuario_id = Column(Integer)
    detalhes = Column(String)
    criado_em = Column(DateTime, server_default='now()')


class MetaCategoria(Base):
    __tablename__ = 'metas_categorias'
    id = Column(Integer, primary_key=True)
    categoria = Column(String, nullable=False, unique=True)
    limite_mensal = Column(Numeric(12, 2), nullable=False)


class Config(Base):
    __tablename__ = 'config'
    chave = Column(String, primary_key=True)
    valor = Column(String, nullable=False)


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def _executar_script(cursor, query, params=None):
    try:
        cursor.execute(query, params)
    except psycopg2.errors.DuplicateColumn:
        pass
    except psycopg2.errors.DuplicateTable:
        pass
    except psycopg2.errors.UniqueViolation:
        pass


def _garantir_coluna(cursor, tabela, coluna, tipo_sql, permite_null=True, default=None, unique=False):
    null_sql = "NULL" if permite_null else "NOT NULL"
    default_sql = f"DEFAULT {default}" if default is not None else ""
    unique_sql = "UNIQUE" if unique else ""
    sql = f"ALTER TABLE {tabela} ADD COLUMN IF NOT EXISTS {coluna} {tipo_sql} {null_sql} {default_sql} {unique_sql}"
    _executar_script(cursor, sql)


def migrar():
    Base.metadata.create_all(bind=engine)

    conn = get_connection()
    conn.autocommit = True
    cursor = conn.cursor()

    _garantir_coluna(cursor, "boletos", "descricao", "TEXT")
    _garantir_coluna(cursor, "boletos", "metodo_pagamento", "VARCHAR(50)")
    _garantir_coluna(cursor, "boletos", "banco", "VARCHAR(100)")

    cursor.execute("UPDATE boletos SET codigo_barras = '' WHERE codigo_barras IS NULL")
    cursor.execute("UPDATE boletos SET categoria = 'Sem categoria' WHERE categoria IS NULL")
    _executar_script(cursor, "ALTER TABLE boletos ALTER COLUMN codigo_barras SET NOT NULL")
    _executar_script(cursor, "ALTER TABLE boletos ALTER COLUMN categoria SET NOT NULL")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS metas_categorias (
            id SERIAL PRIMARY KEY,
            categoria VARCHAR(255) NOT NULL UNIQUE,
            limite_mensal NUMERIC(12, 2) NOT NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS config (
            chave VARCHAR(255) PRIMARY KEY,
            valor VARCHAR(255) NOT NULL
        )
        """
    )

    cursor.execute("SELECT COUNT(*) FROM config WHERE chave = 'backup_auto'")
    if cursor.fetchone()[0] == 0:
        valor_inicial = "true" if os.getenv("BACKUP_SCHEDULED", "false").lower() == "true" else "false"
        cursor.execute("INSERT INTO config (chave, valor) VALUES ('backup_auto', %s)", (valor_inicial,))

    cursor.close()
    conn.close()
