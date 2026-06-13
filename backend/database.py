import sqlite3

def criar_tabelas():
    conexao = sqlite3.connect('financeiro.db')
    cursor = conexao.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            sexo TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            admin INTEGER DEFAULT 0
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS boletos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fornecedor TEXT NOT NULL,
            valor REAL NOT NULL,
            vencimento DATE NOT NULL,
            codigo_barras TEXT,
            status TEXT NOT NULL DEFAULT 'Pendente',
            categoria TEXT,
            usuario_id INTEGER,
            criado_em TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fornecedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            cnpj TEXT,
            telefone TEXT,
            email TEXT,
            criado_em TEXT DEFAULT (datetime('now', 'localtime'))
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS auditoria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            acao TEXT NOT NULL,
            entidade TEXT NOT NULL,
            entidade_id INTEGER,
            usuario_id INTEGER,
            detalhes TEXT,
            criado_em TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        )
    ''')

    conexao.commit()
    conexao.close()

def migrar():
    """Adiciona colunas que podem não existir em bancos antigos."""
    conexao = sqlite3.connect('financeiro.db')
    cursor = conexao.cursor()

    migracoes = [
        ("ALTER TABLE usuarios ADD COLUMN admin INTEGER DEFAULT 0", "admin"),
        ("ALTER TABLE boletos ADD COLUMN categoria TEXT", "categoria"),
        ("ALTER TABLE boletos ADD COLUMN criado_em TEXT DEFAULT (datetime('now', 'localtime'))", "criado_em"),
    ]

    for sql, coluna in migracoes:
        try:
            cursor.execute(sql)
        except sqlite3.OperationalError:
            pass

    conexao.commit()
    conexao.close()

if __name__ == "__main__":
    criar_tabelas()
    migrar()
    print("Banco de dados atualizado com sucesso!")