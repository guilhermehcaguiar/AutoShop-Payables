import React, { useState } from 'react';

function App() {
  // ==============================================================================
  // ESTADOS
  // ==============================================================================
  const [estaLogado, setEstaLogado] = useState(false);
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [usuarioPerfil, setUsuarioPerfil] = useState({ nome: '', sexo: '' });
  const [boletos, setBoletos] = useState([]);

  // ==============================================================================
  // FUNÇÃO DE AUTENTICAÇÃO
  // ==============================================================================
  const lidarComLogin = async (e) => {
    e.preventDefault();
    setErro(''); 

    // O FastAPI (OAuth2PasswordRequestForm) exige os dados no formato x-www-form-urlencoded
    const dadosFormulario = new URLSearchParams();
    dadosFormulario.append('username', username);
    dadosFormulario.append('password', senha);

    try {
      const resposta = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: dadosFormulario,
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        // Guarda as informações reais recuperadas do banco SQLite
        setUsuarioPerfil({
          nome: dados.usuario.nome,
          sexo: dados.usuario.sexo
        });
        
        // Armazena o token de segurança no navegador
        localStorage.setItem('token', dados.access_token);
        
        // Libera a entrada no painel principal
        setEstaLogado(true);
      } else {
        setErro(dados.detail || 'Usuário ou senha incorretos.');
      }
    } catch (error) {
      setErro('Não foi possível conectar ao servidor de banco de dados.');
    }
  };

  // ==============================================================================
  // RENDERIZAÇÃO DA TELA DE LOGIN
  // ==============================================================================
  if (!estaLogado) {
    return (
      <div className="min-h-screen bg-atend-bg flex items-center justify-center font-sans px-4">
        
        {/* Caixa de Login Glassmorphism */}
        <div className="w-full max-w-md bg-atend-card border border-atend-border p-8 rounded-2xl shadow-2xl relative overflow-hidden">
          
          {/* Neon */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-atend-verde shadow-[0_0_15px_#2ecc71]"></div>
          
          {/* Logo */}
          <div className="text-center mb-8">
            <span className="text-4xl inline-block mb-3"></span>
            <h1 className="text-xl font-black tracking-wide uppercase text-white">
              FINANCEIRO <span className="text-atend-verde">ATEND-CAR</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">Restrito para a Gestão Financeira</p>
          </div>

          {/* Form */}
          <form onSubmit={lidarComLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Usuário:
              </label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: gui"
                className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Senha:
              </label>
              <input 
                type="password" 
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••"
                className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors"
                required
              />
            </div>

            {/* Alerta de erro*/}
            {erro && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg p-3 text-center animate-pulse">
                ⚠️ {erro}
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-atend-verde hover:opacity-90 text-slate-950 font-bold uppercase tracking-wider text-xs py-3.5 rounded-lg transition-all shadow-lg shadow-atend-verde/10 mt-2"
            >
              Login
            </button>
          </form>

        </div>
      </div>
    );
  }

  // ==============================================================================
  // RENDERIZAÇÃO DO DASHBOARD PRINCIPAL
  // ==============================================================================
  return (
    <div className="min-h-screen bg-atend-bg text-slate-100 font-sans">
      
      {/* CABEÇALHO (HEADER) */}
      <header className="border-b border-atend-border bg-atend-card/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔧</span>
            <div>
              <h1 className="text-xl font-bold tracking-wide uppercase text-white">
                FINANCEIRO <span className="text-atend-verde">ATEND-CAR</span>
              </h1>
              <p className="text-xs text-slate-400">Painel de Gestão Financeira</p>
            </div>
          </div>
          <button 
            onClick={() => setEstaLogado(false)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded-md transition-colors border border-slate-700"
          >
            Sair
          </button>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Tratamento dinâmico de Gênero e Nome real vindos do banco */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-sm text-slate-400">
              {usuarioPerfil.sexo === 'M' ? 'Bem-vindo de volta,' : 'Bem-vinda de volta,'}
            </p>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {usuarioPerfil.nome}
            </h2>
          </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Período Atual</p>
          <p className="text-sm font-medium text-atend-verde">
            {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase())}
          </p>
        </div>
        </div>

        {/* CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          
          {/* Card 1: Total Pago */}
          <div className="relative overflow-hidden rounded-xl border border-atend-border bg-atend-card p-6 shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-atend-verde/50 to-transparent"></div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Pago</span>
              <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide bg-atend-verde/10 text-atend-verde border border-atend-verde/20">Mês Atual</span>
            </div>
            <span className="text-3xl font-extrabold tracking-tight text-white">R$ 0,00</span>
          </div>

          {/* Card 2: A Pagar */}
          <div className="relative overflow-hidden rounded-xl border border-atend-border bg-atend-card p-6 shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total a Pagar</span>
              <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-400 border border-amber-500/20">Em aberto</span>
            </div>
            <span className="text-3xl font-extrabold tracking-tight text-white">R$ 0,00</span>
          </div>

          {/* Card 3: Vencendo Hoje */}
          <div className="relative overflow-hidden rounded-xl border border-atend-border bg-atend-card p-6 shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-rose-500/50 to-transparent"></div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vencendo Hoje</span>
              <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide bg-rose-500/10 text-rose-400 border border-rose-500/20">Atenção</span>
            </div>
            <span className="text-3xl font-extrabold tracking-tight text-white">R$ 0,00</span>
          </div>

        </div>

        {/* SEÇÃO DA TABELA DE BOLETOS */}
        <div className="rounded-xl border border-atend-border bg-atend-card overflow-hidden shadow-2xl">
          <div className="px-6 py-5 border-b border-atend-border flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white">Contas a Pagar</h3>
              <p className="text-xs text-slate-400">Listagem de boletos da Atend-Car</p>
            </div>
            <button className="bg-atend-verde hover:opacity-90 text-slate-950 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all shadow-lg shadow-atend-verde/10">
              + Novo Boleto
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-atend-border bg-slate-900/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">Fornecedor / Descrição</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Vencimento</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-atend-border/50 text-sm text-slate-300">
                
                {/* Verificação Inteligente: Exibe mensagem limpa se a lista estiver vazia */}
                {boletos.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-slate-500 italic bg-slate-900/10">
                      📦 Nenhum boleto cadastrado no período atual.
                    </td>
                  </tr>
                ) : (
                  // Mapeamento dinâmico preparado para receber o futuro fetch do back-end
                  boletos.map((boleto) => (
                    <tr key={boleto.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{boleto.fornecedor}</td>
                      <td className="px-6 py-4">R$ {boleto.valor.toFixed(2)}</td>
                      <td className="px-6 py-4 text-slate-400">{boleto.vencimento}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          boleto.status === 'Pago' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {boleto.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {boleto.status !== 'Pago' && (
                          <button className="text-xs font-semibold text-atend-verde hover:opacity-80 border border-atend-verde/30 bg-atend-verde/5 px-3 py-1 rounded transition-all">
                            Dar Baixa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}

              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;