import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../api.js';
import ScannerBoleto from './ScannerBoleto.jsx';

function ModalNovoBoleto({ aberto, onFechar, onBoletoCriado, boletoEditando }) {
  const [fornecedor, setFornecedor] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarDropdownFornecedor, setMostrarDropdownFornecedor] = useState(false);
  const [recorrente, setRecorrente] = useState(false);
  const [nMeses, setNMeses] = useState(3);
  const [mostrarScanner, setMostrarScanner] = useState(false);
  const editando = !!boletoEditando;

  const fornecedoresFiltrados = fornecedores.filter((f) =>
    f.nome.toLowerCase().includes(fornecedor.toLowerCase())
  );

  useEffect(() => {
    if (!aberto) return;
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    const timer = setTimeout(() => {
      if (boletoEditando) {
        setFornecedor(boletoEditando.fornecedor);
        setValor(boletoEditando.valor.toFixed(2).replace('.', ','));
        setVencimento(boletoEditando.vencimento);
        setCodigoBarras(boletoEditando.codigo_barras || '');
        setCategoria(boletoEditando.categoria || '');
        setDescricao(boletoEditando.descricao || '');
      } else {
        setFornecedor(''); setValor(''); setVencimento('');
        setCodigoBarras(''); setCategoria('');
        setDescricao('');
      }
      setRecorrente(false);
      setNMeses(3);
      setErro('');
    }, 0);
    apiFetch('/boletos/categorias-utilizadas', { headers })
      .then((r) => r.ok && r.json()).then(setCategorias).catch(() => {});
    apiFetch('/fornecedores/', { headers })
      .then((r) => r.ok && r.json()).then(setFornecedores).catch(() => {});
    return () => clearTimeout(timer);
  }, [aberto, boletoEditando]);

  const adicionarMeses = (data, meses) => {
    const d = new Date(data + 'T12:00:00');
    const dia = d.getDate();
    d.setMonth(d.getMonth() + meses);
    if (d.getDate() !== dia) d.setDate(0);
    return d.toISOString().slice(0, 10);
  };

  const boletosPreview = useMemo(() => {
    if (!recorrente || !vencimento || !valor) return [];
    const lista = [];
    for (let i = 0; i < nMeses; i++) {
      lista.push({
        mes: i === 0 ? 'Este mês' : `+${i} mês`,
        vencimento: adicionarMeses(vencimento, i),
        valor: valor,
      });
    }
    return lista;
  }, [recorrente, vencimento, valor, nMeses]);

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
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    const bodyBase = {
      fornecedor,
      valor: parseFloat(valor.replace(',', '.')),
      codigo_barras: codigoBarras || null,
      categoria: categoria || null,
      descricao: descricao || null,
    };
    try {
      if (editando) {
        const resp = await apiFetch(`/boletos/${boletoEditando.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ ...bodyBase, vencimento }),
        });
        const dados = await resp.json();
        if (!resp.ok) { setErro(dados.detail || 'Erro ao salvar boleto'); setCarregando(false); return; }
        onBoletoCriado();
        onFechar();
        setCarregando(false);
        return;
      }
      const boletosCriar = recorrente ? boletosPreview : [{ vencimento, ...bodyBase }];
      let sucesso = 0;
      for (const b of boletosCriar) {
        const resp = await apiFetch('/boletos/', {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...b, vencimento: b.vencimento }),
        });
        if (resp.ok) sucesso++;
      }
      await autoSalvarFornecedor(token);
      if (sucesso > 0) {
        onBoletoCriado();
        onFechar();
      } else {
        setErro('Erro ao criar boletos');
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
      <div className="relative w-full max-w-md bg-atend-card border border-atend-border rounded-2xl shadow-2xl p-6 z-10 max-h-[85vh] overflow-y-auto animate-fade-in-scale">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-atend-verde shadow-[0_0_15px_#2ecc71] rounded-t-2xl" />
        <div className="flex justify-between items-center mb-6 mt-1">
          <h2 className="text-lg font-bold text-white">{editando ? 'Editar' : 'Novo'} Boleto</h2>
          <button onClick={onFechar} className="text-slate-500 hover:text-white text-xl leading-none active:scale-[0.98] focus:outline-none transition-all duration-200">&times;</button>
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
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60 transition-colors active:scale-[0.98]"
              required>
              <option value="" className="text-slate-600">Selecione...</option>
              {categorias.map((cat, i) => (<option key={i} value={cat}>{cat}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Código de Barras</label>
            <div className="flex gap-2">
              <input type="text" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value.replace(/\D/g, ''))}
                placeholder="Código do boleto"
                className="flex-1 bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors"
                required />
              <button type="button" onClick={() => setMostrarScanner(true)}
                className="shrink-0 bg-atend-verde/15 hover:bg-atend-verde/25 border border-atend-verde/30 rounded-lg px-3 py-2.5 text-lg leading-none transition-all duration-200 active:scale-95"
                title="Escanear código de barras">
                📷
              </button>
            </div>
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
          {!editando && (
            <div className="flex items-center gap-3 pt-1">
              <button type="button" role="switch" aria-checked={recorrente}
                onClick={() => setRecorrente(!recorrente)}
                className={`relative w-11 h-6 rounded-full transition-all duration-300 shrink-0 ${recorrente ? 'bg-atend-verde shadow-[0_0_8px_rgba(34,197,94,0.3)]' : 'bg-slate-700 hover:bg-slate-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${recorrente ? 'translate-x-5 scale-105' : 'translate-x-0 scale-100'}`} />
              </button>
              <div>
                <p className="text-sm font-medium text-white">Repetir mensalmente</p>
                <p className="text-xs text-slate-500">Criar boletos para os próximos meses</p>
              </div>
            </div>
          )}
          {recorrente && !editando && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Número de meses</label>
              <input type="number" min={1} max={24} value={nMeses} onChange={(e) => setNMeses(Math.min(24, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60 transition-colors" />
              {boletosPreview.length > 1 && (
                <div className="mt-3 bg-slate-900/30 rounded-lg overflow-hidden border border-atend-border/50">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-atend-border/50 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="px-3 py-2">Período</th>
                        <th className="px-3 py-2">Vencimento</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-atend-border/30 text-slate-300">
                      {boletosPreview.map((b, i) => (
                        <tr key={i} className="hover:bg-slate-900/20">
                          <td className="px-3 py-2">{b.mes}</td>
                          <td className="px-3 py-2">{new Date(b.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            R$ {parseFloat(b.valor.replace(',', '.')).toFixed(2).replace('.', ',')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {erro && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg p-3 text-center">⚠️ {erro}</div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onFechar}
              className="flex-1 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] focus:outline-none text-slate-300 text-sm font-medium py-2.5 rounded-lg transition-all duration-200 border border-slate-700">
              Cancelar
            </button>
            <button type="submit" disabled={carregando}
              className="flex-1 bg-atend-verde hover:opacity-90 active:scale-[0.98] focus:outline-none disabled:opacity-50 text-slate-950 text-sm font-bold py-2.5 rounded-lg transition-all duration-200">
              {carregando ? 'Salvando...' : editando ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>

      <ScannerBoleto
        aberto={mostrarScanner}
        onScan={(codigo) => { setCodigoBarras(codigo); setMostrarScanner(false); }}
        onFechar={() => setMostrarScanner(false)}
      />
    </div>
  );
}

export default ModalNovoBoleto;
