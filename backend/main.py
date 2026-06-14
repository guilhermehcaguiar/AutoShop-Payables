from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from passlib.context import CryptContext

from database import get_connection, Base, engine
import jwt
import os
import csv
import io
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from database import migrar
migrar()

app = FastAPI()

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

class UsuarioCreate(BaseModel):
    nome: str
    sexo: str
    username: str
    senha: str

class UsuarioUpdate(BaseModel):
    nome: str | None = None
    username: str | None = None
    admin: int | None = None

class BoletoCreate(BaseModel):
    fornecedor: str
    valor: float
    vencimento: str
    codigo_barras: str | None = None
    categoria: str | None = None

class BoletoUpdate(BaseModel):
    fornecedor: str | None = None
    valor: float | None = None
    vencimento: str | None = None
    codigo_barras: str | None = None
    categoria: str | None = None

class BoletoPagarLote(BaseModel):
    ids: list[int]

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

    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, nome, sexo, admin FROM usuarios WHERE username = %s", (username,))
    usuario = cursor.fetchone()
    conexao.close()

    if not usuario:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")

    return {"id": usuario[0], "nome": usuario[1], "sexo": usuario[2], "admin": usuario[3]}


def get_admin_logado(usuario: dict = Depends(get_usuario_logado)):
    if not usuario.get("admin"):
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador")
    return usuario


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
def excluir_usuario(usuario_id: int, admin: dict = Depends(get_admin_logado)):
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
def listar_usuarios(admin: dict = Depends(get_admin_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, nome, sexo, username, admin FROM usuarios ORDER BY id")
    usuarios = []
    for linha in cursor.fetchall():
        usuarios.append({"id": linha[0], "nome": linha[1], "sexo": linha[2], "username": linha[3], "admin": bool(linha[4])})
    conexao.close()
    return usuarios


@app.put("/admin/usuarios/{usuario_id}")
def atualizar_usuario(usuario_id: int, dados: UsuarioUpdate, admin: dict = Depends(get_admin_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id FROM usuarios WHERE id = %s", (usuario_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    campos = []
    valores = []
    if dados.nome is not None:
        campos.append("nome = %s"); valores.append(dados.nome)
    if dados.username is not None:
        campos.append("username = %s"); valores.append(dados.username)
    if dados.admin is not None:
        campos.append("admin = %s"); valores.append(dados.admin)
    if campos:
        valores.append(usuario_id)
        cursor.execute(f"UPDATE usuarios SET {', '.join(campos)} WHERE id = %s", valores)
        conexao.commit()
    conexao.close()
    registrar_auditoria("editar", "usuario", usuario_id, admin["id"], f"Campos alterados: {', '.join(campos)}")
    return {"mensagem": "Usuário atualizado com sucesso!"}




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
        campos.append("nome = %s"); valores.append(dados.nome)
    if dados.cnpj is not None:
        campos.append("cnpj = %s"); valores.append(dados.cnpj)
    if dados.telefone is not None:
        campos.append("telefone = %s"); valores.append(dados.telefone)
    if dados.email is not None:
        campos.append("email = %s"); valores.append(dados.email)
    if campos:
        valores.append(fornecedor_id)
        cursor.execute(f"UPDATE fornecedores SET {', '.join(campos)} WHERE id = %s", valores)
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
        SELECT id, fornecedor, valor, vencimento, codigo_barras, status, usuario_id, categoria, criado_em
        FROM boletos ORDER BY vencimento ASC
    """)
    boletos = []
    for linha in cursor.fetchall():
        boletos.append({
            "id": linha[0], "fornecedor": linha[1], "valor": linha[2],
            "vencimento": linha[3], "codigo_barras": linha[4], "status": linha[5],
            "usuario_id": linha[6], "categoria": linha[7], "criado_em": linha[8]
        })
    conexao.close()
    return boletos


@app.post("/boletos/")
def criar_boleto(boleto: BoletoCreate, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    try:
        cursor.execute("""
            INSERT INTO boletos (fornecedor, valor, vencimento, codigo_barras, status, categoria, usuario_id)
            VALUES (%s, %s, %s, %s, 'Pendente', %s, %s)
            RETURNING id
        """, (boleto.fornecedor, boleto.valor, boleto.vencimento, boleto.codigo_barras, boleto.categoria, usuario["id"]))
        boleto_id = cursor.fetchone()[0]
        conexao.commit()
    except Exception as e:
        conexao.close()
        raise HTTPException(status_code=400, detail=f"Erro ao cadastrar boleto: {e}")
    conexao.close()
    registrar_auditoria("criar", "boleto", boleto_id, usuario["id"], f"Boleto {boleto.fornecedor} R$ {boleto.valor}")
    return {"mensagem": "Boleto cadastrado com sucesso!", "id": boleto_id}


@app.put("/boletos/{boleto_id}")
def editar_boleto(boleto_id: int, dados: BoletoUpdate, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id FROM boletos WHERE id = %s", (boleto_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Boleto não encontrado")
    campos = []
    valores = []
    if dados.fornecedor is not None:
        campos.append("fornecedor = %s"); valores.append(dados.fornecedor)
    if dados.valor is not None:
        campos.append("valor = %s"); valores.append(dados.valor)
    if dados.vencimento is not None:
        campos.append("vencimento = %s"); valores.append(dados.vencimento)
    if dados.codigo_barras is not None:
        campos.append("codigo_barras = %s"); valores.append(dados.codigo_barras)
    if dados.categoria is not None:
        campos.append("categoria = %s"); valores.append(dados.categoria)
    if campos:
        valores.append(boleto_id)
        cursor.execute(f"UPDATE boletos SET {', '.join(campos)} WHERE id = %s", valores)
        conexao.commit()
    conexao.close()
    registrar_auditoria("editar", "boleto", boleto_id, usuario["id"], f"Campos alterados: {', '.join(campos)}")
    return {"mensagem": "Boleto atualizado com sucesso!"}


@app.patch("/boletos/{boleto_id}/pagar")
def pagar_boleto(boleto_id: int, usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id FROM boletos WHERE id = %s", (boleto_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Boleto não encontrado")
    cursor.execute("UPDATE boletos SET status = 'Pago' WHERE id = %s", (boleto_id,))
    conexao.commit()
    conexao.close()
    registrar_auditoria("pagar", "boleto", boleto_id, usuario["id"], "Boleto pago")
    return {"mensagem": "Boleto marcado como pago!"}


@app.post("/boletos/pagar-lote")
def pagar_boletos_lote(dados: BoletoPagarLote, usuario: dict = Depends(get_usuario_logado)):
    if not dados.ids:
        raise HTTPException(status_code=400, detail="Nenhum boleto selecionado")
    conexao = get_connection()
    cursor = conexao.cursor()
    placeholders = ",".join("%s" for _ in dados.ids)
    cursor.execute(f"UPDATE boletos SET status = 'Pago' WHERE id IN ({placeholders})", tuple(dados.ids))
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
    cursor.execute("SELECT id FROM boletos WHERE id = %s", (boleto_id,))
    if not cursor.fetchone():
        conexao.close()
        raise HTTPException(status_code=404, detail="Boleto não encontrado")
    cursor.execute("DELETE FROM boletos WHERE id = %s", (boleto_id,))
    conexao.commit()
    conexao.close()
    registrar_auditoria("excluir", "boleto", boleto_id, usuario["id"], "Boleto excluído")
    return {"mensagem": "Boleto excluído com sucesso!"}


@app.get("/boletos/notificacoes")
def notificacoes(usuario: dict = Depends(get_usuario_logado)):
    hoje = datetime.now().strftime("%Y-%m-%d")
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT COUNT(*) FROM boletos WHERE vencimento = %s AND status != 'Pago'", (hoje,))
    vence_hoje = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM boletos WHERE vencimento < %s AND status != 'Pago'", (hoje,))
    atrasados = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM boletos WHERE status != 'Pago'")
    pendentes = cursor.fetchone()[0]
    conexao.close()
    return {"vence_hoje": vence_hoje, "atrasados": atrasados, "pendentes": pendentes}


@app.get("/boletos/exportar-csv")
def exportar_csv(usuario: dict = Depends(get_usuario_logado)):
    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("SELECT id, fornecedor, valor, vencimento, codigo_barras, status, categoria, criado_em FROM boletos ORDER BY vencimento")
    linhas = cursor.fetchall()
    conexao.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Fornecedor", "Valor", "Vencimento", "Código Barras", "Status", "Categoria", "Criado em"])
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
    cursor.execute("SELECT DISTINCT categoria FROM boletos WHERE categoria IS NOT NULL AND categoria != '' ORDER BY categoria")
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
        WHERE vencimento >= %s AND vencimento < %s AND status = 'Pago'
    """, (inicio, fim))
    total_pago = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COALESCE(SUM(valor), 0) FROM boletos
        WHERE vencimento >= %s AND vencimento < %s AND status != 'Pago'
    """, (inicio, fim))
    total_pendente = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COALESCE(COUNT(*), 0) FROM boletos
        WHERE vencimento >= %s AND vencimento < %s
    """, (inicio, fim))
    total_boletos = cursor.fetchone()[0]

    conexao.close()
    return {"ano": ano, "mes": mes, "total_pago": total_pago, "total_pendente": total_pendente, "total_boletos": total_boletos}


@app.get("/relatorio/fornecedores")
def relatorio_fornecedores(ano: int, mes: int, usuario: dict = Depends(get_usuario_logado)):
    inicio = f"{ano:04d}-{mes:02d}-01"
    if mes == 12:
        fim = f"{ano+1:04d}-01-01"
    else:
        fim = f"{ano:04d}-{mes+1:02d}-01"

    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("""
        SELECT fornecedor, COALESCE(SUM(valor), 0), COUNT(*)
        FROM boletos WHERE vencimento >= %s AND vencimento < %s
        GROUP BY fornecedor ORDER BY SUM(valor) DESC
    """, (inicio, fim))
    dados = [{"fornecedor": l[0], "total": l[1], "quantidade": l[2]} for l in cursor.fetchall()]
    conexao.close()
    return dados


@app.get("/relatorio/categorias")
def relatorio_categorias(ano: int, mes: int, usuario: dict = Depends(get_usuario_logado)):
    inicio = f"{ano:04d}-{mes:02d}-01"
    if mes == 12:
        fim = f"{ano+1:04d}-01-01"
    else:
        fim = f"{ano:04d}-{mes+1:02d}-01"

    conexao = get_connection()
    cursor = conexao.cursor()
    cursor.execute("""
        SELECT COALESCE(categoria, 'Sem categoria'), COALESCE(SUM(valor), 0), COUNT(*)
        FROM boletos WHERE vencimento >= %s AND vencimento < %s
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