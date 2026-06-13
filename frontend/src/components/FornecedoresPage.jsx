import { useState, useEffect } from 'react';
import ConfirmDialog from './ConfirmDialog';

function FornecedoresPage({ mostrarToast }) {
  const [fornecedores, setFornecedores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nome: '', cnpj: '', telefone: '', email: '' });
  const [erro, setErro] = useState('');
  const [confirmExcluir, setConfirmExcluir] = useState({ aberto: false, id: null });

  const fetchFornecedores = async () => {
    const token = localStorage.getItem('token');
    try {
      const resp = await fetch('http://localhost:8000/fornecedores/', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resp.ok) setFornecedores(await resp.json());
    } catch {} finally { setCarregando(false); }
  };

  useEffect(() => { fetchFornecedores(); }, []);

  const abrirModal = (fornecedor = null) => {
    if (fornecedor) {
      setEditando(fornecedor);
      setForm({ nome: fornecedor.nome, cnpj: fornecedor.cnpj || '', telefone: fornecedor.telefone || '', email: fornecedor.email || '' });
    } else {
      setEditando(null);
      setForm({ nome: '', cnpj: '', telefone: '', email: '' });
    }
    setErro('');
    setModalAberto(true);
  };

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    const token = localStorage.getItem('token');
    const url = editando
      ? `http://localhost:8000/fornecedores/${editando.id}`
      : 'http://localhost:8000/fornecedores/';
    const method = editando ? 'PUT' : 'POST';
    try {
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (resp.ok) {
        setModalAberto(false);
        fetchFornecedores();
        mostrarToast(editando ? 'Fornecedor atualizado!' : 'Fornecedor cadastrado!');
      } else {
        const d = await resp.json();
        setErro(d.detail || 'Erro ao salvar');
      }
    } catch { setErro('Erro de conexão'); }
  };

  const excluir = async () => {
    const id = confirmExcluir.id;
    if (!id) return;
    const token = localStorage.getItem('token');
    try {
      const resp = await fetch(`http://localhost:8000/fornecedores/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resp.ok) { fetchFornecedores(); mostrarToast('Fornecedor excluído!'); }
    } catch { mostrarToast('Erro ao excluir', 'erro'); }
    finally { setConfirmExcluir({ aberto: false, id: null }); }
  };

  if (carregando) return <div className="text-center text-slate-500 py-10">Carregando...</div>;

  return (
    <div className="rounded-xl border border-atend-border bg-atend-card overflow-hidden shadow-2xl">
      <div className="px-5 py-4 border-b border-atend-border flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Fornecedores</h3>
          <p className="text-xs text-slate-400">Cadastro de fornecedores da oficina</p>
        </div>
        <button onClick={() => abrirModal()}
          className="bg-atend-verde hover:opacity-90 text-slate-950 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg transition-all shadow-lg shadow-atend-verde/10">
          + Novo
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-atend-border bg-slate-900/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <th className="px-5 py-4">Nome</th>
              <th className="px-5 py-4">CNPJ</th>
              <th className="px-5 py-4">Telefone</th>
              <th className="px-5 py-4">Email</th>
              <th className="px-5 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-atend-border/50 text-sm text-slate-300">
            {fornecedores.length === 0 ? (
              <tr><td colSpan="5" className="px-5 py-10 text-center text-slate-500 italic">Nenhum fornecedor cadastrado.</td></tr>
            ) : fornecedores.map((f) => (
              <tr key={f.id} className="hover:bg-slate-900/20 transition-colors">
                <td className="px-5 py-4 font-medium text-white">{f.nome}</td>
                <td className="px-5 py-4 text-slate-400">{f.cnpj || '-'}</td>
                <td className="px-5 py-4 text-slate-400">{f.telefone || '-'}</td>
                <td className="px-5 py-4 text-slate-400">{f.email || '-'}</td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => abrirModal(f)}
                      className="text-xs font-semibold text-atend-verde border border-atend-verde/30 bg-atend-verde/5 px-2.5 py-1 rounded transition-all">✏️</button>
                    <button onClick={() => setConfirmExcluir({ aberto: true, id: f.id })}
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
        titulo="Excluir Fornecedor"
        mensagem="Tem certeza que deseja excluir este fornecedor?"
        onConfirmar={excluir}
        onCancelar={() => setConfirmExcluir({ aberto: false, id: null })}
      />

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => setModalAberto(false)} />
          <div className="relative w-full max-w-md bg-atend-card border border-atend-border rounded-2xl shadow-2xl p-6 z-10">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-atend-verde shadow-[0_0_15px_#2ecc71] rounded-t-2xl" />
            <div className="flex justify-between items-center mb-6 mt-1">
              <h2 className="text-lg font-bold text-white">{editando ? 'Editar' : 'Novo'} Fornecedor</h2>
              <button onClick={() => setModalAberto(false)} className="text-slate-500 hover:text-white text-xl">&times;</button>
            </div>
            <form onSubmit={salvar} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nome *</label>
                <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">CNPJ</label>
                <input type="text" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Telefone</label>
                <input type="text" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60" />
              </div>
              {erro && <div className="bg-rose-500/10 text-rose-400 text-xs rounded-lg p-3 text-center">⚠️ {erro}</div>}
              <button type="submit"
                className="w-full bg-atend-verde hover:opacity-90 text-slate-950 text-sm font-bold py-2.5 rounded-lg transition-all">
                {editando ? 'Atualizar' : 'Salvar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FornecedoresPage;