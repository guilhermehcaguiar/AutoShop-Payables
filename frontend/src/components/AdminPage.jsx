import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';
import ConfirmDialog from './ConfirmDialog';

function AdminPage({ mostrarToast }) {
  const [moduloAberto, setModuloAberto] = useState(null);
  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}` };

  const AccordionSection = ({ indice, icone, titulo, descricao, children }) => (
    <div className="border-b border-atend-border last:border-b-0">
      <button onClick={() => setModuloAberto(moduloAberto === indice ? null : indice)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-900/20 transition-all duration-200 active:scale-[0.98] focus:outline-none">
        <div className="flex items-center gap-3">
          <span className="text-lg">{icone}</span>
          <div className="text-left">
            <h3 className="text-sm font-bold text-white">{titulo}</h3>
            <p className="text-xs text-slate-400">{descricao}</p>
          </div>
        </div>
        <span className={`text-slate-500 transition-all duration-300 ease-in-out ${moduloAberto === indice ? 'rotate-180 text-atend-verde' : ''}`}>▼</span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${moduloAberto === indice ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-4">
          {children}
        </div>
      </div>
    </div>
  );

  const getCatName = (c) => typeof c === 'string' ? c : (c.categoria || c.nome || '');

  // === MÓDULO 1: GERENCIAR USUÁRIOS ===
  const [usuarios, setUsuarios] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nome: '', username: '' });
  const [confirmExcluir, setConfirmExcluir] = useState({ aberto: false, id: null, nome: '' });
  const [criando, setCriando] = useState(false);
  const [formCriar, setFormCriar] = useState({ nome: '', sexo: 'M', username: '', senha: '' });
  const [erroCriar, setErroCriar] = useState('');
  const [carregandoCriar, setCarregandoCriar] = useState(false);

  const fetchUsuarios = async () => {
    try {
      const resp = await apiFetch('/admin/usuarios/', { headers });
      if (resp.ok) setUsuarios(await resp.json());
    } catch {}
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const toggleAdmin = async (usuario) => {
    try {
      const resp = await apiFetch(`/admin/usuarios/${usuario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ admin: usuario.admin ? 0 : 1 }),
      });
      if (resp.ok) { fetchUsuarios(); mostrarToast('Permissão alterada!'); }
    } catch { mostrarToast('Erro', 'erro'); }
  };

  const excluirUsuario = async () => {
    const id = confirmExcluir.id;
    if (!id) return;
    try {
      const resp = await apiFetch(`/usuarios/${id}`, { method: 'DELETE', headers });
      if (resp.ok) { fetchUsuarios(); mostrarToast('Usuário excluído!'); }
      else { const d = await resp.json(); mostrarToast(d.detail || 'Erro', 'erro'); }
    } catch { mostrarToast('Erro ao excluir', 'erro'); }
    finally { setConfirmExcluir({ aberto: false, id: null, nome: '' }); }
  };

  const salvarEdicao = async (e) => {
    e.preventDefault();
    try {
      const resp = await apiFetch(`/admin/usuarios/${editando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ nome: form.nome, username: form.username }),
      });
      if (resp.ok) { setEditando(null); fetchUsuarios(); mostrarToast('Usuário atualizado!'); }
    } catch { mostrarToast('Erro', 'erro'); }
  };

  const criarUsuario = async (e) => {
    e.preventDefault();
    setErroCriar('');
    setCarregandoCriar(true);
    try {
      const resp = await apiFetch('/usuarios/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(formCriar),
      });
      const dados = await resp.json();
      if (resp.ok) {
        setCriando(false);
        setFormCriar({ nome: '', sexo: 'M', username: '', senha: '' });
        fetchUsuarios();
        mostrarToast('Usuário criado com sucesso!');
      } else {
        setErroCriar(dados.detail || 'Erro ao criar usuário');
      }
    } catch { setErroCriar('Erro de conexão'); }
    finally { setCarregandoCriar(false); }
  };

  // === MÓDULO 2: MODERAÇÃO DE CATEGORIAS ===
  const [categorias, setCategorias] = useState([]);
  const [editandoCategoria, setEditandoCategoria] = useState(null);
  const [novoNomeCategoria, setNovoNomeCategoria] = useState('');

  const fetchCategorias = async () => {
    try {
      const resp = await apiFetch('/boletos/categorias-utilizadas', { headers });
      if (resp.ok) {
        const data = await resp.json();
        setCategorias(Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  useEffect(() => { if (moduloAberto === 2) fetchCategorias(); }, [moduloAberto]);

  const mesclarCategoria = async (nomeAntigo) => {
    if (!novoNomeCategoria.trim()) {
      mostrarToast('Informe um novo nome', 'erro');
      return;
    }
    try {
      const resp = await apiFetch('/admin/mesclar-categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ nome_antigo: nomeAntigo, nome_novo: novoNomeCategoria.trim() }),
      });
      if (resp.ok) {
        mostrarToast('Categorias mescladas com sucesso!');
        setEditandoCategoria(null);
        setNovoNomeCategoria('');
        fetchCategorias();
      } else {
        const d = await resp.json();
        mostrarToast(d.detail || 'Erro', 'erro');
      }
    } catch { mostrarToast('Erro ao mesclar', 'erro'); }
  };

  // === MÓDULO 3: TETO DE GASTOS ===
  const [categoriasMeta, setCategoriasMeta] = useState([]);
  const [limites, setLimites] = useState({});

  const fetchDadosTeto = async () => {
    try {
      const [resCats, resMetas] = await Promise.all([
        apiFetch('/boletos/categorias-utilizadas', { headers }),
        apiFetch('/metas/', { headers }),
      ]);
      const catsData = resCats.ok ? await resCats.json() : [];
      const metasData = resMetas.ok ? await resMetas.json() : [];
      const cats = Array.isArray(catsData) ? catsData : [];
      const metasArray = Array.isArray(metasData) ? metasData : [];
      setCategoriasMeta(cats);
      const limits = {};
      cats.forEach((c) => {
        const catName = getCatName(c);
        const meta = metasArray.find((m) => m.categoria === catName);
        if (meta) limits[catName] = meta.limite_mensal;
      });
      setLimites(limits);
    } catch {}
  };

  useEffect(() => { if (moduloAberto === 3) fetchDadosTeto(); }, [moduloAberto]);

  const salvarLimite = async (categoria) => {
    try {
      const resp = await apiFetch('/metas/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ categoria, limite_mensal: Number(limites[categoria]) || 0 }),
      });
      if (resp.ok) {
        mostrarToast('Limite salvo!');
        fetchDadosTeto();
      } else {
        const d = await resp.json();
        mostrarToast(d.detail || 'Erro', 'erro');
      }
    } catch { mostrarToast('Erro ao salvar', 'erro'); }
  };

  // === MÓDULO 4: CENTRAL DE BACKUP ===
  const [backupAtivo, setBackupAtivo] = useState(null);
  const [smtpConfigurado, setSmtpConfigurado] = useState(false);
  const [executandoBackup, setExecutandoBackup] = useState(false);
  const [confirmArquivar, setConfirmArquivar] = useState({ aberto: false, carregando: false });

  const fetchStatusBackup = async () => {
    try {
      const resp = await apiFetch('/admin/backup-status', { headers });
      if (resp.ok) {
        const data = await resp.json();
        setBackupAtivo(data.ativo);
        setSmtpConfigurado(data.smtp_configurado);
      }
    } catch {}
  };

  useEffect(() => { if (moduloAberto === 4) fetchStatusBackup(); }, [moduloAberto]);

  const toggleBackup = async () => {
    const novoEstado = !backupAtivo;
    setBackupAtivo(novoEstado);
    try {
      const resp = await apiFetch('/admin/backup-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
      });
      if (resp.ok) {
        const data = await resp.json();
        setBackupAtivo(data.ativo);
        mostrarToast(`Backup automático ${data.ativo ? 'ativado' : 'desativado'}!`);
      } else {
        setBackupAtivo(!novoEstado);
        const d = await resp.json();
        mostrarToast(d.detail || 'Erro', 'erro');
      }
    } catch {
      setBackupAtivo(!novoEstado);
      mostrarToast('Erro ao alterar backup', 'erro');
    }
  };

  const executarBackup = async () => {
    setExecutandoBackup(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const resp = await apiFetch('/admin/backup-agendado', { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await resp.json();
      if (resp.ok) {
        if (data.email_enviado !== undefined) {
          mostrarToast(data.email_enviado ? 'Backup enviado por e-mail com sucesso!' : 'Backup gerado, mas falha no envio do e-mail.');
        } else {
          mostrarToast(data.mensagem || 'Backup desativado no servidor.', 'erro');
        }
      } else {
        mostrarToast(data.detail || 'Erro ao executar backup', 'erro');
      }
    } catch {
      clearTimeout(timeoutId);
      mostrarToast('Erro de conexão ou tempo limite excedido', 'erro');
    }
    setExecutandoBackup(false);
  };

  const baixarBackup = async () => {
    try {
      const resp = await apiFetch('/boletos/exportar-csv', { headers });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-boletos-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        mostrarToast('Download iniciado!');
      } else {
        const d = await resp.json();
        mostrarToast(d.detail || 'Erro', 'erro');
      }
    } catch { mostrarToast('Erro ao baixar', 'erro'); }
  };

  const restaurarBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const dados = JSON.parse(text);
      const resp = await apiFetch('/admin/restaurar-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(dados),
      });
      if (resp.ok) {
        mostrarToast('Backup restaurado com sucesso!');
      } else {
        const d = await resp.json();
        mostrarToast(d.detail || 'Erro ao restaurar', 'erro');
      }
    } catch { mostrarToast('Arquivo inválido. Use um arquivo .json válido.', 'erro'); }
    e.target.value = '';
  };

  const arquivarBoletos = async () => {
    setConfirmArquivar((prev) => ({ ...prev, carregando: true }));
    try {
      const resp = await apiFetch('/admin/arquivar', { method: 'POST', headers });
      if (resp.ok) {
        const data = await resp.json();
        mostrarToast(`${data.arquivados || 0} boletos arquivados!`);
        setConfirmArquivar({ aberto: false, carregando: false });
      } else {
        const d = await resp.json();
        mostrarToast(d.detail || 'Erro', 'erro');
        setConfirmArquivar((prev) => ({ ...prev, carregando: false }));
      }
    } catch {
      mostrarToast('Erro ao arquivar', 'erro');
      setConfirmArquivar((prev) => ({ ...prev, carregando: false }));
    }
  };

  // === MÓDULO 5: META VS GASTO ===
  const [metaGasto, setMetaGasto] = useState([]);
  const [carregandoMeta, setCarregandoMeta] = useState(false);

  const fetchMetaGasto = async () => {
    setCarregandoMeta(true);
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth() + 1;
    try {
      const [resMetas, resCats] = await Promise.all([
        apiFetch('/metas/', { headers }),
        apiFetch(`/relatorio/categorias?ano=${ano}&mes=${mes}&status=Pago`, { headers }),
      ]);
      const metas = resMetas.ok ? await resMetas.json() : [];
      const gastos = resCats.ok ? await resCats.json() : [];
      const gastoMap = {};
      (Array.isArray(gastos) ? gastos : []).forEach((g) => { gastoMap[g.categoria] = g.total; });
      const combined = (Array.isArray(metas) ? metas : []).map((m) => ({
        categoria: m.categoria,
        limite: Number(m.limite_mensal) || 0,
        gasto: gastoMap[m.categoria] || 0,
      })).filter((m) => m.limite > 0);
      setMetaGasto(combined);
    } catch {}
    setCarregandoMeta(false);
  };

  useEffect(() => { if (moduloAberto === 5) fetchMetaGasto(); }, [moduloAberto]);

  // === MÓDULO 6: BOLETOS EXCLUÍDOS ===
  const [excluidos, setExcluidos] = useState([]);
  const [carregandoExcluidos, setCarregandoExcluidos] = useState(false);

  const fetchExcluidos = async () => {
    setCarregandoExcluidos(true);
    try {
      const resp = await apiFetch('/boletos/excluidos', { headers });
      if (resp.ok) setExcluidos(await resp.json());
    } catch {}
    setCarregandoExcluidos(false);
  };

  useEffect(() => { if (moduloAberto === 6) fetchExcluidos(); }, [moduloAberto]);

  const recuperarBoleto = async (id) => {
    try {
      const resp = await apiFetch(`/admin/recuperar-boleto/${id}`, { method: 'POST', headers });
      if (resp.ok) {
        mostrarToast('Boleto recuperado com sucesso!');
        fetchExcluidos();
      } else {
        const d = await resp.json();
        mostrarToast(d.detail || 'Erro', 'erro');
      }
    } catch { mostrarToast('Erro ao recuperar', 'erro'); }
  };

  // === MÓDULO 7: MODELOS RECORRENTES ===
  const [recorrentes, setRecorrentes] = useState([]);
  const [carregandoRecorrentes, setCarregandoRecorrentes] = useState(false);

  const fetchRecorrentes = async () => {
    setCarregandoRecorrentes(true);
    try {
      const resp = await apiFetch('/boletos/recorrentes', { headers });
      if (resp.ok) setRecorrentes(await resp.json());
    } catch {}
    setCarregandoRecorrentes(false);
  };

  useEffect(() => { if (moduloAberto === 7) fetchRecorrentes(); }, [moduloAberto]);

  const deletarRecorrente = async (id) => {
    try {
      const resp = await apiFetch(`/boletos/recorrentes/${id}`, { method: 'DELETE', headers });
      if (resp.ok) {
        mostrarToast('Modelo excluído!');
        fetchRecorrentes();
      } else {
        const d = await resp.json();
        mostrarToast(d.detail || 'Erro', 'erro');
      }
    } catch { mostrarToast('Erro ao excluir', 'erro'); }
  };

  return (
    <div className="rounded-xl border border-atend-border bg-atend-card overflow-hidden shadow-2xl">
      <div className="px-5 py-4 border-b border-atend-border">
        <h3 className="text-lg font-bold text-white">Administração</h3>
        <p className="text-xs text-slate-400">Apenas administradores têm acesso a esta tela</p>
      </div>

      {/* === MÓDULO 1 === */}
      <AccordionSection indice={1} icone="📁" titulo="Gerenciar Usuários" descricao="Cadastro e permissões de usuários">
        <div className="mb-3 mt-1 flex justify-end">
          <button onClick={() => setCriando(true)}
            className="bg-atend-verde hover:opacity-90 active:scale-[0.98] focus:outline-none text-slate-950 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg transition-all duration-200 shadow-lg shadow-atend-verde/10">
            + Novo Usuário
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-atend-border bg-slate-900/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-5 py-4">ID</th>
                <th className="px-5 py-4">Nome</th>
                <th className="px-5 py-4">Username</th>
                <th className="px-5 py-4">Sexo</th>
                <th className="px-5 py-4">Admin</th>
                <th className="px-5 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-atend-border/50 text-sm text-slate-300">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-slate-900/20 transition-all duration-150 active:scale-[0.99]">
                  <td className="px-5 py-4 text-slate-500">{u.id}</td>
                  <td className="px-5 py-4 font-medium text-white">{u.nome}</td>
                  <td className="px-5 py-4 text-slate-400">{u.username}</td>
                  <td className="px-5 py-4 text-slate-400">{u.sexo === 'M' ? 'Masculino' : 'Feminino'}</td>
                  <td className="px-5 py-4">
                    <button onClick={() => toggleAdmin(u)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 active:scale-[0.98] focus:outline-none ${
                        u.admin ? 'bg-atend-verde/10 text-atend-verde border border-atend-verde/20' : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}>
                      {u.admin ? 'Admin' : 'Usuário'}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => { setEditando(u); setForm({ nome: u.nome, username: u.username }); }}
                        className="text-xs font-semibold text-atend-verde border border-atend-verde/30 bg-atend-verde/5 px-2.5 py-1 rounded transition-all duration-200 active:scale-[0.98] focus:outline-none hover:bg-atend-verde/10">✏️</button>
                      <button onClick={() => setConfirmExcluir({ aberto: true, id: u.id, nome: u.nome })}
                        className="text-xs font-semibold text-rose-400 border border-rose-500/30 bg-rose-500/5 px-2.5 py-1 rounded transition-all duration-200 active:scale-[0.98] focus:outline-none hover:bg-rose-500/10">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ConfirmDialog
          aberto={confirmExcluir.aberto}
          titulo="Excluir Usuário"
          mensagem={`Tem certeza que deseja excluir "${confirmExcluir.nome}"? Esta ação não pode ser desfeita.`}
          onConfirmar={excluirUsuario}
          onCancelar={() => setConfirmExcluir({ aberto: false, id: null, nome: '' })}
        />

        {editando && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="fixed inset-0 bg-black/60" onClick={() => setEditando(null)} />
            <div className="relative w-full max-w-md bg-atend-card border border-atend-border rounded-2xl shadow-2xl p-6 z-10 animate-fade-in-scale">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-atend-verde shadow-[0_0_15px_#2ecc71] rounded-t-2xl" />
              <div className="flex justify-between items-center mb-6 mt-1">
                <h2 className="text-lg font-bold text-white">Editar Usuário</h2>
                <button onClick={() => setEditando(null)} className="text-slate-500 hover:text-white text-xl leading-none active:scale-[0.98] focus:outline-none transition-all duration-200">&times;</button>
              </div>
              <form onSubmit={salvarEdicao} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nome</label>
                  <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
                  <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" />
                </div>
                <button type="submit"
                  className="w-full bg-atend-verde hover:opacity-90 active:scale-[0.98] focus:outline-none text-slate-950 text-sm font-bold py-2.5 rounded-lg transition-all duration-200">
                  Salvar
                </button>
              </form>
            </div>
          </div>
        )}

        {criando && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="fixed inset-0 bg-black/60" onClick={() => setCriando(false)} />
            <div className="relative w-full max-w-md bg-atend-card border border-atend-border rounded-2xl shadow-2xl p-6 z-10 animate-fade-in-scale">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-atend-verde shadow-[0_0_15px_#2ecc71] rounded-t-2xl" />
              <div className="flex justify-between items-center mb-6 mt-1">
                <h2 className="text-lg font-bold text-white">Novo Usuário</h2>
                <button onClick={() => setCriando(false)} className="text-slate-500 hover:text-white text-xl leading-none active:scale-[0.98] focus:outline-none transition-all duration-200">&times;</button>
              </div>
              <form onSubmit={criarUsuario} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nome</label>
                  <input type="text" value={formCriar.nome} onChange={(e) => setFormCriar({ ...formCriar, nome: e.target.value })}
                    className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Sexo</label>
                  <select value={formCriar.sexo} onChange={(e) => setFormCriar({ ...formCriar, sexo: e.target.value })}
                    className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60 transition-all duration-200 active:scale-[0.98]">
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
                  <input type="text" value={formCriar.username} onChange={(e) => setFormCriar({ ...formCriar, username: e.target.value })}
                    className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Senha</label>
                  <input type="password" value={formCriar.senha} onChange={(e) => setFormCriar({ ...formCriar, senha: e.target.value })}
                    className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" required />
                </div>
                {erroCriar && <div className="bg-rose-500/10 text-rose-400 text-xs rounded-lg p-3 text-center">⚠️ {erroCriar}</div>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setCriando(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] focus:outline-none text-slate-300 text-sm font-medium py-2.5 rounded-lg border border-slate-700 transition-all duration-200">
                    Cancelar
                  </button>
                  <button type="submit" disabled={carregandoCriar}
                    className="flex-1 bg-atend-verde hover:opacity-90 active:scale-[0.98] focus:outline-none disabled:opacity-50 text-slate-950 text-sm font-bold py-2.5 rounded-lg transition-all duration-200">
                    {carregandoCriar ? 'Criando...' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AccordionSection>

      {/* === MÓDULO 2 === */}
      <AccordionSection indice={2} icone="📊" titulo="Moderação de Categorias" descricao="Editar ou mesclar categorias de boletos">
        <div className="mt-1 space-y-2">
          {categorias.length === 0 && (
            <p className="text-sm text-slate-500 italic py-2">Nenhuma categoria encontrada.</p>
          )}
          {categorias.map((cat) => {
            const nome = getCatName(cat);
            return (
              <div key={nome} className="flex items-center justify-between bg-slate-900/20 rounded-lg px-4 py-3 border border-atend-border/50">
                <span className="text-sm font-medium text-white">{nome}</span>
                {editandoCategoria === nome ? (
                  <div className="flex items-center gap-2">
                    <input type="text" value={novoNomeCategoria} onChange={(e) => setNovoNomeCategoria(e.target.value)}
                      placeholder="Novo nome"
                      className="w-40 bg-atend-bg border border-atend-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-atend-verde/60" />
                    <button onClick={() => mesclarCategoria(nome)}
                      className="bg-atend-verde hover:opacity-90 active:scale-[0.98] focus:outline-none text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-200">
                      Mesclar
                    </button>
                    <button onClick={() => { setEditandoCategoria(null); setNovoNomeCategoria(''); }}
                      className="text-slate-500 hover:text-white text-xs px-2 py-1.5 active:scale-[0.98] focus:outline-none transition-all duration-200">Cancelar</button>
                  </div>
                ) : (
                  <button onClick={() => { setEditandoCategoria(nome); setNovoNomeCategoria(nome); }}
                    className="text-xs font-semibold text-atend-verde border border-atend-verde/30 bg-atend-verde/5 px-3 py-1.5 rounded transition-all duration-200 active:scale-[0.98] focus:outline-none hover:bg-atend-verde/10">
                    Editar / Mesclar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </AccordionSection>

      {/* === MÓDULO 3 === */}
      <AccordionSection indice={3} icone="📈" titulo="Teto de Gastos" descricao="Definir limites mensais por categoria">
        <div className="mt-1 space-y-2">
          {categoriasMeta.length === 0 && (
            <p className="text-sm text-slate-500 italic py-2">Nenhuma categoria disponível.</p>
          )}
          {categoriasMeta.map((cat) => {
            const nome = getCatName(cat);
            return (
              <div key={nome} className="flex items-center justify-between bg-slate-900/20 rounded-lg px-4 py-3 border border-atend-border/50">
                <span className="text-sm font-medium text-white min-w-[140px]">{nome}</span>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" step="0.01"
                    value={limites[nome] ?? ''}
                    onChange={(e) => setLimites({ ...limites, [nome]: e.target.value })}
                    placeholder="Limite mensal"
                    className="w-32 bg-atend-bg border border-atend-border rounded-lg px-3 py-1.5 text-xs text-white text-right focus:outline-none focus:border-atend-verde/60" />
                  <button onClick={() => salvarLimite(nome)}
                    className="bg-atend-verde hover:opacity-90 active:scale-[0.98] focus:outline-none text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-200">
                    Salvar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </AccordionSection>

      {/* === MÓDULO 4 === */}
      <AccordionSection indice={4} icone="⚙️" titulo="Central de Backup" descricao="Exportar, importar e gerenciar dados">
        <div className="mt-1 space-y-4">
          {/* Baixar Cópia */}
          <div className="flex items-center justify-between bg-slate-900/20 rounded-lg px-4 py-3 border border-atend-border/50">
            <div>
              <p className="text-sm font-medium text-white">Baixar Cópia Completa</p>
              <p className="text-xs text-slate-500">Exportar todos os boletos em CSV</p>
            </div>
            <button onClick={baixarBackup}
              className="bg-atend-verde hover:opacity-90 active:scale-[0.98] focus:outline-none text-slate-950 text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200">
              Baixar
            </button>
          </div>

          {/* Restaurar Backup */}
          <div className="flex items-center justify-between bg-slate-900/20 rounded-lg px-4 py-3 border border-atend-border/50">
            <div>
              <p className="text-sm font-medium text-white">Restaurar Banco de Dados</p>
              <p className="text-xs text-slate-500">Importar arquivo .json de backup</p>
            </div>
            <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-300 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-700 transition-all duration-200">
              Selecionar
              <input type="file" accept=".json" onChange={restaurarBackup} className="hidden" />
            </label>
          </div>

          {/* Backup Agendado */}
          <div className="flex items-center justify-between bg-slate-900/20 rounded-lg px-4 py-3 border border-atend-border/50">
            <div>
              <p className="text-sm font-medium text-white">Ativar Backup Semanal Automático</p>
              <p className="text-xs text-slate-500">
                Status: {backupAtivo === null ? 'Verificando...' : backupAtivo ? <span className="text-atend-verde">Ativo</span> : <span className="text-slate-400">Inativo</span>}
                {!smtpConfigurado && backupAtivo !== null && <span className="text-amber-400 ml-2">(SMTP não configurado)</span>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                role="switch"
                aria-checked={backupAtivo}
                onClick={toggleBackup}
                className={`relative w-14 h-7 rounded-full transition-all duration-300 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-atend-verde/60 focus-visible:ring-offset-2 focus-visible:ring-offset-atend-bg ${backupAtivo ? 'bg-atend-verde shadow-[0_0_12px_rgba(34,197,94,0.35)]' : 'bg-slate-700 hover:bg-slate-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ease-out ${backupAtivo ? 'translate-x-7 scale-105' : 'translate-x-0 scale-100'}`} />
              </button>
              <button onClick={executarBackup} disabled={executandoBackup || !backupAtivo || !smtpConfigurado}
                className="relative bg-atend-verde hover:opacity-90 active:scale-[0.98] focus:outline-none disabled:opacity-50 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-200 overflow-hidden">
                {executandoBackup ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Enviando</span>
                  </span>
                ) : 'Executar'}
              </button>
            </div>
          </div>

          {/* Arquivar / Liberar Espaço */}
          <div className="flex items-center justify-between bg-slate-900/20 rounded-lg px-4 py-3 border border-atend-border/50">
            <div>
              <p className="text-sm font-medium text-white">Arquivar / Liberar Espaço</p>
              <p className="text-xs text-slate-500">Remove boletos antigos para liberar espaço</p>
            </div>
            <button onClick={() => setConfirmArquivar({ aberto: true, carregando: false })}
              className="bg-rose-600/10 hover:bg-rose-600/20 active:scale-[0.98] focus:outline-none text-rose-400 border border-rose-500/30 text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200">
              Arquivar
            </button>
          </div>
        </div>

        <ConfirmDialog
          aberto={confirmArquivar.aberto}
          titulo="Arquivar Boletos Antigos"
          mensagem="Tem certeza que deseja arquivar boletos antigos para liberar espaço? Esta ação remove registros antigos do sistema."
          onConfirmar={arquivarBoletos}
          onCancelar={() => setConfirmArquivar({ aberto: false, carregando: false })}
          carregando={confirmArquivar.carregando}
        />
      </AccordionSection>

      {/* === MÓDULO 5 === */}
      <AccordionSection indice={5} icone="💰" titulo="Meta vs Gasto" descricao="Comparativo do mês atual por categoria">
        <div className="mt-1 space-y-2">
          {carregandoMeta ? (
            <p className="text-sm text-slate-500 italic py-2">Carregando...</p>
          ) : metaGasto.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-2">Nenhuma meta definida para este mês.</p>
          ) : (
            metaGasto.map((item) => {
              const pct = item.limite > 0 ? Math.min((item.gasto / item.limite) * 100, 100) : 0;
              const estouro = item.gasto > item.limite;
              return (
                <div key={item.categoria} className="bg-slate-900/20 rounded-lg px-4 py-3 border border-atend-border/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-white">{item.categoria}</span>
                    <span className={`text-xs font-semibold ${estouro ? 'text-rose-400' : 'text-atend-verde'}`}>
                      R$ {item.gasto.toFixed(2)} / R$ {item.limite.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${estouro ? 'bg-rose-500' : 'bg-atend-verde'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </AccordionSection>

      {/* === MÓDULO 6 === */}
      <AccordionSection indice={6} icone="🗑" titulo="Boletos Excluídos" descricao="Recuperar boletos deletados">
        <div className="mt-1 space-y-2">
          {carregandoExcluidos ? (
            <p className="text-sm text-slate-500 italic py-2">Carregando...</p>
          ) : excluidos.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-2">Nenhum boleto excluído encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-atend-border bg-slate-900/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-3 py-3">ID</th>
                    <th className="px-3 py-3">Descrição</th>
                    <th className="px-3 py-3">Valor</th>
                    <th className="px-3 py-3">Vencimento</th>
                    <th className="px-3 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-atend-border/50 text-sm text-slate-300">
                  {excluidos.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-900/20 transition-all duration-150 active:scale-[0.99]">
                      <td className="px-3 py-3 text-slate-500">{b.id}</td>
                      <td className="px-3 py-3 font-medium text-white">{b.descricao || '—'}</td>
                      <td className="px-3 py-3 text-slate-400">R$ {Number(b.valor || 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-slate-400">{b.vencimento || '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => recuperarBoleto(b.id)}
                          className="text-xs font-semibold text-atend-verde border border-atend-verde/30 bg-atend-verde/5 px-2.5 py-1 rounded transition-all duration-200 active:scale-[0.98] focus:outline-none hover:bg-atend-verde/10">
                          Recuperar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AccordionSection>

      {/* === MÓDULO 7 === */}
      <AccordionSection indice={7} icone="🔄" titulo="Modelos Recorrentes" descricao="Gerenciar boletos recorrentes">
        <div className="mt-1 space-y-2">
          {carregandoRecorrentes ? (
            <p className="text-sm text-slate-500 italic py-2">Carregando...</p>
          ) : recorrentes.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-2">Nenhum modelo recorrente encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-atend-border bg-slate-900/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-3 py-3">ID</th>
                    <th className="px-3 py-3">Descrição</th>
                    <th className="px-3 py-3">Valor</th>
                    <th className="px-3 py-3">Categoria</th>
                    <th className="px-3 py-3">Dia</th>
                    <th className="px-3 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-atend-border/50 text-sm text-slate-300">
                  {recorrentes.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-900/20 transition-all duration-150 active:scale-[0.99]">
                      <td className="px-3 py-3 text-slate-500">{r.id}</td>
                      <td className="px-3 py-3 font-medium text-white">{r.descricao || '—'}</td>
                      <td className="px-3 py-3 text-slate-400">R$ {Number(r.valor || 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-slate-400">{r.categoria || '—'}</td>
                      <td className="px-3 py-3 text-slate-400">{r.dia_vencimento || '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => deletarRecorrente(r.id)}
                          className="text-xs font-semibold text-rose-400 border border-rose-500/30 bg-rose-500/5 px-2.5 py-1 rounded transition-all duration-200 active:scale-[0.98] focus:outline-none hover:bg-rose-500/10">
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AccordionSection>
    </div>
  );
}

export default AdminPage;
