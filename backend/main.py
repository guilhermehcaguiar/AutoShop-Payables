from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, validator
from passlib.context import CryptContext
from database import get_connection, Base, engine, migrar, Config
from jose import JWTError, ExpiredSignatureError, jwt
import os
import csv
import io
import smtplib
import json
import zipfile
import tempfile
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formatdate
from dotenv import load_dotenv
from calendar import monthrange
from apscheduler.schedulers.background import BackgroundScheduler

load_dotenv()
migrar()

def backup_job():
    if not BACKUP_SCHEDULED:
        print("[BACKUP] BACKUP_SCHEDULED=false, pulando backup agendado.")
        return
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT valor FROM config WHERE chave = 'backup_auto'")
        row = cur.fetchone()
        cur.close()
        conn.close()
        ativo = row and row[0] == 'true'
        if not ativo:
            print("[BACKUP] backup_auto desativado na config, pulando.")
            return
    except Exception as e:
        print(f"[BACKUP] Erro ao verificar config: {e}")
        return
    if not all([SMTP_SERVER, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM, EMAIL_TO_BACKUP]):
        print("[BACKUP] SMTP incompleto, pulando backup agendado.")
        return
    try:
        executar_backup_agendado(admin_id=0)
        print("[BACKUP] Backup automático executado com sucesso.")
    except Exception as e:
        print(f"[BACKUP] Erro no backup automático: {e}")

scheduler = BackgroundScheduler()
scheduler.add_job(backup_job, 'cron', day_of_week='sun', hour=0, minute=0)
scheduler.start()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

SMTP_SERVER = os.getenv("SMTP_SERVER", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "")
EMAIL_TO_BACKUP = os.getenv("EMAIL_TO_BACKUP", "")
BACKUP_SCHEDULED = os.getenv("BACKUP_SCHEDULED", "false").lower() == "true"

class UsuarioCreate(BaseModel):
    nome: str
    sexo: str
    username: str
    senha: str

class UsuarioUpdate(BaseModel):
    nome: str | None = None
    username: str | None = None
    admin: int | None = None

class AlterarSenha(BaseModel):
    senha_atual: str
    senha_nova: str

class FornecedorCreate(BaseModel):
    nome: str
    cnpj: str | None = None
    telefone: str | None = None
    email: str | None = None

class FornecedorUpdate(BaseModel):
    nome: str | None = None
    cnpj: str | None = None
    telefone: str | None = None
    email: str | None = None

class FornecedorCreateBackup(BaseModel):
    id: int | None = None
    nome: str
    cnpj: str | None = None
    telefone: str | None = None
    email: str | None = None

class BoletoCreate(BaseModel):
    fornecedor: str
    valor: float
    vencimento: str
    codigo_barras: str = ''
    categoria: str
    descricao: str | None = None
    metodo_pagamento: str | None = None
    banco: str | None = None

    @validator("categoria", pre=True, always=True)
    def cat_nao_vazio(cls, v):
        if not v or (isinstance(v, str) and v.strip() == ""):
            raise ValueError("Categoria não pode estar vazia")
        return v.strip()

class BoletoUpdate(BaseModel):
    fornecedor: str | None = None
    valor: float | None = None
    vencimento: str | None = None
    codigo_barras: str | None = None
    categoria: str | None = None
    descricao: str | None = None
    metodo_pagamento: str | None = None
    banco: str | None = None

    @validator("categoria", pre=True, always=True)
    def cat_nao_vazio_opt(cls, v):
        if v is not None and (not v or (isinstance(v, str) and v.strip() == "")):
            raise ValueError("Categoria não pode estar vazia")
        return v.strip() if isinstance(v, str) else v

class BoletoCreateBackup(BaseModel):
    fornecedor: str
    valor: float
    vencimento: str | None = None
    codigo_barras: str | None = None
    categoria: str
    descricao: str | None = None
    metodo_pagamento: str | None = None
    banco: str | None = None
    status: str | None = "Pendente"

class BoletoPagarLote(BaseModel):
    ids: list[int]

class PagarBoleto(BaseModel):
    metodo_pagamento: str | None = None
    banco: str | None = None

class BackupPayload(BaseModel):
    boletos: list[BoletoCreateBackup] | None = []
    fornecedores: list[FornecedorCreateBackup] | None = []

class MesclarCategorias(BaseModel):
    nome_antigo: str
    nome_novo: str

class MetaCreate(BaseModel):
    categoria: str
    limite_mensal: float

class ModeloRecorrenteCreate(BaseModel):
    fornecedor: str
    valor: float
    vencimento_dia: int
    categoria: str
    descricao: str | None = None
    metodo_pagamento: str | None = None
    banco: str | None = None

class CriarLoteInput(BaseModel):
    boletos: list[BoletoCreate]

SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"

def get_usuario_logado(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Token inválido")
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, nome, sexo, admin FROM usuarios WHERE username = %s", (username,))
    usuario = cursor.fetchone()
    conexao.close()

    if not usuario:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")

    return {"id": usuario[0], "nome": usuario[1], "sexo": usuario[2], "admin": usuario[3]}

security_bearer = HTTPBearer()

def get_current_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token inválido")
    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token expirado")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token inválido")

    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, nome, sexo, admin FROM usuarios WHERE username = %s", (username,))
    usuario = cursor.fetchone()
    conexao.close()

    if not usuario:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário não encontrado")

    if not usuario[3]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito ao administrador")

    return {"id": usuario[0], "nome": usuario[1], "sexo": usuario[2], "admin": usuario[3]}

def registrar_auditoria(acao, entidade, entidade_id, usuario_id, detalhes=""):
    try:
        conexao = get_connection()
        cursor = conexao.cursor()
        cursor.execute(
            "INSERT INTO auditoria (acao, entidade, entidade_id, usuario_id, detalhes) VALUES (%s, %s, %s, %s, %s)",
            (acao, entidade, entidade_id, usuario_id, detalhes)
        )
        conexao.commit()
        conexao.close()
    except Exception:
        pass

@app.get("/")
def root():
    return {"mensagem": "API Financeiro Atend-Car rodando!", "docs": "/docs"}

@app.post("/usuarios/")
def criar_usuario(usuario: UsuarioCreate):
    senha_criptografada = pwd_context.hash(usuario.senha)
    conexao = get_connection()
    cursor = conexao.cursor()
    try:
        cursor.execute(
            "INSERT INTO usuarios (nome, sexo, username, senha) VALUES (%s, %s, %s, %s) RETURNING id",
            (usuario.nome, usuario.sexo, usuario.username, senha_criptografada)
        )
        usuario_id = cursor.fetchone()[0]
        conexao.commit()
    except Exception as e:
        conexao.close()
        raise HTTPException(status_code=400, detail=f"Erro de cadastro: {e}")
    conexao.close()
    registrar_auditoria("criar", "usuario", usuario_id, usuario_id, f"Usuário {usuario.username} criado")
    return {"mensagem": "Usuário criado com sucesso!"}

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, senha, nome, sexo, admin FROM usuarios WHERE username = %s", (form_data.username,))
    usuario_db = cursor.fetchone()
    conexao.close()

    if not usuario_db:
        raise HTTPException(status_code=400, detail="Usuário ou senha incorretos")

    usuario_id, senha_criptografada_db, nome_db, sexo_db, admin_db = usuario_db

    if not pwd_context.verify(form_data.password, senha_criptografada_db):
        raise HTTPException(status_code=400, detail="Usuário ou senha incorretos")

    dados_cracha = {"sub": form_data.username}
    token = jwt.encode(dados_cracha, SECRET_KEY, algorithm=ALGORITHM)

    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": {"nome": nome_db, "sexo": sexo_db, "admin": bool(admin_db)}
    }

@app.get("/usuarios/me")
def perfil_usuario(usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, nome, sexo, username, admin FROM usuarios WHERE id = %s", (usuario["id"],))
    dados = cursor.fetchone()
    conexao.close()
    return {"id": dados[0], "nome": dados[1], "sexo": dados[2], "username": dados[3], "admin": bool(dados[4])}

@app.delete("/usuarios/{usuario_id}")
def excluir_usuario(usuario_id: int, admin: dict = Depends(get_current_admin_user)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id FROM usuarios WHERE id = %s", (usuario_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if usuario_id == admin["id"]:
        conexao.close()
        raise HTTPException(status_code=400, detail="Você não pode excluir seu próprio usuário")
    cursor.execute("DELETE FROM usuarios WHERE id = %s", (usuario_id,))
    conexao.commit()
    conexao.close()
    registrar_auditoria("excluir", "usuario", usuario_id, admin["id"], f"Usuário ID {usuario_id} excluído")
    return {"mensagem": "Usuário excluído com sucesso!"}

@app.patch("/usuarios/alterar-senha")
def alterar_senha(dados: AlterarSenha, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT senha FROM usuarios WHERE id = %s", (usuario["id"],))
    senha_criptografada_db = cursor.fetchone()[0]
    if not pwd_context.verify(dados.senha_atual, senha_criptografada_db):
        conexao.close()
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    senha_nova_cripto = pwd_context.hash(dados.senha_nova)
    cursor.execute("UPDATE usuarios SET senha = %s WHERE id = %s", (senha_nova_cripto, usuario["id"]))
    conexao.commit()
    conexao.close()
    return {"mensagem": "Senha alterada com sucesso!"}

@app.get("/admin/usuarios/")
def listar_usuarios(admin: dict = Depends(get_current_admin_user)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, nome, sexo, username, admin FROM usuarios ORDER BY id")
    usuarios = []
    for linha in cursor.fetchall():
        usuarios.append({"id": linha[0], "nome": linha[1], "sexo": linha[2], "username": linha[3], "admin": bool(linha[4])})
    conexao.close()
    return usuarios

@app.put("/admin/usuarios/{usuario_id}")
def atualizar_usuario(usuario_id: int, dados: UsuarioUpdate, admin: dict = Depends(get_current_admin_user)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id FROM usuarios WHERE id = %s", (usuario_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    campos = []
    valores = []
    if dados.nome is not None:
        campos.append("nome = %s")
        valores.append(dados.nome)
    if dados.username is not None:
        campos.append("username = %s")
        valores.append(dados.username)
    if dados.admin is not None:
        campos.append("admin = %s")
        valores.append(dados.admin)
    if campos:
        valores.append(usuario_id)
        query = "UPDATE usuarios SET " + ", ".join(campos) + " WHERE id = %s"
        cursor.execute(query, valores)
        conexao.commit()
    conexao.close()
    registrar_auditoria("editar", "usuario", usuario_id, admin["id"], f"Campos alterados: {', '.join(campos)}")
    return {"mensagem": "Usuário updated com sucesso!"}

@app.get("/fornecedores/")
def listar_fornecedores(usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, nome, cnpj, telefone, email, criado_em FROM fornecedores ORDER BY nome")
    fornecedores = []
    for linha in cursor.fetchall():
        fornecedores.append({"id": linha[0], "nome": linha[1], "cnpj": linha[2], "telefone": linha[3], "email": linha[4], "criado_em": linha[5]})
    conexao.close()
    return fornecedores

@app.post("/fornecedores/")
def criar_fornecedor(dados: FornecedorCreate, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    try:
        cursor.execute("INSERT INTO fornecedores (nome, cnpj, telefone, email) VALUES (%s, %s, %s, %s) RETURNING id",
                       (dados.nome, dados.cnpj, dados.telefone, dados.email))
        for_id = cursor.fetchone()[0]
        conexao.commit()
    except Exception as e:
        conexao.close()
        raise HTTPException(status_code=400, detail=f"Erro ao criar fornecedor: {e}")
    conexao.close()
    registrar_auditoria("criar", "fornecedor", for_id, usuario["id"], f"Fornecedor {dados.nome}")
    return {"mensagem": "Fornecedor cadastrado com sucesso!", "id": for_id}

@app.put("/fornecedores/{fornecedor_id}")
def atualizar_fornecedor(fornecedor_id: int, dados: FornecedorUpdate, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id FROM fornecedores WHERE id = %s", (fornecedor_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    campos = []
    valores = []
    if dados.nome is not None:
        campos.append("nome = %s")
        valores.append(dados.nome)
    if dados.cnpj is not None:
        campos.append("cnpj = %s")
        valores.append(dados.cnpj)
    if dados.telefone is not None:
        campos.append("telefone = %s")
        valores.append(dados.telefone)
    if dados.email is not None:
        campos.append("email = %s")
        valores.append(dados.email)
    if campos:
        valores.append(fornecedor_id)
        query = "UPDATE fornecedores SET " + ", ".join(campos) + " WHERE id = %s"
        cursor.execute(query, valores)
        conexao.commit()
    conexao.close()
    return {"mensagem": "Fornecedor atualizado com sucesso!"}

@app.delete("/fornecedores/{fornecedor_id}")
def excluir_fornecedor(fornecedor_id: int, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id FROM fornecedores WHERE id = %s", (fornecedor_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    cursor.execute("DELETE FROM fornecedores WHERE id = %s", (fornecedor_id,))
    conexao.commit()
    conexao.close()
    registrar_auditoria("excluir", "fornecedor", fornecedor_id, usuario["id"], "")
    return {"mensagem": "Fornecedor excluído com sucesso!"}

@app.get("/boletos/")
def listar_boletos(usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("""
        SELECT id, fornecedor, valor, vencimento, codigo_barras, status, usuario_id, categoria, criado_em, descricao, metodo_pagamento, banco, data_pagamento, pago_por
        FROM boletos WHERE deletado_em IS NULL ORDER BY vencimento ASC
    """)
    boletos = []
    for linha in cursor.fetchall():
        boletos.append({
            "id": linha[0], "fornecedor": linha[1], "valor": linha[2],
            "vencimento": linha[3], "codigo_barras": linha[4], "status": linha[5],
            "usuario_id": linha[6], "categoria": linha[7], "criado_em": linha[8],
            "descricao": linha[9], "metodo_pagamento": linha[10], "banco": linha[11],
            "data_pagamento": linha[12], "pago_por": linha[13]
        })
    conexao.close()
    return boletos

@app.post("/boletos/")
def criar_boleto(boleto: BoletoCreate, background_tasks: BackgroundTasks, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    try:
        cursor.execute("SELECT id FROM boletos WHERE codigo_barras = %s AND deletado_em IS NULL", (boleto.codigo_barras,))
        if cursor.fetchone():
            conexao.close()
            raise HTTPException(status_code=400, detail="Já existe um boleto cadastrado com este código de barras")

        cursor.execute("""
            INSERT INTO boletos (fornecedor, valor, vencimento, codigo_barras, status, categoria, usuario_id, descricao, metodo_pagamento, banco)
            VALUES (%s, %s, %s, %s, 'Pendente', %s, %s, %s, %s, %s)
            RETURNING id
        """, (boleto.fornecedor, boleto.valor, boleto.vencimento, boleto.codigo_barras,
              boleto.categoria, usuario["id"], boleto.descricao, boleto.metodo_pagamento, boleto.banco))
        boleto_id = cursor.fetchone()[0]
        conexao.commit()
    except HTTPException:
        raise
    except Exception as e:
        conexao.close()
        raise HTTPException(status_code=400, detail=f"Erro ao cadastrar boleto: {e}")
    conexao.close()
    background_tasks.add_task(registrar_auditoria, "criar", "boleto", boleto_id, usuario["id"], f"Boleto {boleto.fornecedor} R$ {boleto.valor}")
    return {"mensagem": "Boleto cadastrado com sucesso!", "id": boleto_id}

@app.put("/boletos/{boleto_id}")
def editar_boleto(boleto_id: int, dados: BoletoUpdate, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id FROM boletos WHERE id = %s AND deletado_em IS NULL", (boleto_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Boleto não encontrado")

    campos = []
    valores = []
    if dados.fornecedor is not None:
        campos.append("fornecedor = %s")
        valores.append(dados.fornecedor)
    if dados.valor is not None:
        campos.append("valor = %s")
        valores.append(dados.valor)
    if dados.vencimento is not None:
        campos.append("vencimento = %s")
        valores.append(dados.vencimento)
    if dados.codigo_barras is not None:
        campos.append("codigo_barras = %s")
        valores.append(dados.codigo_barras)
    if dados.categoria is not None:
        campos.append("categoria = %s")
        valores.append(dados.categoria)
    if dados.descricao is not None:
        campos.append("descricao = %s")
        valores.append(dados.descricao)
    if dados.metodo_pagamento is not None:
        campos.append("metodo_pagamento = %s")
        valores.append(dados.metodo_pagamento)
    if dados.banco is not None:
        campos.append("banco = %s")
        valores.append(dados.banco)
    if campos:
        valores.append(boleto_id)
        query = "UPDATE boletos SET " + ", ".join(campos) + " WHERE id = %s"
        cursor.execute(query, valores)
        conexao.commit()
    conexao.close()
    registrar_auditoria("editar", "boleto", boleto_id, usuario["id"], f"Campos alterados: {', '.join(campos)}")
    return {"mensagem": "Boleto atualizado com sucesso!"}

@app.patch("/boletos/{boleto_id}/pagar")
def pagar_boleto(boleto_id: int, dados: PagarBoleto = None, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id FROM boletos WHERE id = %s AND deletado_em IS NULL", (boleto_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Boleto não encontrado")
    if dados is not None:
        cursor.execute("UPDATE boletos SET status = 'Pago', metodo_pagamento = %s, banco = %s, data_pagamento = NOW(), pago_por = %s WHERE id = %s",
            (dados.metodo_pagamento, dados.banco, usuario["id"], boleto_id))
    else:
        cursor.execute("UPDATE boletos SET status = 'Pago', data_pagamento = NOW(), pago_por = %s WHERE id = %s",
            (usuario["id"], boleto_id))
    conexao.commit()
    conexao.close()
    registrar_auditoria("pagar", "boleto", boleto_id, usuario["id"], "Boleto pago")
    return {"mensagem": "Boleto marcado como pago!"}

@app.post("/boletos/pagar-lote")
def pagar_boletos_lote(dados: BoletoPagarLote, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    if not dados.ids:
        raise HTTPException(status_code=400, detail="Nenhum boleto selecionado")
    placeholders = ",".join(["%s"] * len(dados.ids))
    cursor.execute("UPDATE boletos SET status = 'Pago', data_pagamento = NOW(), pago_por = %s WHERE id IN ({}) AND deletado_em IS NULL".format(placeholders),
        (usuario["id"], *tuple(dados.ids)))
    conexao.commit()
    linhas_afetadas = cursor.rowcount
    conexao.close()
    for bid in dados.ids:
        registrar_auditoria("pagar", "boleto", bid, usuario["id"], "Pago em lote")
    return {"mensagem": f"{linhas_afetadas} boletos marcados como pagos!"}

@app.delete("/boletos/{boleto_id}")
def excluir_boleto(boleto_id: int, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id FROM boletos WHERE id = %s AND deletado_em IS NULL", (boleto_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Boleto não encontrado")
    cursor.execute("UPDATE boletos SET deletado_em = NOW() WHERE id = %s", (boleto_id,))
    conexao.commit()
    conexao.close()
    registrar_auditoria("excluir", "boleto", boleto_id, usuario["id"], "Boleto excluído (soft delete)")
    return {"mensagem": "Boleto excluído com sucesso!"}

@app.get("/boletos/notificacoes")
def notificacoes(usuario: dict = Depends(get_usuario_logado)):
    hoje = datetime.now().strftime("%Y-%m-%d")
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT COUNT(*) FROM boletos WHERE vencimento = %s AND status != 'Pago' AND deletado_em IS NULL", (hoje,))
    vence_hoje = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM boletos WHERE vencimento < %s AND status != 'Pago' AND deletado_em IS NULL", (hoje,))
    atrasados = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM boletos WHERE status != 'Pago' AND deletado_em IS NULL")
    pendentes = cursor.fetchone()[0]
    conexao.close()
    return {"vence_hoje": vence_hoje, "atrasados": atrasados, "pendentes": pendentes}

@app.get("/boletos/exportar-csv")
def exportar_csv(usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, fornecedor, valor, vencimento, codigo_barras, status, categoria, criado_em, descricao, metodo_pagamento, banco FROM boletos WHERE deletado_em IS NULL ORDER BY vencimento")
    linhas = cursor.fetchall()
    conexao.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Fornecedor", "Valor", "Vencimento", "Código Barras", "Status", "Categoria", "Criado em", "Descrição", "Método Pagamento", "Banco"])
    for linha in linhas:
        writer.writerow(linha)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=boletos_{datetime.now().strftime('%Y%m')}.csv"}
    )

@app.get("/categorias/")
def listar_categorias(usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT DISTINCT categoria FROM boletos WHERE categoria IS NOT NULL AND categoria != '' AND deletado_em IS NULL ORDER BY categoria")
    categorias = [linha[0] for linha in cursor.fetchall()]
    conexao.close()
    return categorias

@app.get("/relatorio/mensal")
def relatorio_mensal(ano: int, mes: int, usuario: dict = Depends(get_usuario_logado)):
    inicio = f"{ano:04d}-{mes:02d}-01"
    if mes == 12:
        fim = f"{ano+1:04d}-01-01"
    else:
        fim = f"{ano:04d}-{mes+1:02d}-01"

    conexao = get_connection()
    cursor = conexao.cursor()

    cursor.execute("""
        SELECT COALESCE(SUM(valor), 0) FROM boletos
        WHERE vencimento >= %s AND vencimento < %s AND status = 'Pago' AND deletado_em IS NULL
    """, (inicio, fim))
    total_pago = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COALESCE(SUM(valor), 0) FROM boletos
        WHERE vencimento >= %s AND vencimento < %s AND status != 'Pago' AND deletado_em IS NULL
    """, (inicio, fim))
    total_pendente = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COALESCE(COUNT(*), 0) FROM boletos
        WHERE vencimento >= %s AND vencimento < %s AND deletado_em IS NULL
    """, (inicio, fim))
    total_boletos = cursor.fetchone()[0]

    conexao.close()
    return {"ano": ano, "mes": mes, "total_pago": total_pago, "total_pendente": total_pendente, "total_boletos": total_boletos}

@app.get("/relatorio/fornecedores")
def relatorio_fornecedores(ano: int, mes: int, status: str | None = None, usuario: dict = Depends(get_usuario_logado)):
    inicio = f"{ano:04d}-{mes:02d}-01"
    if mes == 12:
        fim = f"{ano+1:04d}-01-01"
    else:
        fim = f"{ano:04d}-{mes+1:02d}-01"

    conexao = get_connection()
    cursor = conexao.cursor()
    if status:
        cursor.execute("""
            SELECT fornecedor, COALESCE(SUM(valor), 0), COUNT(*)
            FROM boletos WHERE vencimento >= %s AND vencimento < %s AND status = %s AND deletado_em IS NULL
            GROUP BY fornecedor ORDER BY SUM(valor) DESC
        """, (inicio, fim, status))
    else:
        cursor.execute("""
            SELECT fornecedor, COALESCE(SUM(valor), 0), COUNT(*)
            FROM boletos WHERE vencimento >= %s AND vencimento < %s AND deletado_em IS NULL
            GROUP BY fornecedor ORDER BY SUM(valor) DESC
        """, (inicio, fim))
    dados = [{"fornecedor": l[0], "total": l[1], "quantidade": l[2]} for l in cursor.fetchall()]
    conexao.close()
    return dados

@app.get("/relatorio/categorias")
def relatorio_categorias(ano: int, mes: int, status: str | None = None, usuario: dict = Depends(get_usuario_logado)):
    inicio = f"{ano:04d}-{mes:02d}-01"
    if mes == 12:
        fim = f"{ano+1:04d}-01-01"
    else:
        fim = f"{ano:04d}-{mes+1:02d}-01"

    conexao = get_connection()
    cursor = conexao.cursor()
    if status:
        cursor.execute("""
            SELECT COALESCE(categoria, 'Sem categoria'), COALESCE(SUM(valor), 0), COUNT(*)
            FROM boletos WHERE vencimento >= %s AND vencimento < %s AND status = %s AND deletado_em IS NULL
            GROUP BY categoria ORDER BY SUM(valor) DESC
        """, (inicio, fim, status))
    else:
        cursor.execute("""
            SELECT COALESCE(categoria, 'Sem categoria'), COALESCE(SUM(valor), 0), COUNT(*)
            FROM boletos WHERE vencimento >= %s AND vencimento < %s AND deletado_em IS NULL
            GROUP BY categoria ORDER BY SUM(valor) DESC
        """, (inicio, fim))
    dados = [{"categoria": l[0], "total": l[1], "quantidade": l[2]} for l in cursor.fetchall()]
    conexao.close()
    return dados

@app.get("/auditoria/")
def listar_auditoria(usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("""
        SELECT a.id, a.acao, a.entidade, a.entidade_id, a.usuario_id, a.detalhes, a.criado_em, u.nome
        FROM auditoria a LEFT JOIN usuarios u ON a.usuario_id = u.id
        ORDER BY a.id DESC LIMIT 200
    """)
    registros = []
    for linha in cursor.fetchall():
        registros.append({
            "id": linha[0], "acao": linha[1], "entidade": linha[2],
            "entidade_id": linha[3], "usuario_id": linha[4],
            "detalhes": linha[5], "criado_em": linha[6], "usuario_nome": linha[7]
        })
    conexao.close()
    return registros

@app.get("/boletos/bancos-utilizados")
def bancos_utilizados(usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT DISTINCT banco FROM boletos WHERE banco IS NOT NULL AND deletado_em IS NULL ORDER BY banco")
    bancos = [linha[0] for linha in cursor.fetchall()]
    conexao.close()
    return bancos

@app.get("/boletos/categorias-utilizadas")
def categorias_utilizadas(usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT DISTINCT categoria FROM boletos WHERE categoria IS NOT NULL AND deletado_em IS NULL ORDER BY categoria")
    categorias = [linha[0] for linha in cursor.fetchall()]
    conexao.close()
    return categorias

@app.patch("/boletos/{boleto_id}/desfazer-pagamento")
def desfazer_pagamento(boleto_id: int, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, status FROM boletos WHERE id = %s AND deletado_em IS NULL", (boleto_id,))
    boleto = cursor.fetchone()
    if not boleto:
        conexao.close()
        raise HTTPException(status_code=404, detail="Boleto não encontrado")
    if boleto[1] != "Pago":
        conexao.close()
        raise HTTPException(status_code=400, detail="Apenas boletos com status 'Pago' podem ter o pagamento desfeito")
    cursor.execute(
        "UPDATE boletos SET status = 'Pendente', metodo_pagamento = NULL, banco = NULL, data_pagamento = NULL, pago_por = NULL WHERE id = %s",
        (boleto_id,)
    )
    conexao.commit()
    conexao.close()
    registrar_auditoria("desfazer_pagamento", "boleto", boleto_id, usuario["id"], "Pagamento desfeito")
    return {"mensagem": "Pagamento desfeito com sucesso! Boleto retornou para 'Pendente'."}

@app.get("/boletos/projecao-fluxo")
def projecao_fluxo(
    ano: int | None = None,
    mes: int | None = None,
    dia_inicio: int | None = None,
    dia_fim: int | None = None,
    usuario: dict = Depends(get_usuario_logado)
):
    hoje = datetime.now()
    ano_alvo = ano if ano is not None else hoje.year
    mes_alvo = mes if mes is not None else hoje.month

    _, ultimo_dia = monthrange(ano_alvo, mes_alvo)

    d_inicio = dia_inicio if dia_inicio is not None else 1
    d_fim = dia_fim if dia_fim is not None else ultimo_dia

    def data_str(d):
        return f"{ano_alvo:04d}-{mes_alvo:02d}-{d:02d}"

    conexao = get_connection()
    cursor = conexao.cursor()

    semanas = [
        ("Semana 1", 1, 7),
        ("Semana 2", 8, 14),
        ("Semana 3", 15, 21),
        ("Semana 4", 22, ultimo_dia),
    ]

    resultado = {}

    for nome_semana, s1, s2 in semanas:
        if s1 > ultimo_dia:
            continue
        s2_real = min(s2, ultimo_dia)
        if s2_real < d_inicio or s1 > d_fim:
            continue
        dt_inicio = data_str(max(s1, d_inicio))
        dt_fim = data_str(min(s2_real, d_fim) + 1)
        cursor.execute(
            """
            SELECT COALESCE(categoria, 'Sem categoria'), COALESCE(SUM(valor), 0), COUNT(*)
            FROM boletos
            WHERE vencimento >= %s AND vencimento < %s AND status = 'Pendente' AND deletado_em IS NULL
            GROUP BY categoria ORDER BY categoria
            """,
            (dt_inicio, dt_fim)
        )
        categorias = [{"categoria": l[0], "total": l[1], "quantidade": l[2]} for l in cursor.fetchall()]
        resultado[nome_semana] = categorias

    for offset, nome_mes in [(1, "Mês 2"), (2, "Mês 3")]:
        mes_prox = mes_alvo + offset
        ano_prox = ano_alvo
        while mes_prox > 12:
            mes_prox -= 12
            ano_prox += 1
        _, ultimo_dia_prox = monthrange(ano_prox, mes_prox)
        inicio_prox = f"{ano_prox:04d}-{mes_prox:02d}-01"
        fim_prox = f"{ano_prox:04d}-{mes_prox:02d}-{ultimo_dia_prox + 1:02d}" if mes_prox < 12 else f"{ano_prox + 1:04d}-01-01"
        cursor.execute(
            """
            SELECT COALESCE(categoria, 'Sem categoria'), COALESCE(SUM(valor), 0), COUNT(*)
            FROM boletos
            WHERE vencimento >= %s AND vencimento < %s AND status = 'Pendente' AND deletado_em IS NULL
            GROUP BY categoria ORDER BY categoria
            """,
            (inicio_prox, fim_prox)
        )
        categorias = [{"categoria": l[0], "total": l[1], "quantidade": l[2]} for l in cursor.fetchall()]
        resultado[nome_mes] = categorias

    conexao.close()
    return resultado

@app.get("/metas/")
def listar_metas(usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, categoria, limite_mensal FROM metas_categorias ORDER BY categoria")
    metas = [{"id": l[0], "categoria": l[1], "limite_mensal": float(l[2])} for l in cursor.fetchall()]
    conexao.close()
    return metas

@app.post("/metas/")
def salvar_meta(dados: MetaCreate, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    try:
        cursor = conexao.cursor()
        cursor.execute(
            """
            INSERT INTO metas_categorias (categoria, limite_mensal)
            VALUES (%s, %s)
            ON CONFLICT (categoria) DO UPDATE SET limite_mensal = EXCLUDED.limite_mensal
            RETURNING id, categoria, limite_mensal
            """,
            (dados.categoria.strip(), dados.limite_mensal)
        )
        meta = cursor.fetchone()
        conexao.commit()
        return {"id": meta[0], "categoria": meta[1], "limite_mensal": float(meta[2])}
    except Exception as e:
        conexao.rollback()
        raise HTTPException(status_code=400, detail=f"Erro ao salvar meta: {e}")
    finally:
        conexao.close()

@app.post("/admin/mesclar-categorias")
def mesclar_categorias(dados: MesclarCategorias, admin: dict = Depends(get_current_admin_user)):
    conexao = get_connection()
    try:
        cursor = conexao.cursor()
        cursor.execute(
            "UPDATE boletos SET categoria = %s WHERE categoria = %s",
            (dados.nome_novo, dados.nome_antigo)
        )
        conexao.commit()
        registrar_auditoria(
            "mesclar_categorias", "boleto", 0, admin["id"],
            f"Categoria '{dados.nome_antigo}' mesclada para '{dados.nome_novo}'"
        )
        return {"mensagem": "Categorias mescladas com sucesso!"}
    except Exception as e:
        conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Falha ao mesclar categorias: {e}")
    finally:
        conexao.close()

@app.post("/admin/restaurar-backup")
def restaurar_backup(payload: BackupPayload, admin: dict = Depends(get_current_admin_user)):
    payload_bytes = json.dumps(payload.dict()).encode("utf-8")
    if len(payload_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Arquivo maior que 5MB não é permitido.")

    conexao = get_connection()
    try:
        cursor = conexao.cursor()
        if payload.boletos:
            for b in payload.boletos:
                boleto_dict = b.dict()
                boleto_dict = {k: v for k, v in boleto_dict.items() if v is not None}
                campos = list(boleto_dict.keys())
                valores = list(boleto_dict.values())
                placeholders = ",".join(["%s"] * len(campos))
                cursor.execute(f"INSERT INTO boletos ({', '.join(campos)}) VALUES ({placeholders})", tuple(valores))
        if payload.fornecedores:
            for f in payload.fornecedores:
                forn_dict = f.dict()
                forn_dict.pop("id", None)
                forn_dict = {k: v for k, v in forn_dict.items() if v is not None}
                campos = list(forn_dict.keys())
                valores = list(forn_dict.values())
                placeholders = ",".join(["%s"] * len(campos))
                cursor.execute(f"INSERT INTO fornecedores ({', '.join(campos)}) VALUES ({placeholders})", tuple(valores))
        conexao.commit()
        registrar_auditoria("restaurar_backup", "sistema", 0, admin["id"], "Backup restaurado com sucesso")
        return {"mensagem": "Backup restaurado com sucesso!"}
    except Exception as e:
        conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Falha ao restaurar backup: {e}")
    finally:
        conexao.close()

@app.get("/admin/backup-status")
def backup_status(admin: dict = Depends(get_current_admin_user)):
    smtp_ok = all([SMTP_SERVER, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM, EMAIL_TO_BACKUP])
    ativo = False
    try:
        conexao = get_connection()
        cursor = conexao.cursor()
        cursor.execute("SELECT valor FROM config WHERE chave = 'backup_auto'")
        row = cursor.fetchone()
        cursor.close()
        conexao.close()
        ativo = row and row[0] == 'true'
    except:
        pass
    return {"ativo": ativo, "smtp_configurado": smtp_ok}

@app.post("/admin/backup-toggle")
def backup_toggle(admin: dict = Depends(get_current_admin_user)):
    try:
        conexao = get_connection()
        cursor = conexao.cursor()
        cursor.execute("SELECT valor FROM config WHERE chave = 'backup_auto'")
        row = cursor.fetchone()
        novo_valor = "false" if (row and row[0] == 'true') else "true"
        cursor.execute("UPDATE config SET valor = %s WHERE chave = 'backup_auto'", (novo_valor,))
        conexao.commit()
        cursor.close()
        conexao.close()
        registrar_auditoria("backup_toggle", "sistema", 0, admin["id"], f"Backup automático alternado para {novo_valor}")
        return {"ativo": novo_valor == "true"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao alternar backup: {e}")

def executar_backup_agendado(admin_id: int = 0):
    agora = datetime.now()
    data_str = agora.strftime("%Y-%m-%d_%H-%M-%S")
    nome_arquivo = f"backup_atendcar_{data_str}.zip"

    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute(
        "SELECT id, fornecedor, valor, vencimento, codigo_barras, status, usuario_id, categoria, criado_em, descricao, metodo_pagamento, banco, data_pagamento, pago_por FROM boletos WHERE deletado_em IS NULL"
    )
    boletos = cursor.fetchall()
    colunas_boleto = [desc[0] for desc in cursor.description]

    cursor.execute("SELECT id, nome, cnpj, telefone, email, criado_em FROM fornecedores")
    fornecedores = cursor.fetchall()
    colunas_forn = [desc[0] for desc in cursor.description]
    conexao.close()

    csv_boleto = io.StringIO()
    writer_boleto = csv.writer(csv_boleto)
    writer_boleto.writerow(colunas_boleto)
    for row in boletos:
        writer_boleto.writerow(row)
    conteudo_boleto = csv_boleto.getvalue()

    csv_forn = io.StringIO()
    writer_forn = csv.writer(csv_forn)
    writer_forn.writerow(colunas_forn)
    for row in fornecedores:
        writer_forn.writerow(row)
    conteudo_forn = csv_forn.getvalue()

    with tempfile.TemporaryDirectory() as tmpdir:
        caminho_zip = os.path.join(tmpdir, nome_arquivo)
        with zipfile.ZipFile(caminho_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.writestr("boletos.csv", conteudo_boleto)
            zipf.writestr("fornecedores.csv", conteudo_forn)
        with open(caminho_zip, "rb") as f:
            dados_zip = f.read()

    agora_texto = agora.strftime("%d/%m/%Y")
    assunto = "📦 [Atend-Car] Backup Semanal Automático - Concluído com Sucesso"
    corpo = f"""Olá, Administrador!
O backup semanal do sistema Atend-Car foi realizado com sucesso.
Em anexo, você encontrará o arquivo contendo todo o histórico de boletos, fornecedores e configurações de metas updated até a data de hoje. Este arquivo serve para a segurança dos seus dados.
- Data do Backup: {agora_texto}
- Status do Servidor: Operando normalmente (Plano Gratuito)
Atenciosamente,
Robô de Backups Atend-Car"""

    try:
        msg = MIMEMultipart()
        msg["From"] = EMAIL_FROM
        msg["To"] = EMAIL_TO_BACKUP
        msg["Subject"] = assunto
        msg["Date"] = formatdate(localtime=True)
        msg.attach(MIMEText(corpo, "plain", "utf-8"))

        part = MIMEBase("application", "octet-stream")
        part.set_payload(dados_zip)
        encoders.encode_base64(part)
        part.add_header(
            "Content-Disposition",
            f"attachment; filename={nome_arquivo}",
        )
        msg.attach(part)

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=15)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(EMAIL_FROM, EMAIL_TO_BACKUP, msg.as_string())
        server.quit()
        email_ok = True
    except Exception as e:
        print(f"[ERRO SMTP] Falha ao enviar e-mail de backup: {e}")
        email_ok = False

    registrar_auditoria("backup_agendado", "sistema", 0, admin_id, "Backup agendado executado com sucesso")
    return email_ok

@app.get("/admin/backup-agendado")
def backup_agendado(admin: dict = Depends(get_current_admin_user)):
    if not BACKUP_SCHEDULED:
        return {"mensagem": "Backup desativado pelo administrador do sistema."}
    try:
        conexao = get_connection()
        cursor = conexao.cursor()
        cursor.execute("SELECT valor FROM config WHERE chave = 'backup_auto'")
        row = cursor.fetchone()
        cursor.close()
        conexao.close()
        ativo = row and row[0] == 'true'
        if not ativo:
            return {"mensagem": "Backup automático desativado nas configurações."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao verificar configuração de backup: {e}")

    if not all([SMTP_SERVER, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM, EMAIL_TO_BACKUP]):
        raise HTTPException(status_code=500, detail="Configurações de SMTP incompletas.")

    try:
        email_ok = executar_backup_agendado(admin_id=admin["id"])
        if email_ok:
            return {"mensagem": "Backup agendado executado e enviado por e-mail com sucesso!"}
        return {"mensagem": "Backup gerado, mas o envio por e-mail falhou. Verifique as configurações SMTP.", "email_enviado": False}
    except Exception as e:
        print(f"[ERRO] Falha no backup agendado: {e}")
        raise HTTPException(status_code=500, detail=f"Falha no backup agendado: {e}")

@app.post("/admin/recuperar-boleto/{boleto_id}")
def recuperar_boleto(boleto_id: int, admin: dict = Depends(get_current_admin_user)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id FROM boletos WHERE id = %s AND deletado_em IS NOT NULL", (boleto_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Boleto não encontrado ou não está excluído")
    cursor.execute("UPDATE boletos SET deletado_em = NULL WHERE id = %s", (boleto_id,))
    conexao.commit()
    conexao.close()
    registrar_auditoria("recuperar", "boleto", boleto_id, admin["id"], "Boleto recuperado da exclusão")
    return {"mensagem": "Boleto recuperado com sucesso!"}

@app.post("/admin/arquivar")
def arquivar_boletos(admin: dict = Depends(get_current_admin_user)):
    conexao = get_connection()
    cursor = conexao.cursor()
    dois_meses_atras_dt = (datetime.now() - timedelta(days=60))

    cursor.execute("""
        INSERT INTO boletos_arquivados (boleto_original_id, fornecedor, valor, vencimento, codigo_barras, status, categoria, usuario_id, descricao, metodo_pagamento, banco, data_pagamento, pago_por, criado_em, arquivado_em)
        SELECT id, fornecedor, valor, vencimento, codigo_barras, status, categoria, usuario_id, descricao, metodo_pagamento, banco, data_pagamento, pago_por, criado_em, NOW()
        FROM boletos WHERE status = 'Pago' AND data_pagamento IS NOT NULL AND data_pagamento < %s AND deletado_em IS NULL
    """, (dois_meses_atras_dt,))
    arquivados = cursor.rowcount

    cursor.execute("""
        DELETE FROM boletos WHERE status = 'Pago' AND data_pagamento IS NOT NULL AND data_pagamento < %s AND deletado_em IS NULL
    """, (dois_meses_atras_dt,))

    conexao.commit()
    conexao.close()
    registrar_auditoria("arquivar", "sistema", 0, admin["id"], f"{arquivados} boletos arquivados automaticamente")
    return {"mensagem": f"{arquivados} boletos arquivados com sucesso!", "arquivados": arquivados}

@app.get("/boletos/arquivados")
def listar_arquivados(usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, boleto_original_id, fornecedor, valor, vencimento, codigo_barras, status, categoria, usuario_id, descricao, metodo_pagamento, banco, data_pagamento, pago_por, criado_em, arquivado_em FROM boletos_arquivados ORDER BY arquivado_em DESC")
    boletos = []
    for linha in cursor.fetchall():
        boletos.append({
            "id": linha[0], "boleto_original_id": linha[1], "fornecedor": linha[2],
            "valor": linha[3], "vencimento": linha[4], "codigo_barras": linha[5],
            "status": linha[6], "categoria": linha[7], "usuario_id": linha[8],
            "descricao": linha[9], "metodo_pagamento": linha[10], "banco": linha[11],
            "data_pagamento": linha[12], "pago_por": linha[13], "criado_em": linha[14],
            "arquivado_em": linha[15]
        })
    conexao.close()
    return boletos

@app.post("/admin/desarquivar/{arquivado_id}")
def desarquivar_boleto(arquivado_id: int, admin: dict = Depends(get_current_admin_user)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT * FROM boletos_arquivados WHERE id = %s", (arquivado_id,))
    linha = cursor.fetchone()
    if not linha:
        conexao.close()
        raise HTTPException(status_code=404, detail="Boleto arquivado não encontrado")
    colunas = [desc[0] for desc in cursor.description]
    dados = dict(zip(colunas, linha))
    cursor.execute("""
        INSERT INTO boletos (fornecedor, valor, vencimento, codigo_barras, status, categoria, usuario_id, descricao, metodo_pagamento, banco, data_pagamento, pago_por, criado_em)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        dados["fornecedor"], dados["valor"], dados["vencimento"], dados["codigo_barras"],
        dados["status"], dados["categoria"], dados["usuario_id"], dados["descricao"],
        dados["metodo_pagamento"], dados["banco"], dados["data_pagamento"], dados["pago_por"],
        dados["criado_em"]
    ))
    cursor.execute("DELETE FROM boletos_arquivados WHERE id = %s", (arquivado_id,))
    conexao.commit()
    conexao.close()
    registrar_auditoria("desarquivar", "boleto", arquivado_id, admin["id"], "Boleto restaurado do arquivo")
    return {"mensagem": "Boleto restaurado do arquivo com sucesso!"}

@app.get("/boletos/excluidos")
def listar_excluidos(admin: dict = Depends(get_current_admin_user)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, fornecedor, valor, vencimento, codigo_barras, status, categoria, usuario_id, descricao, metodo_pagamento, banco, data_pagamento, pago_por, criado_em, deletado_em FROM boletos WHERE deletado_em IS NOT NULL ORDER BY deletado_em DESC")
    boletos = []
    for linha in cursor.fetchall():
        boletos.append({
            "id": linha[0], "fornecedor": linha[1], "valor": linha[2],
            "vencimento": linha[3], "codigo_barras": linha[4], "status": linha[5],
            "categoria": linha[6], "usuario_id": linha[7], "descricao": linha[8],
            "metodo_pagamento": linha[9], "banco": linha[10], "data_pagamento": linha[11],
            "pago_por": linha[12], "criado_em": linha[13], "deletado_em": linha[14]
        })
    conexao.close()
    return boletos

@app.post("/admin/boletos/zerar")
def zerar_mes(admin: dict = Depends(get_current_admin_user)):
    conexao = get_connection()
    cursor = conexao.cursor()
    hoje = datetime.now()
    inicio_mes = f"{hoje.year:04d}-{hoje.month:02d}-01"
    if hoje.month == 12:
        fim_mes = f"{hoje.year + 1:04d}-01-01"
    else:
        fim_mes = f"{hoje.year:04d}-{hoje.month + 1:02d}-01"

    cursor.execute("""
        INSERT INTO boletos_arquivados (boleto_original_id, fornecedor, valor, vencimento, codigo_barras, status, categoria, usuario_id, descricao, metodo_pagamento, banco, data_pagamento, pago_por, criado_em, arquivado_em)
        SELECT id, fornecedor, valor, vencimento, codigo_barras, status, categoria, usuario_id, descricao, metodo_pagamento, banco, data_pagamento, pago_por, criado_em, NOW()
        FROM boletos WHERE deletado_em IS NULL AND vencimento >= %s AND vencimento < %s AND status = 'Pago'
    """, (inicio_mes, fim_mes))
    arquivados = cursor.rowcount
    cursor.execute("DELETE FROM boletos WHERE deletado_em IS NULL AND vencimento >= %s AND vencimento < %s AND status = 'Pago'", (inicio_mes, fim_mes))

    cursor.execute("""
        INSERT INTO boletos_arquivados (boleto_original_id, fornecedor, valor, vencimento, codigo_barras, status, categoria, usuario_id, descricao, metodo_pagamento, banco, data_pagamento, pago_por, criado_em, arquivado_em)
        SELECT id, fornecedor, valor, vencimento, codigo_barras, status, categoria, usuario_id, descricao, metodo_pagamento, banco, data_pagamento, pago_por, criado_em, NOW()
        FROM boletos WHERE deletado_em IS NULL AND vencimento >= %s AND vencimento < %s AND status != 'Pago'
    """, (inicio_mes, fim_mes))
    pendentes = cursor.rowcount
    cursor.execute("DELETE FROM boletos WHERE deletado_em IS NULL AND vencimento >= %s AND vencimento < %s AND status != 'Pago'", (inicio_mes, fim_mes))

    conexao.commit()
    conexao.close()
    registrar_auditoria("zerar_mes", "sistema", 0, admin["id"], f"Mês zerado: {arquivados} pagos arquivados, {pendentes} pendentes removidos")
    return {"mensagem": f"Mês zerado: {arquivados} pagos arquivados, {pendentes} pendentes removidos", "arquivados": arquivados, "removidos": pendentes}

@app.get("/boletos/recorrentes")
def listar_recorrentes(usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, fornecedor, valor, vencimento_dia, categoria, descricao, metodo_pagamento, banco, ativo, criado_em, criado_por FROM modelos_recorrentes ORDER BY fornecedor")
    modelos = []
    for linha in cursor.fetchall():
        modelos.append({
            "id": linha[0], "fornecedor": linha[1], "valor": linha[2],
            "vencimento_dia": linha[3], "categoria": linha[4], "descricao": linha[5],
            "metodo_pagamento": linha[6], "banco": linha[7], "ativo": linha[8],
            "criado_em": linha[9], "criado_por": linha[10]
        })
    conexao.close()
    return modelos

@app.post("/boletos/recorrentes")
def criar_recorrente(dados: ModeloRecorrenteCreate, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("""
        INSERT INTO modelos_recorrentes (fornecedor, valor, vencimento_dia, categoria, descricao, metodo_pagamento, banco, criado_por)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (dados.fornecedor, dados.valor, dados.vencimento_dia, dados.categoria, dados.descricao, dados.metodo_pagamento, dados.banco, usuario["id"]))
    modelo_id = cursor.fetchone()[0]
    conexao.commit()
    conexao.close()
    registrar_auditoria("criar_recorrente", "modelo_recorrente", modelo_id, usuario["id"], f"Modelo {dados.fornecedor} R$ {dados.valor}")
    return {"mensagem": "Modelo recorrente criado com sucesso!", "id": modelo_id}

@app.post("/boletos/recorrentes/{modelo_id}/gerar")
def gerar_boletos_recorrentes(modelo_id: int, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT * FROM modelos_recorrentes WHERE id = %s AND ativo = TRUE", (modelo_id,))
    linha = cursor.fetchone()
    if not linha:
        conexao.close()
        raise HTTPException(status_code=404, detail="Modelo recorrente não encontrado ou inativo")
    colunas = [desc[0] for desc in cursor.description]
    modelo = dict(zip(colunas, linha))

    hoje = datetime.now()
    ano = hoje.year
    mes = hoje.month
    dia = modelo["vencimento_dia"]
    ultimo_dia = monthrange(ano, mes)[1]
    dia_real = min(dia, ultimo_dia)
    vencimento = f"{ano:04d}-{mes:02d}-{dia_real:02d}"

    cursor.execute("SELECT id FROM boletos WHERE fornecedor = %s AND vencimento = %s AND deletado_em IS NULL", (modelo["fornecedor"], vencimento))
    if cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=400, detail="Já existe um boleto deste fornecedor com este vencimento")

    cursor.execute("""
        INSERT INTO boletos (fornecedor, valor, vencimento, codigo_barras, status, categoria, usuario_id, descricao, metodo_pagamento, banco)
        VALUES (%s, %s, %s, '', 'Pendente', %s, %s, %s, %s, %s)
        RETURNING id
    """, (modelo["fornecedor"], modelo["valor"], vencimento, modelo["categoria"], usuario["id"], modelo["descricao"], modelo["metodo_pagamento"], modelo["banco"]))
    boleto_id = cursor.fetchone()[0]
    conexao.commit()
    conexao.close()
    registrar_auditoria("gerar_recorrente", "boleto", boleto_id, usuario["id"], f"Boleto gerado do modelo {modelo_id}")
    return {"mensagem": "Boleto gerado com sucesso!", "id": boleto_id, "vencimento": vencimento}

@app.delete("/boletos/recorrentes/{modelo_id}")
def deletar_recorrente(modelo_id: int, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id FROM modelos_recorrentes WHERE id = %s", (modelo_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Modelo recorrente não encontrado")
    cursor.execute("DELETE FROM modelos_recorrentes WHERE id = %s", (modelo_id,))
    conexao.commit()
    conexao.close()
    registrar_auditoria("deletar_recorrente", "modelo_recorrente", modelo_id, usuario["id"], "Modelo recorrente deletado")
    return {"mensagem": "Modelo recorrente deletado com sucesso!"}

@app.post("/admin/boletos/criar-lote")
def criar_boletos_lote(dados: CriarLoteInput, admin: dict = Depends(get_current_admin_user)):
    conexao = get_connection()
    cursor = conexao.cursor()
    criados = 0
    erros = []
    for i, b in enumerate(dados.boletos):
        try:
            cursor.execute("""
                INSERT INTO boletos (fornecedor, valor, vencimento, codigo_barras, status, categoria, usuario_id, descricao, metodo_pagamento, banco)
                VALUES (%s, %s, %s, %s, 'Pendente', %s, %s, %s, %s, %s)
            """, (b.fornecedor, b.valor, b.vencimento, b.codigo_barras, b.categoria, admin["id"], b.descricao, b.metodo_pagamento, b.banco))
            criados += 1
        except Exception as e:
            erros.append({"indice": i, "fornecedor": b.fornecedor, "erro": str(e)})
    conexao.commit()
    conexao.close()
    registrar_auditoria("criar_lote", "boleto", 0, admin["id"], f"{criados} boletos criados em lote")
    return {"mensagem": f"{criados} boletos criados com sucesso!", "criados": criados, "erros": erros}
