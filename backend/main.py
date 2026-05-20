from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from passlib.context import CryptContext
import sqlite3
import jwt
import os
from dotenv import load_dotenv 

load_dotenv() 

app = FastAPI()

# 1. Configurações de Segurança
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

SECRET_KEY = os.getenv("SECRET_KEY") 
ALGORITHM = "HS256"

# 2. Moldes (Schemas)
class UsuarioCreate(BaseModel):
    username: str
    senha: str

# 3. Rotas

@app.post("/usuarios/")
def criar_usuario(usuario: UsuarioCreate):
    senha_criptografada = pwd_context.hash(usuario.senha)
    
    conexao = sqlite3.connect("financeiro.db") 
    cursor = conexao.cursor()
    
    try:
        cursor.execute(
            "INSERT INTO usuarios (username, senha) VALUES (?, ?)", 
            (usuario.username, senha_criptografada)
        )
        conexao.commit()
    except sqlite3.IntegrityError:
        conexao.close()
        raise HTTPException(status_code=400, detail="Este nome de usuário já existe.")
        
    conexao.close()
    return {"mensagem": "Usuário criado com sucesso!"}


@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # 1. Abre o banco e procura o usuário
    conexao = sqlite3.connect("financeiro.db")
    cursor = conexao.cursor()
    cursor.execute("SELECT id, senha FROM usuarios WHERE username = ?", (form_data.username,))
    usuario_db = cursor.fetchone() # Pega a primeira linha que encontrar
    conexao.close()

    # 2. Verifica se o usuário existe
    if not usuario_db:
        raise HTTPException(status_code=400, detail="Usuário ou senha incorretos")

    # 3. Separa os dados que vieram do banco
    usuario_id = usuario_db[0]
    senha_criptografada_db = usuario_db[1]

    # 4. Verifica se a senha digitada bate com a criptografada
    senha_valida = pwd_context.verify(form_data.password, senha_criptografada_db)
    if not senha_valida:
        raise HTTPException(status_code=400, detail="Usuário ou senha incorretos")

    # 5. Gera o "Crachá" (Token JWT) FIXO
    dados_cracha = {"sub": form_data.username}
    
    token = jwt.encode(dados_cracha, SECRET_KEY, algorithm=ALGORITHM)

    # 6. Entrega o crachá para o usuário
    return {"access_token": token, "token_type": "bearer"}