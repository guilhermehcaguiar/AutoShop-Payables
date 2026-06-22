import { useState, useMemo, useCallback, useEffect } from 'react';
import { apiFetch } from './api.js';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import ModalNovoBoleto from './components/ModalNovoBoleto';
import ModalAcaoBoleto from './components/ModalAcaoBoleto';
import ModalPagamento from './components/ModalPagamento';
import ConfirmDialog from './components/ConfirmDialog';
import FornecedoresPage from './components/FornecedoresPage';
import RelatoriosPage from './components/RelatoriosPage';
import AuditoriaPage from './components/AuditoriaPage';
import AdminPage from './components/AdminPage';
import MetasPage from './components/MetasPage';
import PaginaPerfil from './components/PaginaPerfil';
import { SkeletonLinha, SkeletonCard } from './components/Skeleton';

function App() {
  // === STATES ===
  const [estaLogado, setEstaLogado] = useState(false);
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [usuarioPerfil, setUsuarioPerfil] = useState({ nome: '', sexo: '' });
  const [boletos, setBoletos] = useState([]);
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState('dashboard');
  const [toast, setToast] = useState({ mensagem: '', tipo: 'sucesso', visivel: false });
  const [modalAberto, setModalAberto] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroDia, setFiltroDia] = useState('');
  const [filtroFornecedor, setFiltroFornecedor] = useState('');
  const [selecionados, setSelecionados] = useState(new Set());
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  });
  const [confirmExcluir, setConfirmExcluir] = useState({ aberto: false, boletoId: null });
  const [carregandoBoletos, setCarregandoBoletos] = useState(false);
  const [tema, setTema] = useState(() => localStorage.getItem('atend-tema') || 'dark');
  const [boletoEditando, setBoletoEditando] = useState(null);
  const [notificacoes, setNotificacoes] = useState(null);
  const [usuarioAdmin, setUsuarioAdmin] = useState(false);
  const [modalAcao, setModalAcao] = useState({ aberto: false, boleto: null });
  const [modalPagamento, setModalPagamento] = useState({ aberto: false, boleto: null });
  const [pg, setPg] = useState(1);
  const porPg = 50;

  // === EFFECTS / API ===
  useEffect(() => {
    const root = document.documentElement;
    if (tema === 'system') {
      const prefereDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefereDark ? 'dark' : 'light');
      const listener = (e) => root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    } else {
      root.setAttribute('data-theme', tema);
    }
    localStorage.setItem('atend-tema', tema);
  }, [tema]);

  const fetchNotificacoes = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const resp = await apiFetch('/boletos/notificacoes', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resp.ok) setNotificacoes(await resp.json());
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchNotificacoes, 0);
    const interval = setInterval(fetchNotificacoes, 30000);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, [fetchNotificacoes]);

  const mostrarToast = useCallback((mensagem, tipo = 'sucesso') => {
    setToast({ mensagem, tipo, visivel: true });
  }, []);

  const fecharToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visivel: false }));
  }, []);

  const lidarComSair = useCallback(() => {
    setEstaLogado(false);
    setSidebarAberta(false);
    setBoletos([]);
    setSelecionados(new Set());
    localStorage.removeItem('token');
    localStorage.removeItem('usuarioPerfil');
  }, []);

  const fetchBoletos = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setCarregandoBoletos(true);
    try {
      const resposta = await apiFetch('/boletos/', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resposta.ok) {
        setBoletos(await resposta.json());
      } else if (resposta.status === 401) {
        lidarComSair();
      }
    } catch {
      mostrarToast('Erro ao carregar boletos', 'erro');
    } finally {
      setCarregandoBoletos(false);
    }
  }, [mostrarToast, lidarComSair]);

  useEffect(() => {
    const t = setTimeout(() => {
      const token = localStorage.getItem('token');
      const perfilSalvo = localStorage.getItem('usuarioPerfil');
      if (token && perfilSalvo) {
        const perfil = JSON.parse(perfilSalvo);
        setUsuarioPerfil(perfil);
        setUsuarioAdmin(perfil.admin || false);
        setEstaLogado(true);
        fetchBoletos();
      }
    }, 0);
    return () => clearTimeout(t);
  }, [fetchBoletos]);

  // === HANDLERS ===
  const lidarComLogin = async (e) => {
    e.preventDefault();
    setErro('');

    const dadosFormulario = new URLSearchParams();
    dadosFormulario.append('username', username);
    dadosFormulario.append('password', senha);

    try {
      const resposta = await apiFetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: dadosFormulario,
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        const perfil = { nome: dados.usuario.nome, sexo: dados.usuario.sexo, admin: dados.usuario.admin };
        setUsuarioPerfil(perfil);
        setUsuarioAdmin(dados.usuario.admin || false);
        localStorage.setItem('token', dados.access_token);
        localStorage.setItem('usuarioPerfil', JSON.stringify(perfil));
        setEstaLogado(true);
        fetchBoletos();
      } else {
        setErro(dados.detail || 'Usuário ou senha incorretos.');
      }
    } catch {
      setErro('Não foi possível conectar ao servidor de banco de dados.');
    }
  };

  const lidarComPagarLote = async () => {
    if (selecionados.size === 0) return;
    const token = localStorage.getItem('token');
    const ids = Array.from(selecionados);
    try {
      const resposta = await apiFetch('/boletos/pagar-lote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ids }),
      });
      if (resposta.ok) {
        setBoletos((prev) =>
          prev.map((b) => (ids.includes(b.id) ? { ...b, status: 'Pago' } : b))
        );
        setSelecionados(new Set());
        mostrarToast(`${ids.length} boletos pagos com sucesso!`);
      }
    } catch {
      mostrarToast('Erro ao pagar boletos', 'erro');
    }
  };

  const lidarComExcluir = async () => {
    const boletoId = confirmExcluir.boletoId;
    if (!boletoId) return;
    const token = localStorage.getItem('token');
    try {
      const resposta = await apiFetch(`/boletos/${boletoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resposta.ok) {
        setBoletos((prev) => prev.filter((b) => b.id !== boletoId));
        setSelecionados((prev) => { const novo = new Set(prev); novo.delete(boletoId); return novo; });
        setConfirmExcluir({ aberto: false, boletoId: null });
        mostrarToast('Boleto excluído com sucesso!');
      }
    } catch {
      mostrarToast('Erro ao excluir boleto', 'erro');
    }
  };

  const lidarComExportarCSV = async () => {
    const token = localStorage.getItem('token');
    try {
      const resp = await apiFetch('/boletos/exportar-csv', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `boletos_${new Date().toISOString().slice(0, 7)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        mostrarToast('CSV exportado com sucesso!');
      }
    } catch { mostrarToast('Erro ao exportar', 'erro'); }
  };

  const toggleSelecionado = (id) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const toggleSelecionarTodos = () => {
    setSelecionados((prev) => {
      if (prev.size === boletosFiltrados.length && boletosFiltrados.length > 0) return new Set();
      return new Set(boletosFiltrados.map((b) => b.id));
    });
  };

  const hoje = new Date().toLocaleDateString('en-CA');

  const fornecedoresDisponiveis = useMemo(() => {
    const set = new Set();
    boletos.forEach((b) => {
      if (b.fornecedor) set.add(b.fornecedor);
    });
    return Array.from(set).sort();
  }, [boletos]);

  const diasDisponiveis = useMemo(() => {
    const set = new Set();
    boletos.forEach((b) => {
      if (b.vencimento && b.vencimento.startsWith(mesSelecionado)) {
        set.add(parseInt(b.vencimento.split('-')[2], 10));
      }
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [boletos, mesSelecionado]);

  const boletosFiltrados = useMemo(() => {
    let lista = boletos.filter((b) => b.vencimento.startsWith(mesSelecionado));
    if (filtroStatus === 'pendentes') lista = lista.filter((b) => b.status !== 'Pago');
    else if (filtroStatus === 'pagos') lista = lista.filter((b) => b.status === 'Pago');
    else if (filtroStatus === 'vencendo') lista = lista.filter((b) => b.vencimento === hoje && b.status !== 'Pago');
    if (filtroDia) {
      lista = lista.filter((b) => parseInt(b.vencimento.split('-')[2], 10) === parseInt(filtroDia, 10));
    }
    if (filtroFornecedor) {
      lista = lista.filter((b) => b.fornecedor === filtroFornecedor);
    }
    return lista.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));
  }, [boletos, mesSelecionado, filtroStatus, filtroDia, filtroFornecedor, hoje]);

  const totalPago = useMemo(
    () => boletos.filter((b) => {
      if (!b.vencimento.startsWith(mesSelecionado)) return false;
      if (filtroDia && parseInt(b.vencimento.split('-')[2], 10) !== parseInt(filtroDia, 10)) return false;
      return b.status === 'Pago';
    }).reduce((s, b) => s + b.valor, 0),
    [boletos, mesSelecionado, filtroDia]
  );

  const totalAPagar = useMemo(
    () => boletos.filter((b) => {
      if (!b.vencimento.startsWith(mesSelecionado)) return false;
      if (filtroDia && parseInt(b.vencimento.split('-')[2], 10) !== parseInt(filtroDia, 10)) return false;
      return b.status !== 'Pago';
    }).reduce((s, b) => s + b.valor, 0),
    [boletos, mesSelecionado, filtroDia]
  );

  const vencendoHoje = useMemo(
    () => boletos.filter((b) => {
      if (b.vencimento !== hoje) return false;
      if (filtroDia && parseInt(b.vencimento.split('-')[2], 10) !== parseInt(filtroDia, 10)) return false;
      return b.status !== 'Pago';
    }).reduce((s, b) => s + b.valor, 0),
    [boletos, hoje, filtroDia]
  );

  const totalExibido = useMemo(
    () => boletosFiltrados.reduce((s, b) => s + b.valor, 0),
    [boletosFiltrados]
  );

  const totalPaginas = Math.max(1, Math.ceil(boletosFiltrados.length / porPg));
  const boletosPg = boletosFiltrados.slice((pg - 1) * porPg, pg * porPg);

  useEffect(() => { const t = setTimeout(() => { if (pg > totalPaginas) setPg(1); }, 0); return () => clearTimeout(t); }, [pg, totalPaginas]);

  const meses = useMemo(() => {
    const lista = [];
    const agora = new Date();
    for (let i = 0; i < 12; i++) {
      const data = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const valor = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      const rotulo = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase());
      lista.push({ valor, rotulo });
    }
    return lista;
  }, []);

  const formatarMoeda = (valor) =>
    `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const abrirModalAcao = (boleto) => {
    setModalAcao({ aberto: true, boleto });
  };

  const fecharModalAcao = () => {
    setModalAcao({ aberto: false, boleto: null });
  };

  const handleEditar = (boleto) => {
    fecharModalAcao();
    setBoletoEditando(boleto);
    setModalAberto(true);
  };

  const handlePagar = (boletoId) => {
    const boleto = boletos.find((b) => b.id === boletoId);
    if (!boleto) return;
    fecharModalAcao();
    setModalPagamento({ aberto: true, boleto });
  };

  const handlePagarConfirmado = (boletoId, metodoPagamento, banco) => {
    setBoletos((prev) =>
      prev.map((b) =>
        b.id === boletoId ? { ...b, status: 'Pago', metodo_pagamento: metodoPagamento, banco } : b
      )
    );
    setModalPagamento({ aberto: false, boleto: null });
    mostrarToast('Boleto pago com sucesso!');
  };

  const handleDesfazerPagamento = async (boletoId) => {
    const token = localStorage.getItem('token');
    try {
      const resp = await apiFetch(`/boletos/${boletoId}/desfazer-pagamento`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resp.ok) {
        setBoletos((prev) =>
          prev.map((b) =>
            b.id === boletoId ? { ...b, status: 'Pendente', metodo_pagamento: null, banco: null } : b
          )
        );
        fecharModalAcao();
        mostrarToast('Pagamento desfeito com sucesso!');
      }
    } catch {
      mostrarToast('Erro ao desfazer pagamento', 'erro');
    }
  };

  const handleDeletar = (boletoId) => {
    fecharModalAcao();
    setConfirmExcluir({ aberto: true, boletoId });
  };

  // === SUB-COMPONENTS ===
  const renderTabelaBoletos = () => (
    <>
      <div className="px-5 py-4 border-b border-atend-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Contas a Pagar</h3>
          <p className="text-xs text-slate-400">Listagem de boletos da Atend-Car</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={lidarComExportarCSV}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-2.5 rounded-lg transition-all duration-200 active:scale-[0.98] focus:outline-none border border-slate-700">
            📥 CSV
          </button>
          <button onClick={() => { setBoletoEditando(null); setModalAberto(true); }}
            className="bg-atend-verde hover:opacity-90 text-slate-950 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg transition-all duration-200 active:scale-[0.98] focus:outline-none shadow-lg shadow-atend-verde/10">
            + Novo Boleto
          </button>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-atend-border flex flex-col sm:flex-row items-center gap-3">
        <div className="flex gap-1 flex-wrap bg-atend-bg p-1 rounded-xl border border-atend-border/50">
          {[
            { chave: 'todos', rotulo: 'Todos', icone: '📋' },
            { chave: 'pendentes', rotulo: 'Pendentes', icone: '⏳' },
            { chave: 'pagos', rotulo: 'Pagos', icone: '✅' },
            { chave: 'vencendo', rotulo: 'Vencendo Hoje', icone: '🔴' },
          ].map(({ chave, rotulo, icone }) => (
            <button
              key={chave}
              onClick={() => { setFiltroStatus(chave); setSelecionados(new Set()); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 active:scale-[0.98] focus:outline-none ${
                filtroStatus === chave
                  ? 'bg-atend-verde/15 text-atend-verde shadow-sm shadow-atend-verde/10'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              <span className="text-[11px]">{icone}</span>
              {rotulo}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-1 sm:justify-end items-center flex-wrap">
          <div className="relative">
            <select
              value={mesSelecionado}
              onChange={(e) => { setMesSelecionado(e.target.value); setSelecionados(new Set()); }}
              className="bg-atend-bg border border-atend-border/50 rounded-lg pl-8 pr-8 py-2 text-xs text-slate-300 focus:outline-none focus:border-atend-verde/60 appearance-none cursor-pointer active:scale-[0.98] bg-[length:14px] bg-[right_8px_center] bg-no-repeat transition-all duration-200"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")` }}
            >
              {meses.map(({ valor, rotulo }) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none">📅</span>
          </div>

          {diasDisponiveis.length > 0 && (
            <div className="relative">
              <select value={filtroDia} onChange={(e) => setFiltroDia(e.target.value)}
                className="bg-atend-bg border border-atend-border/50 rounded-lg pl-8 pr-8 py-2 text-xs text-slate-300 focus:outline-none focus:border-atend-verde/60 appearance-none cursor-pointer active:scale-[0.98] bg-[length:14px] bg-[right_8px_center] bg-no-repeat transition-all duration-200"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")` }}>
                <option value="">Dia</option>
                {diasDisponiveis.map((d) => (
                  <option key={d} value={d}>Dia {d}</option>
                ))}
              </select>
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none">📆</span>
            </div>
          )}

          <div className="relative flex-1 min-w-[140px] max-w-[200px]">
            <select value={filtroFornecedor} onChange={(e) => setFiltroFornecedor(e.target.value)}
              className="w-full bg-atend-bg border border-atend-border/50 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-atend-verde/60 appearance-none cursor-pointer active:scale-[0.98] transition-all duration-200">
              <option value="">Todos fornecedores</option>
              {fornecedoresDisponiveis.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none">🔍</span>
          </div>
        </div>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-atend-border bg-slate-900/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <th className="px-5 py-4 w-10">
                <input
                  type="checkbox"
                  checked={boletosFiltrados.length > 0 && selecionados.size === boletosFiltrados.length}
                  onChange={toggleSelecionarTodos}
                  className="accent-atend-verde w-4 h-4"
                />
              </th>
              <th className="px-5 py-4">Fornecedor / Descrição</th>
              <th className="px-5 py-4">Valor</th>
              <th className="px-5 py-4">Vencimento</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Categoria</th>
              <th className="px-5 py-4">Método</th>
              <th className="px-5 py-4">Banco</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-atend-border/50 text-sm text-slate-300">
            {carregandoBoletos ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonLinha key={i} colunas={8} />)
            ) : boletosFiltrados.length === 0 ? (
              <tr><td colSpan="8" className="px-5 py-12 text-center text-slate-500 bg-slate-900/10">
                <div className="text-2xl mb-2">📦</div>
                <p className="text-sm font-medium text-slate-400">Nenhum boleto cadastrado</p>
                <p className="text-xs text-slate-500 mt-0.5">Neste período ou filtro selecionado</p>
              </td></tr>
            ) : (
              boletosPg.map((boleto) => (
                <tr key={boleto.id}
                  onClick={() => abrirModalAcao(boleto)}
                  className={`cursor-pointer hover:bg-slate-900/20 even:bg-slate-900/10 transition-all duration-150 active:scale-[0.99] ${boleto.vencimento === hoje && boleto.status !== 'Pago' ? 'bg-rose-500/5 even:bg-rose-500/10' : ''}`}>                  
                  <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selecionados.has(boleto.id)}
                      onChange={() => toggleSelecionado(boleto.id)} disabled={boleto.status === 'Pago'}
                      className="accent-atend-verde w-4 h-4 disabled:opacity-30" />
                  </td>
                  <td className="px-5 py-4 font-medium text-white">
                    {boleto.fornecedor}
                    {boleto.descricao && <p className="text-xs text-slate-400 font-normal mt-0.5 truncate max-w-[200px]">{boleto.descricao}</p>}
                  </td>
                  <td className="px-5 py-4">{formatarMoeda(boleto.valor)}</td>
                  <td className="px-5 py-4 text-slate-400">
                    {new Date(boleto.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                    {boleto.vencimento === hoje && boleto.status !== 'Pago' && <span className="ml-2 text-[10px] font-bold text-rose-400 uppercase">Hoje</span>}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      boleto.status === 'Pago' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>{boleto.status}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-400 text-xs">
                    {boleto.categoria ? (
                      <span className="bg-slate-800/50 px-2 py-0.5 rounded text-slate-300">{boleto.categoria}</span>
                    ) : '-'}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {boleto.metodo_pagamento ? (
                      <span className="bg-slate-800/50 px-2 py-0.5 rounded">{boleto.metodo_pagamento}</span>
                    ) : '-'}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {boleto.banco ? (
                      <span className="bg-slate-800/50 px-2 py-0.5 rounded">{boleto.banco}</span>
                    ) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {boletosFiltrados.length > 0 && (
            <tfoot>
              <tr className="border-t border-atend-border bg-slate-900/40 text-sm font-semibold">
                <td colSpan="2" className="px-5 py-4 text-slate-400 uppercase tracking-wider text-xs">Total</td>
                <td className="px-5 py-4 text-white">{formatarMoeda(totalExibido)}</td>
                <td colSpan="5"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="md:hidden space-y-2 p-2">
        {carregandoBoletos ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : boletosFiltrados.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-500">
            <div className="text-2xl mb-1">📦</div>
            <p className="text-sm font-medium text-slate-400">Nenhum boleto cadastrado</p>
          </div>
        ) : (
          boletosPg.map((boleto) => (
            <div key={boleto.id} onClick={() => abrirModalAcao(boleto)}
              className={`rounded-xl border border-atend-border bg-atend-card px-4 py-4 cursor-pointer transition-all duration-200 active:scale-[0.98] hover:border-atend-verde/30 ${boleto.vencimento === hoje && boleto.status !== 'Pago' ? 'border-rose-500/30' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selecionados.has(boleto.id)}
                    onChange={() => toggleSelecionado(boleto.id)} disabled={boleto.status === 'Pago'}
                    className="accent-atend-verde w-4 h-4 disabled:opacity-30" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{boleto.fornecedor}</p>
                  {boleto.descricao && <p className="text-xs text-slate-400 truncate">{boleto.descricao}</p>}
                  <p className="text-lg font-bold text-white mt-0.5">{formatarMoeda(boleto.valor)}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs text-slate-400">
                      {new Date(boleto.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                      {boleto.vencimento === hoje && boleto.status !== 'Pago' && <span className="ml-1.5 text-[10px] font-bold text-rose-400 uppercase">Hoje</span>}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      boleto.status === 'Pago' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>{boleto.status}</span>
                    {boleto.categoria && (
                      <span className="text-[10px] bg-slate-800/50 px-1.5 py-0.5 rounded text-slate-400">{boleto.categoria}</span>
                    )}
                    {boleto.metodo_pagamento && (
                      <span className="text-[10px] bg-slate-800/50 px-1.5 py-0.5 rounded text-slate-400">{boleto.metodo_pagamento}</span>
                    )}
                    {boleto.banco && (
                      <span className="text-[10px] bg-slate-800/50 px-1.5 py-0.5 rounded text-slate-400">{boleto.banco}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        {boletosFiltrados.length > 0 && (
          <div className="rounded-xl border border-atend-border bg-atend-card/80 px-4 py-3">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-slate-400 uppercase tracking-wider text-xs">Total</span>
              <span className="text-white">{formatarMoeda(totalExibido)}</span>
            </div>
          </div>
        )}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4 pb-2">
          <button onClick={() => setPg(pg - 1)} disabled={pg <= 1}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98] focus:outline-none">
            ‹ Anterior
          </button>
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPg(p)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-all duration-200 active:scale-[0.98] focus:outline-none ${p === pg ? 'bg-atend-verde text-slate-950' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'}`}>
              {p}
            </button>
          ))}
          <button onClick={() => setPg(pg + 1)} disabled={pg >= totalPaginas}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98] focus:outline-none">
            Próximo ›
          </button>
        </div>
      )}
    </>
  );

  // === RENDER SUB-COMPONENTS ===

  if (!estaLogado) {
    return (
      <div className="min-h-screen bg-atend-bg flex items-center justify-center font-sans px-4">
        <div className="w-full max-w-md bg-atend-card border border-atend-border p-8 rounded-2xl shadow-2xl relative overflow-hidden animate-fade-in-scale">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-atend-verde shadow-[0_0_15px_#2ecc71]"></div>
          <div className="text-center mb-8">
            <h1 className="text-xl tracking-wide uppercase text-white"
              style={{ fontFamily: "'Sonic Extra Bold', 'Segoe UI', 'Arial Black', system-ui, sans-serif", fontWeight: 900 }}>
              FINANCEIRO <span className="text-atend-verde">ATEND-CAR</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">Restrito para a Gestão Financeira</p>
          </div>
          <form onSubmit={lidarComLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Usuário:</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: user"
                className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Senha:</label>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••"
                className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" required />
            </div>
            {erro && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg p-3 text-center animate-pulse">⚠️ {erro}</div>}
            <button type="submit"
              className="w-full bg-atend-verde hover:opacity-90 active:scale-[0.98] focus:outline-none text-slate-950 font-bold uppercase tracking-wider text-xs py-3.5 rounded-lg transition-all duration-200 shadow-lg shadow-atend-verde/10 mt-2">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-atend-bg text-slate-100 font-sans flex">
      <Sidebar
        aberta={sidebarAberta}
        setAberta={setSidebarAberta}
        paginaAtual={paginaAtual}
        setPaginaAtual={setPaginaAtual}
        onSair={lidarComSair}
        tema={tema}
        onTemaChange={setTema}
        notificacoes={notificacoes}
        usuarioAdmin={usuarioAdmin}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-atend-border bg-atend-card/80 backdrop-blur sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 py-3.5">
            <button
              onClick={() => setSidebarAberta((prev) => !prev)}
              className="text-slate-400 hover:text-white text-xl p-1 active:scale-[0.98] transition-all duration-200"
              aria-label="Abrir menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg tracking-wide uppercase text-white"
              style={{ fontFamily: "'Sonic Extra Bold', 'Segoe UI', 'Arial Black', system-ui, sans-serif", fontWeight: 900 }}>
              FINANCEIRO <span className="text-atend-verde">ATEND-CAR</span>
            </h1>
            <div className="w-6" />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 max-w-7xl w-full mx-auto">
          {paginaAtual === 'dashboard' && (
            <>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
                <div>
                  <p className="text-sm text-slate-400">
                    {usuarioPerfil.sexo === 'M' ? 'Bem-vindo de volta,' : 'Bem-vinda de volta,'}
                  </p>
                  <h2 className="text-2xl font-bold text-white tracking-tight">{usuarioPerfil.nome}</h2>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Hoje</p>
                  <p className="text-sm font-medium text-atend-verde">
                    {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase())}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div onClick={() => { setFiltroStatus(filtroStatus === 'pagos' ? 'todos' : 'pagos'); setSelecionados(new Set()); }}
                  className="group relative overflow-hidden rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer">
                  <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-atend-verde/50 to-transparent ${filtroStatus === 'pagos' ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}></div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Pago</span>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${filtroStatus === 'pagos' ? 'bg-atend-verde/20 text-atend-verde border-atend-verde/40' : 'bg-atend-verde/10 text-atend-verde border-atend-verde/20'}`}>Mês</span>
                  </div>
                  <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${filtroStatus === 'pagos' ? 'text-atend-verde' : 'text-white group-hover:text-atend-verde group-active:text-atend-verde'} transition-colors`}>{formatarMoeda(totalPago)}</span>
                </div>
                <div onClick={() => { setFiltroStatus(filtroStatus === 'pendentes' ? 'todos' : 'pendentes'); setSelecionados(new Set()); }}
                  className="group relative overflow-hidden rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer">
                  <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent ${filtroStatus === 'pendentes' ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}></div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total a Pagar</span>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${filtroStatus === 'pendentes' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>Aberto</span>
                  </div>
                  <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${filtroStatus === 'pendentes' ? 'text-amber-400' : 'text-white group-hover:text-amber-400 group-active:text-amber-400'} transition-colors`}>{formatarMoeda(totalAPagar)}</span>
                </div>
                <div onClick={() => { setFiltroStatus(filtroStatus === 'vencendo' ? 'todos' : 'vencendo'); setSelecionados(new Set()); }}
                  className="group relative overflow-hidden rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer">
                  <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-rose-500/50 to-transparent ${filtroStatus === 'vencendo' ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}></div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vencendo Hoje</span>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${filtroStatus === 'vencendo' ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>Atenção</span>
                  </div>
                  <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${filtroStatus === 'vencendo' ? 'text-rose-400' : 'text-white group-hover:text-rose-400 group-active:text-rose-400'} transition-colors`}>{formatarMoeda(vencendoHoje)}</span>
                </div>
              </div>

              <div className="rounded-xl border border-atend-border bg-atend-card overflow-hidden shadow-2xl">
                {renderTabelaBoletos()}
              </div>
            </>
          )}

          {paginaAtual === 'boletos' && (
            <div className="rounded-xl border border-atend-border bg-atend-card overflow-hidden shadow-2xl">
              {renderTabelaBoletos()}
            </div>
          )}

          {paginaAtual === 'perfil' && <PaginaPerfil usuarioPerfil={usuarioPerfil} />}
          {paginaAtual === 'fornecedores' && <FornecedoresPage mostrarToast={mostrarToast} />}
          {paginaAtual === 'relatorios' && <RelatoriosPage mostrarToast={mostrarToast} />}
          {paginaAtual === 'auditoria' && <AuditoriaPage />}
          {paginaAtual === 'admin' && usuarioAdmin && <AdminPage mostrarToast={mostrarToast} />}
          {paginaAtual === 'metas' && <MetasPage mostrarToast={mostrarToast} />}
        </main>
      </div>

      {selecionados.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
          <button onClick={lidarComPagarLote}
            className="bg-atend-verde hover:opacity-90 active:scale-[0.98] focus:outline-none text-slate-950 text-sm font-bold px-6 py-3 rounded-xl shadow-2xl shadow-atend-verde/20 flex items-center gap-2 transition-all duration-200">
            ✔ Pagar Selecionados ({selecionados.size})
          </button>
        </div>
      )}

      <Toast mensagem={toast.mensagem} tipo={toast.tipo} visivel={toast.visivel} onFechar={fecharToast} />
      <ModalNovoBoleto aberto={modalAberto} onFechar={() => { setModalAberto(false); setBoletoEditando(null); }} onBoletoCriado={fetchBoletos} boletoEditando={boletoEditando} />
      <ModalAcaoBoleto
        aberto={modalAcao.aberto}
        boleto={modalAcao.boleto}
        onFechar={fecharModalAcao}
        onEditar={handleEditar}
        onPagar={handlePagar}
        onDeletar={handleDeletar}
        onDesfazerPagamento={handleDesfazerPagamento}
      />
      <ModalPagamento
        aberto={modalPagamento.aberto}
        boleto={modalPagamento.boleto}
        onFechar={() => setModalPagamento({ aberto: false, boleto: null })}
        onConfirmado={handlePagarConfirmado}
      />
      <ConfirmDialog
        aberto={confirmExcluir.aberto}
        titulo="Excluir Boleto"
        mensagem="Tem certeza que deseja excluir este boleto? Esta ação não pode ser desfeita."
        onConfirmar={lidarComExcluir}
        onCancelar={() => setConfirmExcluir({ aberto: false, boletoId: null })}
      />
    </div>
  );
}

export default App;
