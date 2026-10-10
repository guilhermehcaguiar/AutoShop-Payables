import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import { apiFetch, apiJson, exigirSucesso } from './api.js';
import { dataLocal, filtrarBoletos, selecionaveis, resumoPrazo, moeda } from './boletosView.js';
import Sidebar from './components/Sidebar.jsx';
import Icon from './components/Icon.jsx';
import Toast from './components/Toast.jsx';
import BoletosList from './components/BoletosList.jsx';
import ModalNovoBoleto from './components/ModalNovoBoleto.jsx';
import ModalAcaoBoleto from './components/ModalAcaoBoleto.jsx';
import ModalPagamento from './components/ModalPagamento.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import Login from './components/Login.jsx';

const FornecedoresPage = lazy(() => import('./components/FornecedoresPage.jsx'));
const RelatoriosPage = lazy(() => import('./components/RelatoriosPage.jsx'));
const AuditoriaPage = lazy(() => import('./components/AuditoriaPage.jsx'));
const AdminPage = lazy(() => import('./components/AdminPage.jsx'));
const MetasPage = lazy(() => import('./components/MetasPage.jsx'));
const PaginaPerfil = lazy(() => import('./components/PaginaPerfil.jsx'));
const titulos = { dashboard: 'Resumo financeiro', boletos: 'Contas a pagar', fornecedores: 'Fornecedores', relatorios: 'Relatórios', auditoria: 'Histórico', admin: 'Administração', metas: 'Metas', perfil: 'Meu perfil' };
const filtrosIniciais = () => ({ mes: dataLocal().slice(0, 7), inicio: '', fim: '', status: 'todos', dia: '', fornecedor: '', busca: '' });

export default function App() {
  const [estaLogado, setEstaLogado] = useState(false);
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [carregandoLogin, setCarregandoLogin] = useState(false);
  const [erro, setErro] = useState('');
  const [perfil, setPerfil] = useState({});
  const [boletos, setBoletos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erroLista, setErroLista] = useState('');
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [pagina, setPagina] = useState('dashboard');
  const [tema, setTema] = useState(() => localStorage.getItem('atend-tema') || 'dark');
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [selecionados, setSelecionados] = useState(new Set());
  const [pg, setPg] = useState(1);
  const [cadastro, setCadastro] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [pagamento, setPagamento] = useState(null);
  const [confirmacao, setConfirmacao] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [toast, setToast] = useState({});
  const mostrarToast = useCallback((mensagem, tipo = 'sucesso') => setToast({ mensagem, tipo, visivel: true }), []);
  const fecharToast = useCallback(() => setToast(t => ({ ...t, visivel: false })), []);
  const sair = useCallback(() => {
    localStorage.removeItem('token'); localStorage.removeItem('usuarioPerfil');
    setEstaLogado(false); setSenha(''); setBoletos([]); setSelecionados(new Set()); setSidebarAberta(false);
    setCadastro(null); setDetalhe(null); setPagamento(null); setConfirmacao(null); setPagina('dashboard');
  }, []);
  const carregar = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    setCarregando(true); setErroLista('');
    try { setBoletos(await apiJson('/boletos/')); }
    catch (e) { setErroLista(e.message); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const salvo = JSON.parse(localStorage.getItem('usuarioPerfil') || 'null');
        if (salvo && localStorage.getItem('token')) { setPerfil(salvo); setEstaLogado(true); carregar(); }
      } catch { sair(); }
    }, 0);
    const expirar = () => { sair(); setErro('Sua sessão expirou. Entre novamente para continuar. Seu rascunho de cadastro foi preservado.'); };
    window.addEventListener('sessao-expirada', expirar);
    return () => { clearTimeout(t); window.removeEventListener('sessao-expirada', expirar); };
  }, [carregar, sair]);
  useEffect(() => {
    localStorage.setItem('atend-tema', tema);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () => document.documentElement.setAttribute('data-theme', tema === 'system' ? mq.matches ? 'dark' : 'light' : tema);
    aplicar(); mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, [tema]);
  useEffect(() => {
    if (!estaLogado) return;
    const id = setInterval(() => { if (document.visibilityState === 'visible' && !pagamento && !cadastro) carregar(); }, 60000);
    return () => clearInterval(id);
  }, [estaLogado, pagamento, cadastro, carregar]);

  const hoje = dataLocal();
  const filtrados = useMemo(() => filtrarBoletos(boletos, filtros, hoje), [boletos, filtros, hoje]);
  const visiveis = new Set(selecionaveis(filtrados).map(b => b.id));
  const selecionadosAtivos = new Set([...selecionados].filter(id => visiveis.has(id)));
  const itensSelecionados = filtrados.filter(b => selecionadosAtivos.has(b.id));
  const atual = Math.min(pg, Math.max(1, Math.ceil(filtrados.length / 25)));
  const prazos = resumoPrazo(boletos, hoje);
  const total = lista => lista.reduce((s, b) => s + Number(b.valor), 0);
  const periodo = filtrarBoletos(boletos, { mes: filtros.mes, status: 'todos' }, hoje);
  const meses = useMemo(() => {
    const opcoes = new Set([dataLocal().slice(0, 7), filtros.mes, ...boletos.map(b => b.vencimento.slice(0, 7))]);
    const agora = new Date();
    for (let i = -12; i <= 24; i++) opcoes.add(dataLocal(new Date(agora.getFullYear(), agora.getMonth() + i, 1)).slice(0, 7));
    return [...opcoes].sort().map(valor => ({ valor, rotulo: new Date(valor + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }));
  }, [boletos, filtros.mes]);
  const mudarFiltros = mudanca => { setFiltros(f => mudanca.limpar ? { ...filtrosIniciais(), mes: f.mes } : { ...f, ...mudanca }); setPg(1); setSelecionados(new Set()); };
  const navegar = id => { setPagina(id); setSidebarAberta(false); setSelecionados(new Set()); };
  const togglePagina = itens => {
    const ids = selecionaveis(itens).map(b => b.id);
    const todos = ids.every(id => selecionadosAtivos.has(id));
    setSelecionados(new Set(todos ? [...selecionadosAtivos].filter(id => !ids.includes(id)) : [...selecionadosAtivos, ...ids]));
  };
  const login = async e => {
    e.preventDefault(); if (carregandoLogin) return;
    setCarregandoLogin(true); setErro('');
    try {
      const dados = await apiJson('/login', { method: 'POST', body: new URLSearchParams({ username, password: senha }), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const usuario = { ...dados.usuario, username };
      localStorage.setItem('token', dados.access_token); localStorage.setItem('usuarioPerfil', JSON.stringify(usuario));
      setPerfil(usuario); setEstaLogado(true); setSenha(''); await carregar();
    } catch (e) { setErro(e.message); }
    finally { setCarregandoLogin(false); }
  };
  const confirmar = async () => {
    if (ocupado) return; setOcupado(true); setConfirmacao(c => ({ ...c, erro: '' }));
    try {
      await apiJson(`/boletos/${confirmacao.id}${confirmacao.tipo === 'desfazer' ? '/desfazer-pagamento' : ''}`, { method: confirmacao.tipo === 'desfazer' ? 'PATCH' : 'DELETE' });
      setConfirmacao(null); mostrarToast(confirmacao.tipo === 'desfazer' ? 'Pagamento desfeito.' : 'Conta excluída.'); await carregar();
    } catch (e) { setConfirmacao(c => c ? { ...c, erro: e.message } : c); }
    finally { setOcupado(false); }
  };
  const exportar = async () => {
    try {
      const resp = await exigirSucesso(await apiFetch('/boletos/exportar-csv'));
      const url = URL.createObjectURL(await resp.blob()); const a = document.createElement('a');
      a.href = url; a.download = `boletos_${hoje}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      mostrarToast('CSV com todas as contas exportado.');
    } catch (e) { mostrarToast(e.message, 'erro'); }
  };
  if (!estaLogado) return <Login username={username} senha={senha} setUsername={setUsername} setSenha={setSenha} erro={erro} carregando={carregandoLogin} onSubmit={login} />;
  return <div className="app-shell">
    <Sidebar aberta={sidebarAberta} setAberta={setSidebarAberta} paginaAtual={pagina} setPaginaAtual={navegar} onSair={sair} tema={tema} onTemaChange={setTema} notificacoes={{ atrasados: prazos.vencidos.quantidade }} usuarioAdmin={perfil.admin} />
    <div className="app-content"><header className="app-header" aria-label={titulos[pagina]}><div className="actions-row"><button type="button" className="icon-button app-menu-toggle" onClick={() => setSidebarAberta(true)} aria-label="Abrir menu"><Icon name="menu" /></button><h1>FINANCEIRO <span>ATEND-CAR</span></h1></div><button type="button" className="button-secondary" onClick={() => navegar('perfil')}><Icon name="usuario" size={16} /><span>{perfil.nome}</span></button></header>
      <main className="app-main">
        {pagina === 'dashboard' && <><div className="section-heading dashboard-heading"><div><h2>Olá, {perfil.nome?.split(' ')[0]}</h2><p>Acompanhe as contas que precisam de atenção.</p></div><span className="subtle">{new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</span></div>
          <div className="summary-grid">{[{ status: 'vencidos', titulo: 'Vencidos', icone: 'alerta', tom: 'danger' }, { status: 'vencendo', titulo: 'Vencem hoje', icone: 'calendario', tom: 'warning' }, { status: 'proximos', titulo: 'Próximos 7 dias', icone: 'boleto', tom: 'success' }].map(c => <button key={c.status} type="button" className={`summary-card ${c.tom}`} aria-pressed={filtros.status === c.status} onClick={() => mudarFiltros({ status: filtros.status === c.status ? 'todos' : c.status, inicio: '', fim: '', dia: '' })}><div className="summary-label"><span>{c.titulo}</span><Icon name={c.icone} /></div><strong>{carregando ? '…' : moeda(prazos[c.status].valor)}</strong><span>{prazos[c.status].quantidade} contas · Ver contas <Icon name="seta" size={14} /></span></button>)}</div>
          <div className="period-summary"><span>Resumo do mês selecionado</span><button type="button" className="link-button" onClick={() => mudarFiltros({ status: 'pagos' })}>Pago: {moeda(total(periodo.filter(b => b.status === 'Pago')))}</button><button type="button" className="link-button" onClick={() => mudarFiltros({ status: 'pendentes' })}>Em aberto: {moeda(total(selecionaveis(periodo)))}</button></div></>}
        {['dashboard', 'boletos'].includes(pagina) && <BoletosList itens={filtrados.slice((atual - 1) * 25, atual * 25)} filtros={filtros} onFiltros={mudarFiltros} meses={meses} fornecedores={[...new Set(boletos.map(b => b.fornecedor))].sort()} selecionados={selecionadosAtivos} onSelecionar={id => { const n = new Set(selecionadosAtivos); if (n.has(id)) n.delete(id); else n.add(id); setSelecionados(n); }} onSelecionarPagina={togglePagina} onAbrir={setDetalhe} onNovo={() => setCadastro({})} onCSV={exportar} carregando={carregando} erro={erroLista} onTentar={carregar} pg={atual} onPagina={setPg} totalItens={filtrados.length} totalValor={total(filtrados)} hoje={hoje} />}
        <Suspense fallback={<div className="empty-state" role="status">Carregando página...</div>}>
          {pagina === 'perfil' && <PaginaPerfil usuarioPerfil={perfil} />}
          {pagina === 'fornecedores' && <FornecedoresPage mostrarToast={mostrarToast} />}
          {pagina === 'relatorios' && <RelatoriosPage mostrarToast={mostrarToast} />}
          {pagina === 'auditoria' && <AuditoriaPage />}
          {pagina === 'admin' && perfil.admin && <AdminPage mostrarToast={mostrarToast} />}
          {pagina === 'metas' && <MetasPage mostrarToast={mostrarToast} />}
        </Suspense>
      </main>
    </div>
    {selecionadosAtivos.size > 0 && !carregando && !erroLista && ['dashboard', 'boletos'].includes(pagina) && <div className="batch-bar"><span>{selecionadosAtivos.size} selecionadas · <strong>{moeda(total(itensSelecionados))}</strong></span><button type="button" className="button-secondary" onClick={() => setSelecionados(new Set())}>Limpar seleção</button><button type="button" className="button-primary" onClick={() => setPagamento(itensSelecionados)}>Registrar pagamentos</button></div>}
    <Toast {...toast} onFechar={fecharToast} />
    {cadastro && <ModalNovoBoleto aberto podeRecorrencia={!!perfil.admin} onFechar={() => setCadastro(null)} onBoletoCriado={() => { carregar(); mostrarToast('Conta salva.'); }} boletoEditando={cadastro.id ? cadastro : null} />}
    <ModalAcaoBoleto aberto={!!detalhe} boleto={detalhe} onFechar={() => setDetalhe(null)} onEditar={b => { setDetalhe(null); setCadastro(b); }} onPagar={id => { setDetalhe(null); setPagamento([boletos.find(b => b.id === id)]); }} onDeletar={id => { setDetalhe(null); setConfirmacao({ tipo: 'excluir', id }); }} onDesfazerPagamento={id => { setDetalhe(null); setConfirmacao({ tipo: 'desfazer', id }); }} />
    {pagamento && <ModalPagamento aberto boletos={pagamento} onFechar={() => setPagamento(null)} onConfirmado={() => { setPagamento(null); setSelecionados(new Set()); carregar(); mostrarToast('Pagamento registrado.'); }} />}
    <ConfirmDialog erro={confirmacao?.erro} aberto={!!confirmacao} titulo={confirmacao?.tipo === 'desfazer' ? 'Desfazer pagamento?' : 'Excluir conta?'} mensagem={confirmacao?.tipo === 'desfazer' ? 'A conta voltará a ficar pendente. O registro do pagamento será removido.' : 'A conta sairá da lista. Um administrador pode restaurá-la na lixeira.'} onConfirmar={confirmar} onCancelar={() => setConfirmacao(null)} carregando={ocupado} />
  </div>;
}
