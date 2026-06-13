import { useState, useEffect } from 'react';
import ConfirmDialog from './ConfirmDialog';

function AdminPage({ mostrarToast }) {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nome: '', username: '', admin: 0 });
  const [confirmExcluir, setConfirmExcluir] = useState({ aberto: false, id: null, nome: '' });
  const [criando, setCriando] = useState(false);
  const [formCriar, setFormCriar] = useState({ nome: '', sexo: 'M', username: '', senha: '' });
  const [erroCriar, setErroCriar] = useState('');
  const [carregandoCriar, setCarregandoCriar] = useState(false);

  const fetchUsuarios = async () => {
    const token = localStorage.getItem('token');
    try {
      const resp = await fetch('http://localhost:8000/admin/usuarios/', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resp.ok) setUsuarios(await resp.json());
    } catch {} finally { setCarregando(false); }
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const toggleAdmin = async (usuario) => {
    const token = localStorage.getItem('token');
    try {
      const resp = await fetch(`http://localhost:8000/admin/usuarios/${usuario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ admin: usuario.admin ? 0 : 1 }),
      });
      if (resp.ok) { fetchUsuarios(); mostrarToast('Permissão alterada!'); }
    } catch { mostrarToast('Erro', 'erro'); }
  };

  const excluirUsuario = async () => {
    const id = confirmExcluir.id;
    if (!id) return;
    const token = localStorage.getItem('token');
    try {
      const resp = await fetch(`http://localhost:8000/usuarios/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resp.ok) { fetchUsuarios(); mostrarToast('Usuário excluído!'); }
      else { const d = await resp.json(); mostrarToast(d.detail || 'Erro', 'erro'); }
    } catch { mostrarToast('Erro ao excluir', 'erro'); }
    finally { setConfirmExcluir({ aberto: false, id: null, nome: '' }); }
  };

  const salvarEdicao = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const resp = await fetch(`http://localhost:8000/admin/usuarios/${editando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ nome: form.nome, username: form.username }),
      });
      if (resp.ok) { setEditando(null); fetchUsuarios(); mostrarToast('Usuário atualizado!'); }
    } catch { mostrarToast('Erro', 'erro'); }
  };

  const criarUsuario = async (e) => {
    e.preventDefault();
    setErroCriar('');
    setCarregandoCriar(true);
    const token = localStorage.getItem('token');
    try {
      const resp = await fetch('http://localhost:8000/usuarios/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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

  if (carregando) return <p className="text-slate-500 italic py-10 text-center">Carregando...</p>;

  return (
    <div className="rounded-xl border border-atend-border bg-atend-card overflow-hidden shadow-2xl">
      <div className="px-5 py-4 border-b border-atend-border flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Gerenciar Usuários</h3>
          <p className="text-xs text-slate-400">Apenas administradores têm acesso a esta tela</p>
        </div>
        <button onClick={() => setCriando(true)}
          className="bg-atend-verde hover:opacity-90 text-slate-950 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg transition-all shadow-lg shadow-atend-verde/10">
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
              <tr key={u.id} className="hover:bg-slate-900/20 transition-colors">
                <td className="px-5 py-4 text-slate-500">{u.id}</td>
                <td className="px-5 py-4 font-medium text-white">{u.nome}</td>
                <td className="px-5 py-4 text-slate-400">{u.username}</td>
                <td className="px-5 py-4 text-slate-400">{u.sexo === 'M' ? 'Masculino' : 'Feminino'}</td>
                <td className="px-5 py-4">
                  <button onClick={() => toggleAdmin(u)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                      u.admin ? 'bg-atend-verde/10 text-atend-verde border border-atend-verde/20' : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}>
                    {u.admin ? 'Admin' : 'Usuário'}
                  </button>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => setEditando(u)}
                      className="text-xs font-semibold text-atend-verde border border-atend-verde/30 bg-atend-verde/5 px-2.5 py-1 rounded transition-all">✏️</button>
                    <button onClick={() => setConfirmExcluir({ aberto: true, id: u.id, nome: u.nome })}
                      className="text-xs font-semibold text-rose-400 border border-rose-500/30 bg-rose-500/5 px-2.5 py-1 rounded transition-all">🗑</button>
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
          <div className="relative w-full max-w-md bg-atend-card border border-atend-border rounded-2xl shadow-2xl p-6 z-10">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-atend-verde shadow-[0_0_15px_#2ecc71] rounded-t-2xl" />
            <div className="flex justify-between items-center mb-6 mt-1">
              <h2 className="text-lg font-bold text-white">Editar Usuário</h2>
              <button onClick={() => setEditando(null)} className="text-slate-500 hover:text-white text-xl">&times;</button>
            </div>
            <form onSubmit={salvarEdicao} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nome</label>
                <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
                <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60" />
              </div>
              <button type="submit"
                className="w-full bg-atend-verde hover:opacity-90 text-slate-950 text-sm font-bold py-2.5 rounded-lg transition-all">
                Salvar
              </button>
            </form>
          </div>
        </div>
      )}

      {criando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => setCriando(false)} />
          <div className="relative w-full max-w-md bg-atend-card border border-atend-border rounded-2xl shadow-2xl p-6 z-10">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-atend-verde shadow-[0_0_15px_#2ecc71] rounded-t-2xl" />
            <div className="flex justify-between items-center mb-6 mt-1">
              <h2 className="text-lg font-bold text-white">Novo Usuário</h2>
              <button onClick={() => setCriando(false)} className="text-slate-500 hover:text-white text-xl">&times;</button>
            </div>
            <form onSubmit={criarUsuario} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nome</label>
                <input type="text" value={formCriar.nome} onChange={(e) => setFormCriar({ ...formCriar, nome: e.target.value })}
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Sexo</label>
                <select value={formCriar.sexo} onChange={(e) => setFormCriar({ ...formCriar, sexo: e.target.value })}
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60">
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
                <input type="text" value={formCriar.username} onChange={(e) => setFormCriar({ ...formCriar, username: e.target.value })}
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Senha</label>
                <input type="password" value={formCriar.senha} onChange={(e) => setFormCriar({ ...formCriar, senha: e.target.value })}
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60" required />
              </div>
              {erroCriar && <div className="bg-rose-500/10 text-rose-400 text-xs rounded-lg p-3 text-center">⚠️ {erroCriar}</div>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setCriando(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium py-2.5 rounded-lg border border-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={carregandoCriar}
                  className="flex-1 bg-atend-verde hover:opacity-90 disabled:opacity-50 text-slate-950 text-sm font-bold py-2.5 rounded-lg">
                  {carregandoCriar ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;