import sqlite3

def criar_tabelas():
    conexao = sqlite3.connect('financeiro.db')
    cursor = conexao.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS boletos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fornecedor TEXT NOT NULL,
            valor REAL NOT NULL,
            vencimento DATE NOT NULL,
            codigo_barras TEXT,
            status TEXT NOT NULL,
            usuario_id INTEGER,
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        )
    ''')

    conexao.commit()
    conexao.close()

if __name__ == "__main__":
    criar_tabelas()
    print("Banco de dados e tabelas criados com sucesso!")
