"""Testes de integração — rodam dentro de transação com rollback automático."""

class TestHealth:
    def test_root_retorna_mensagem(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert "mensagem" in resp.json()

class TestUsuarios:
    def test_criar_usuario(self, client):
        resp = client.post("/usuarios/", json={
            "nome": "Novo", "sexo": "M", "username": "novo_user", "senha": "s123",
        })
        assert resp.status_code == 200
        assert resp.json()["mensagem"] == "Usuário criado com sucesso!"

    def test_criar_usuario_username_duplicado(self, client, token_admin):
        resp = client.post("/usuarios/", json={
            "nome": "X", "sexo": "F", "username": "admin_1", "senha": "x",
        })
        assert resp.status_code == 400

    def test_perfil_sem_token_retorna_401(self, client):
        assert client.get("/usuarios/me").status_code == 401

    def test_perfil_com_token_retorna_dados(self, client, token_admin):
        resp = client.get("/usuarios/me", headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200
        assert resp.json()["username"].startswith("admin_")

    def test_usuario_nao_admin_nao_acessa_admin(self, client, token_user):
        resp = client.get("/admin/usuarios/", headers={"Authorization": f"Bearer {token_user}"})
        assert resp.status_code == 403

class TestLogin:
    def test_login_sucesso(self, client):
        client.post("/usuarios/", json={
            "nome": "L", "sexo": "M", "username": "login_ok", "senha": "s123",
        })
        resp = client.post("/login", data={"username": "login_ok", "password": "s123"})
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_login_senha_errada(self, client):
        client.post("/usuarios/", json={
            "nome": "L2", "sexo": "M", "username": "login_fail", "senha": "s123",
        })
        resp = client.post("/login", data={"username": "login_fail", "password": "x"})
        assert resp.status_code == 400

    def test_login_usuario_inexistente(self, client):
        resp = client.post("/login", data={"username": "nao_existe", "password": "x"})
        assert resp.status_code == 400

class TestBoletos:
    def test_criar_e_listar(self, client, token_admin):
        resp = client.post("/boletos/", json={
            "fornecedor": "Fornecedor Teste", "valor": 150.50,
            "vencimento": "2026-07-15", "categoria": "Teste",
        }, headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200
        boleto_id = resp.json()["id"]

        resp = client.get("/boletos/", headers={"Authorization": f"Bearer {token_admin}"})
        assert boleto_id in [b["id"] for b in resp.json()]

    def test_editar_boleto(self, client, token_admin):
        resp = client.post("/boletos/", json={
            "fornecedor": "F", "valor": 100, "vencimento": "2026-08-01", "categoria": "T",
        }, headers={"Authorization": f"Bearer {token_admin}"})
        boleto_id = resp.json()["id"]

        resp = client.put(f"/boletos/{boleto_id}", json={"valor": 200},
            headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200

    def test_pagar_boleto(self, client, token_admin):
        resp = client.post("/boletos/", json={
            "fornecedor": "F", "valor": 100, "vencimento": "2026-06-30", "categoria": "T",
        }, headers={"Authorization": f"Bearer {token_admin}"})
        boleto_id = resp.json()["id"]

        resp = client.patch(f"/boletos/{boleto_id}/pagar", json={
            "metodo_pagamento": "Pix", "banco": "Nubank",
        }, headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200

    def test_soft_delete(self, client, token_admin):
        resp = client.post("/boletos/", json={
            "fornecedor": "F", "valor": 50, "vencimento": "2026-09-10", "categoria": "T",
        }, headers={"Authorization": f"Bearer {token_admin}"})
        boleto_id = resp.json()["id"]

        client.delete(f"/boletos/{boleto_id}", headers={"Authorization": f"Bearer {token_admin}"})

        resp = client.get("/boletos/", headers={"Authorization": f"Bearer {token_admin}"})
        assert boleto_id not in [b["id"] for b in resp.json()]

    def test_notificacoes(self, client, token_admin):
        resp = client.get("/boletos/notificacoes", headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200
        for chave in ("vence_hoje", "atrasados", "pendentes"):
            assert chave in resp.json()

class TestFornecedores:
    def test_criar_e_listar(self, client, token_admin):
        resp = client.post("/fornecedores/", json={"nome": "Fornecedor Ltda"},
            headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200
        assert "id" in resp.json()

        resp = client.get("/fornecedores/", headers={"Authorization": f"Bearer {token_admin}"})
        nomes = [f["nome"] for f in resp.json()]
        assert "Fornecedor Ltda" in nomes

class TestAdmin:
    def test_listar_usuarios(self, client, token_admin):
        resp = client.get("/admin/usuarios/", headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200
        usuarios = resp.json()
        assert any(u["username"].startswith("admin_") for u in usuarios)

    def test_nao_admin_bloqueado(self, client, token_user):
        resp = client.get("/admin/usuarios/", headers={"Authorization": f"Bearer {token_user}"})
        assert resp.status_code == 403

class TestRelatorios:
    def test_mensal(self, client, token_admin):
        resp = client.get("/relatorio/mensal?ano=2026&mes=01",
            headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200
        for chave in ("total_pago", "total_pendente"):
            assert chave in resp.json()

    def test_categorias(self, client, token_admin):
        resp = client.get("/relatorio/categorias?ano=2026&mes=01",
            headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_evolucao_mensal(self, client, token_admin):
        resp = client.get("/boletos/evolucao-mensal",
            headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

class TestMetas:
    def test_criar_e_listar(self, client, token_admin):
        resp = client.post("/metas/", json={"categoria": "Meta Teste", "limite_mensal": 5000},
            headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200

        resp = client.get("/metas/", headers={"Authorization": f"Bearer {token_admin}"})
        assert isinstance(resp.json(), list)

class TestRecorrentes:
    def test_criar_e_listar(self, client, token_admin):
        resp = client.post("/boletos/recorrentes", json={
            "fornecedor": "Recorrente Ltda", "valor": 300,
            "vencimento_dia": 15, "categoria": "Assinatura",
        }, headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200
        assert "id" in resp.json()

        resp = client.get("/boletos/recorrentes",
            headers={"Authorization": f"Bearer {token_admin}"})
        assert isinstance(resp.json(), list)

class TestAuditoria:
    def test_listar(self, client, token_admin):
        resp = client.get("/auditoria/", headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

class TestCategorias:
    def test_categorias_utilizadas(self, client, token_admin):
        resp = client.get("/boletos/categorias-utilizadas",
            headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_bancos_utilizados(self, client, token_admin):
        resp = client.get("/boletos/bancos-utilizados",
            headers={"Authorization": f"Bearer {token_admin}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
