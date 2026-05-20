from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from passlib.context import CryptContext
import sqlite3
import jwt
import os
from dotenv import load_dotenv 

load_dotenv() 

app = FastAPI()

# CONFIGURAÇÃO DO CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permite que qualquer front-end faça requisições
    allow_credentials=True,
    allow_methods=["*"], # Permite todos os métodos (POST, GET, etc.)
    allow_headers=["*"], # Permite todos os cabeçalhos
)

# 1. Configurações de Segurança
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

SECRET_KEY = os.getenv("SECRET_KEY") 
ALGORITHM = "HS256"

# 2. Moldes (Schemas) Atualizados
class UsuarioCreate(BaseModel):
    nome: str      # Adicionado
    sexo: str      # Adicionado ('M' ou 'F')
    username: str
    senha: str

# 3. Rotas

@app.post("/usuarios/")
def criar_usuario(usuario: UsuarioCreate):
    senha_criptografada = pwd_context.hash(usuario.senha)
    
    conexao = sqlite3.connect("financeiro.db") 
    cursor = conexao.cursor()
    
    try:
        # Query atualizada para inserir as 4 colunas obrigatórias
        cursor.execute(
            "INSERT INTO usuarios (nome, sexo, username, senha) VALUES (?, ?, ?, ?)", 
            (usuario.nome, usuario.sexo, usuario.username, senha_criptografada)
        )
        conexao.commit()
    except sqlite3.IntegrityError as e:
        conexao.close()
        # Se der erro real de usuário duplicado ou restrição do banco
        raise HTTPException(status_code=400, detail=f"Erro de cadastro: {e}. Verifique se o username já existe.")
        
    conexao.close()
    return {"mensagem": "Usuário criado com sucesso!"}


@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # 1. Abre o banco e procura o usuário trazendo também nome e sexo
    conexao = sqlite3.connect("financeiro.db")
    cursor = conexao.cursor()
    cursor.execute("SELECT id, senha, nome, sexo FROM usuarios WHERE username = ?", (form_data.username,))
    usuario_db = cursor.fetchone() 
    conexao.close()

    # 2. Verifica se o usuário existe
    if not usuario_db:
        raise HTTPException(status_code=400, detail="Usuário ou senha incorretos")

    # 3. Separa os dados que vieram do banco
    usuario_id = usuario_db[0]
    senha_criptografada_db = usuario_db[1]
    nome_db = usuario_db[2] # Captura o nome real
    sexo_db = usuario_db[3] # Captura o sexo

    # 4. Verifica se a senha digitada bate com a criptografada
    senha_valida = pwd_context.verify(form_data.password, senha_criptografada_db)
    if not senha_valida:
        raise HTTPException(status_code=400, detail="Usuário ou senha incorretos")

    # 5. Gera o Token JWT
    dados_cracha = {"sub": form_data.username}
    token = jwt.encode(dados_cracha, SECRET_KEY, algorithm=ALGORITHM)

    # 6. Entrega o token E os dados do perfil que o React precisa para a saudação
    return {
        "access_token": token, 
        "token_type": "bearer",
        "usuario": {
            "nome": nome_db,
            "sexo": sexo_db
        }
    }