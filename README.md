# AutoShop Payables

Sistema de gestão financeira desenvolvido para a oficina **Atend-Car**. Controle completo de contas a pagar, boletos, fornecedores e relatórios.

---

## Funcionalidades

- **Gestão de Boletos**: Cadastro, edição, pagamento (individual e em lote) e exclusão
- **Dashboard**: Cards com total pago, total a pagar e vencimentos do dia
- **Fornecedores**: Cadastro e gestão de fornecedores com CNPJ, telefone e e-mail
- **Relatórios**: Visão mensal por fornecedor e por categoria
- **Auditoria**: Histórico completo de todas as ações do sistema
- **Administração**: Gerenciamento de usuários e permissões
- **Temas**: Suporte a tema escuro, claro e sistema
- **Exportação**: Exportar boletos para CSV
- **Notificações**: Alertas de boletos vencendo hoje e atrasados

---

## Tecnologias

**Backend:**
- Python 3.x
- FastAPI
- SQLite
- JWT (PyJWT)
- Passlib (BCrypt)

**Frontend:**
- React 19
- Vite
- Tailwind CSS v4

---

## Instalação e Execução

### 1. Clone o repositório
```bash
git clone https://github.com/guilhermehcaguiar/AutoShop-Payables.git
cd AutoShop-Payables
```

### 2. Backend
```bash
cd backend
pip install -r requirements.txt
```

Crie o arquivo `.env` com a chave secreta:
```env
SECRET_KEY=sua_chave_secreta_aqui
```

Execute o backend:
```bashs
python -m uvicorn main:app --reload --port ，8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5173` no navegador.

---

## Acesso Padrão

| Usuário | Senha | Tipo |
|----------|--------|------|
| user | 123 | Admin |

---

## Estrutura do Projeto

```
AutoShop-Payables/
├── backend/
│   ├── main.py          - API FastAPI
│   ├── database.py       - Schema e migrações SQLite
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx       - Aplicação principal
│   │   ├── index.css     - Config Tailwind e temas
│   │   └── components/   - Componentes React
│   └── public/fonts/     - Fonte Sonic Extra Bold
└── README.md
```

---

## Contato

Projeto desenvolvido por Guilherme Aguiar para gestão financeira da **Atend-Car**.
