from sqlalchemy import Column, Integer, String, Numeric, DateTime
from sqlalchemy.ext.declarative import declarative_base

import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from sqlalchemy import create_engine

# Load .env from project root
BASE_DIR = Path(__file__).resolve().parent
BASE_DIR = BASE_DIR.parent  # project root
dotenv_path = BASE_DIR / '.env'
load_dotenv(dotenv_path=dotenv_path)

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise RuntimeError('DATABASE_URL not set')

# Ensure proper driver prefix
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
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
    codigo_barras = Column(String)
    status = Column(String, default='Pendente')
    categoria = Column(String)
    usuario_id = Column(Integer)
    criado_em = Column(DateTime, server_default='now()')


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


def get_connection():
    """Return a raw psycopg2 connection for manual query execution."""
    return psycopg2.connect(DATABASE_URL)