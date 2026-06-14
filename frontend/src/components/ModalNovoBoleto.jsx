import { useState, useEffect } from 'react';

function ModalNovoBoleto({ aberto, onFechar, onBoletoCriado, boletoEditando }) {
  const [fornecedor, setFornecedor] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [categoria, setCategoria] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const editando = !!boletoEditando;

  useEffect(() => {
    if (!aberto) return;
    if (boletoEditando) {
      setFornecedor(boletoEditando.fornecedor);
      setValor(boletoEditando.valor.toFixed(2).replace('.', ','));
      setVencimento(boletoEditando.vencimento);
      setCodigoBarras(boletoEditando.codigo_barras || '');
      setCategoria(boletoEditando.categoria || '');
    } else {
      setFornecedor(''); setValor(''); setVencimento('');
      setCodigoBarras(''); setCategoria('');
    }
    setErro('');
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    fetch('http://localhost:8000/categorias/', { headers })
      .then((r) => r.ok && r.json()).then(setCategorias).catch(() => {});
    fetch('http://localhost:8000/fornecedores/', { headers })
      .then((r) => r.ok && r.json()).then(setFornecedores).catch(() => {});
  }, [aberto, boletoEditando]);

  const autoSalvarFornecedor = async (token) => {
    const existe = fornecedores.some((f) => f.nome.toLowerCase() === fornecedor.toLowerCase());
    if (!existe && fornecedor.trim()) {
      await fetch('http://localhost:8000/fornecedores/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ nome: fornecedor.trim() }),
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    const token = localStorage.getItem('token');
    const url = editando
      ? `http://localhost:8000/boletos/${boletoEditando.id}`
      : 'http://localhost:8000/boletos/';
    const method = editando ? 'PUT' : 'POST';
    try {
      const resposta = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          fornecedor,
          valor: parseFloat(valor.replace(',', '.')),
          vencimento,
          codigo_barras: codigoBarras || null,
          categoria: categoria || null,
        }),
      });
      const dados = await resposta.json();
      if (resposta.ok) {
        if (!editando) await autoSalvarFornecedor(token);
        onBoletoCriado();
        onFechar();
      } else {
        setErro(dados.detail || 'Erro ao salvar boleto');
      }
    } catch {
      setErro('Erro de conexão com o servidor');
    } finally {
      setCarregando(false);
    }
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative w-full max-w-md bg-atend-card border border-atend-border rounded-2xl shadow-2xl p-6 z-10">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-atend-verde shadow-[0_0_15px_#2ecc71] rounded-t-2xl" />
        <div className="flex justify-between items-center mb-6 mt-1">
          <h2 className="text-lg font-bold text-white">{editando ? 'Editar' : 'Novo'} Boleto</h2>
          <button onClick={onFechar} className="text-slate-500 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Fornecedor</label>
            <input type="text" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}
              placeholder="Ex: Auto Peças Silva"
              list="lista-fornecedores"
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors"
              required />
            <datalist id="lista-fornecedores">
              {fornecedores.map((f) => (<option key={f.id} value={f.nome} />))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Valor (R$)</label>
            <input type="text" value={valor} onChange={(e) => setValor(e.target.value)}
              placeholder="Ex: 450,00"
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors"
              required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Vencimento</label>
            <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)}
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60 transition-colors "
              required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Categoria <span className="text-slate-600 normal-case">(opcional)</span>
            </label>
            <input type="text" value={categoria} onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Aluguel, Água, Peças"
              list="lista-categorias"
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" />
            <datalist id="lista-categorias">
              {categorias.map((cat, i) => (<option key={i} value={cat} />))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Código de Barras <span className="text-slate-600 normal-case">(opcional)</span>
            </label>
            <input type="text" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)}
              placeholder="Código do boleto"
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" />
          </div>
          {erro && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg p-3 text-center">⚠️ {erro}</div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onFechar}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium py-2.5 rounded-lg transition-colors border border-slate-700">
              Cancelar
            </button>
            <button type="submit" disabled={carregando}
              className="flex-1 bg-atend-verde hover:opacity-90 disabled:opacity-50 text-slate-950 text-sm font-bold py-2.5 rounded-lg transition-all">
              {carregando ? 'Salvando...' : editando ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ModalNovoBoleto;