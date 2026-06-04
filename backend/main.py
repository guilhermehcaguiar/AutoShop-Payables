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
    nome: str
    sexo: str
    username: str
    senha: str

class BoletoCreate(BaseModel):
    fornecedor: str
    valor: float
    vencimento: str
    codigo_barras: str | None = None

class BoletoPagarLote(BaseModel):
    ids: list[int]

# 3. Funções Auxiliares

def get_usuario_logado(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Token inválido")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

    conexao = sqlite3.connect("financeiro.db")
    cursor = conexao.cursor()
    cursor.execute("SELECT id, nome, sexo FROM usuarios WHERE username = ?", (username,))
    usuario = cursor.fetchone()
    conexao.close()

    if not usuario:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")

    return {"id": usuario[0], "nome": usuario[1], "sexo": usuario[2]}

# 4. Rotas

@app.get("/")
def root():
    return {"mensagem": "API Financeiro Atend-Car rodando!", "docs": "/docs"}

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


# ==============================================================================
# ROTAS DE BOLETOS
# ==============================================================================

@app.get("/boletos/")
def listar_boletos(usuario: dict = Depends(get_usuario_logado)):
    conexao = sqlite3.connect("financeiro.db")
    cursor = conexao.cursor()
    cursor.execute("""
        SELECT id, fornecedor, valor, vencimento, codigo_barras, status, usuario_id
        FROM boletos
        ORDER BY vencimento ASC
    """)
    linhas = cursor.fetchall()
    conexao.close()

    boletos = []
    for linha in linhas:
        boletos.append({
            "id": linha[0],
            "fornecedor": linha[1],
            "valor": linha[2],
            "vencimento": linha[3],
            "codigo_barras": linha[4],
            "status": linha[5],
            "usuario_id": linha[6]
        })

    return boletos


@app.post("/boletos/")
def criar_boleto(boleto: BoletoCreate, usuario: dict = Depends(get_usuario_logado)):
    conexao = sqlite3.connect("financeiro.db")
    cursor = conexao.cursor()

    try:
        cursor.execute("""
            INSERT INTO boletos (fornecedor, valor, vencimento, codigo_barras, status, usuario_id)
            VALUES (?, ?, ?, ?, 'Pendente', ?)
        """, (boleto.fornecedor, boleto.valor, boleto.vencimento, boleto.codigo_barras, usuario["id"]))
        conexao.commit()
        boleto_id = cursor.lastrowid
    except Exception as e:
        conexao.close()
        raise HTTPException(status_code=400, detail=f"Erro ao cadastrar boleto: {e}")

    conexao.close()
    return {"mensagem": "Boleto cadastrado com sucesso!", "id": boleto_id}


@app.patch("/boletos/{boleto_id}/pagar")
def pagar_boleto(boleto_id: int, usuario: dict = Depends(get_usuario_logado)):
    conexao = sqlite3.connect("financeiro.db")
    cursor = conexao.cursor()

    cursor.execute("SELECT id FROM boletos WHERE id = ?", (boleto_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Boleto não encontrado")

    cursor.execute("UPDATE boletos SET status = 'Pago' WHERE id = ?", (boleto_id,))
    conexao.commit()
    conexao.close()

    return {"mensagem": "Boleto marcado como pago!"}


@app.post("/boletos/pagar-lote")
def pagar_boletos_lote(dados: BoletoPagarLote, usuario: dict = Depends(get_usuario_logado)):
    if not dados.ids:
        raise HTTPException(status_code=400, detail="Nenhum boleto selecionado")

    conexao = sqlite3.connect("financeiro.db")
    cursor = conexao.cursor()

    placeholders = ",".join("?" for _ in dados.ids)
    cursor.execute(f"UPDATE boletos SET status = 'Pago' WHERE id IN ({placeholders})", dados.ids)
    conexao.commit()
    linhas_afetadas = cursor.rowcount
    conexao.close()

    return {"mensagem": f"{linhas_afetadas} boletos marcados como pagos!"}


@app.delete("/boletos/{boleto_id}")
def excluir_boleto(boleto_id: int, usuario: dict = Depends(get_usuario_logado)):
    conexao = sqlite3.connect("financeiro.db")
    cursor = conexao.cursor()

    cursor.execute("SELECT id FROM boletos WHERE id = ?", (boleto_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Boleto não encontrado")

    cursor.execute("DELETE FROM boletos WHERE id = ?", (boleto_id,))
    conexao.commit()
    conexao.close()

    return {"mensagem": "Boleto excluído com sucesso!"}