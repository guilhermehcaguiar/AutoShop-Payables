import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';

function ModalNovoBoleto({ aberto, onFechar, onBoletoCriado, boletoEditando }) {
  const [fornecedor, setFornecedor] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [banco, setBanco] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [bancos, setBancos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarDropdownFornecedor, setMostrarDropdownFornecedor] = useState(false);
  const editando = !!boletoEditando;

  const fornecedoresFiltrados = fornecedores.filter((f) =>
    f.nome.toLowerCase().includes(fornecedor.toLowerCase())
  );

  useEffect(() => {
    if (!aberto) return;
    if (boletoEditando) {
      setFornecedor(boletoEditando.fornecedor);
      setValor(boletoEditando.valor.toFixed(2).replace('.', ','));
      setVencimento(boletoEditando.vencimento);
      setCodigoBarras(boletoEditando.codigo_barras || '');
      setCategoria(boletoEditando.categoria || '');
      setDescricao(boletoEditando.descricao || '');
      setMetodoPagamento(boletoEditando.metodo_pagamento || '');
      setBanco(boletoEditando.banco || '');
    } else {
      setFornecedor(''); setValor(''); setVencimento('');
      setCodigoBarras(''); setCategoria('');
      setDescricao(''); setMetodoPagamento(''); setBanco('');
    }
    setErro('');
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    apiFetch('/boletos/categorias-utilizadas', { headers })
      .then((r) => r.ok && r.json()).then(setCategorias).catch(() => {});
    apiFetch('/fornecedores/', { headers })
      .then((r) => r.ok && r.json()).then(setFornecedores).catch(() => {});
    apiFetch('/boletos/bancos-utilizados', { headers })
      .then((r) => r.ok && r.json()).then(setBancos).catch(() => {});
  }, [aberto, boletoEditando]);

  const autoSalvarFornecedor = async (token) => {
    const existe = fornecedores.some((f) => f.nome.toLowerCase() === fornecedor.toLowerCase());
    if (!existe && fornecedor.trim()) {
      await apiFetch('/fornecedores/', {
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
      ? `/boletos/${boletoEditando.id}`
      : '/boletos/';
    const method = editando ? 'PUT' : 'POST';
    try {
      const resposta = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          fornecedor,
          valor: parseFloat(valor.replace(',', '.')),
          vencimento,
          codigo_barras: codigoBarras || null,
          categoria: categoria || null,
          descricao: descricao || null,
          metodo_pagamento: metodoPagamento || null,
          banco: banco || null,
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
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Fornecedor</label>
            <input type="text" value={fornecedor} onChange={(e) => { setFornecedor(e.target.value); setMostrarDropdownFornecedor(true); }}
              onFocus={() => setMostrarDropdownFornecedor(true)}
              onBlur={() => setTimeout(() => setMostrarDropdownFornecedor(false), 200)}
              placeholder="Ex: Auto Peças Silva"
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors"
              required />
            {mostrarDropdownFornecedor && fornecedoresFiltrados.length > 0 && (
              <div className="absolute z-20 w-full bg-atend-card border border-atend-border rounded-lg mt-1 max-h-40 overflow-y-auto shadow-xl">
                {fornecedoresFiltrados.map((f) => (
                  <button key={f.id} type="button" onMouseDown={() => { setFornecedor(f.nome); setMostrarDropdownFornecedor(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-atend-verde/20 transition-colors">
                    {f.nome}
                  </button>
                ))}
              </div>
            )}
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
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60 transition-colors"
              required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Categoria</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60 transition-colors"
              required>
              <option value="" className="text-slate-600">Selecione...</option>
              {categorias.map((cat, i) => (<option key={i} value={cat}>{cat}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Código de Barras</label>
            <input type="text" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value.replace(/\D/g, ''))}
              placeholder="Código do boleto"
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors"
              required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Descrição <span className="text-slate-600 normal-case">(opcional)</span>
            </label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição do boleto"
              rows="2"
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Método Pagamento <span className="text-slate-600 normal-case">(opcional)</span>
            </label>
            <select value={metodoPagamento} onChange={(e) => setMetodoPagamento(e.target.value)}
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60 transition-colors">
              <option value=""></option>
              <option value="Pix">Pix</option>
              <option value="Transferência">Transferência</option>
              <option value="Cartão">Cartão</option>
              <option value="Dinheiro">Dinheiro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Banco <span className="text-slate-600 normal-case">(opcional)</span>
            </label>
            <input type="text" value={banco} onChange={(e) => setBanco(e.target.value)}
              placeholder="Ex: Itaú, Bradesco, Santander"
              list="lista-bancos"
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" />
            <datalist id="lista-bancos">
              {bancos.map((b, i) => (<option key={i} value={b} />))}
            </datalist>
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
