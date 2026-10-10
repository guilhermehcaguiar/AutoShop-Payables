import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { apiJson } from '../api.js';
import { parseValorBR, formatarValorBR } from '../formatar.js';
import { normalizarBoleto } from '../boleto.js';
import { dadosBoleto } from '../dadosBoleto.js';
import { moeda, formatarData } from '../boletosView.js';
import Dialog from './Dialog.jsx';
import Icon from './Icon.jsx';
const ScannerBoleto = lazy(() => import('./ScannerBoleto.jsx'));

function chaveRascunho() {
  try { const p = JSON.parse(localStorage.getItem('usuarioPerfil') || '{}'); return `atend-rascunho-${p.username || p.nome || ''}`; } catch { return 'atend-rascunho'; }
}
function formularioInicial(boleto, chave) {
  if (boleto) return { fornecedor: boleto.fornecedor, valor: Number(boleto.valor).toFixed(2).replace('.', ','), vencimento: boleto.vencimento, codigo_barras: boleto.codigo_barras || '', categoria: boleto.categoria || '', descricao: boleto.descricao || '', previsao: !boleto.codigo_barras, recorrente: false };
  try { const salvo = JSON.parse(sessionStorage.getItem(chave) || 'null'); if (salvo) return salvo; } catch { /* Rascunho inválido. */ }
  return { fornecedor: '', valor: '', vencimento: '', codigo_barras: '', categoria: '', descricao: '', previsao: false, recorrente: false };
}
export default function ModalNovoBoleto({ aberto, onFechar, onBoletoCriado, boletoEditando, podeRecorrencia = false }) {
  const [chave] = useState(chaveRascunho);
  const [inicial] = useState(() => formularioInicial(boletoEditando, chave));
  const [form, setForm] = useState(inicial);
  const [categorias, setCategorias] = useState([]);
  const [novaCategoria, setNovaCategoria] = useState(false);
  const [fornecedores, setFornecedores] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [scanner, setScanner] = useState(false);
  const [revisao, setRevisao] = useState(null);
  const [dataLida, setDataLida] = useState('');
  const [contaSalva, setContaSalva] = useState(false);
  const lock = useRef(false);
  const dialog = useRef(null);
  const categoriaInput = useRef(null);
  const editar = !!boletoEditando;
  const alterar = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));
  const alterado = JSON.stringify(form) !== JSON.stringify(inicial);
  useEffect(() => {
    if (!editar && !contaSalva) {
      try { sessionStorage.setItem(chave, JSON.stringify(form)); } catch { /* Armazenamento indisponível. */ }
    }
  }, [form, editar, chave, contaSalva]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([apiJson('/boletos/categorias-utilizadas', { signal: controller.signal }), apiJson('/fornecedores/', { signal: controller.signal })]).then(([c, f]) => {
      if (controller.signal.aborted) return;
      if (c.status === 'fulfilled') setCategorias(c.value);
      if (f.status === 'fulfilled') setFornecedores(f.value);
      if (c.status === 'rejected' || f.status === 'rejected') setAviso('As sugestões não carregaram. Você pode preencher os campos manualmente.');
    });
    return () => controller.abort();
  }, []);
  let erroCodigo = '';
  if (!form.previsao && form.codigo_barras) { try { normalizarBoleto(form.codigo_barras); } catch (e) { erroCodigo = e.message; } }
  const ler = codigo => {
    setScanner(false);
    try { const dados = dadosBoleto(codigo); setForm(f => ({ ...f, codigo_barras: dados.codigo, previsao: false })); setRevisao(dados); setDataLida(dados.vencimentos.at(-1) || ''); }
    catch (e) { setErro(e.message); }
  };
  const salvar = async e => {
    e.preventDefault(); if (lock.current) return;
    setErro('');
    const valor = parseValorBR(form.valor);
    if (!valor || valor <= 0) { setErro('Informe um valor maior que zero. Ex.: 1.500,00.'); return; }
    let codigo = '';
    try { if (!form.previsao) codigo = normalizarBoleto(form.codigo_barras); } catch (e) { setErro(e.message); return; }
    if (!form.fornecedor.trim() || !form.categoria.trim() || !form.vencimento) { setErro('Preencha fornecedor, categoria e vencimento.'); return; }
    lock.current = true; setSalvando(true);
    try {
      const dados = { fornecedor: form.fornecedor.trim(), valor, vencimento: form.vencimento, codigo_barras: codigo, categoria: form.categoria.trim(), descricao: form.descricao.trim() || null };
      if (!contaSalva) {
        await apiJson(editar ? `/boletos/${boletoEditando.id}` : '/boletos/', { method: editar ? 'PUT' : 'POST', body: JSON.stringify(dados) });
        setContaSalva(true); sessionStorage.removeItem(chave); onBoletoCriado();
      }
      if (!editar && form.recorrente) await apiJson('/boletos/recorrentes', { method: 'POST', body: JSON.stringify({ ...dados, vencimento_dia: Number(form.vencimento.slice(8, 10)) }) });
      onFechar();
    } catch (e) { setErro(e.message); }
    finally { lock.current = false; setSalvando(false); }
  };
  const fechar = () => { if (!editar) sessionStorage.removeItem(chave); onFechar(); };
  return <><Dialog ref={dialog} aberto={aberto} titulo={editar ? 'Editar Boleto' : 'Novo Boleto'} descricao="Preencha os dados e confira antes de salvar." onFechar={fechar} ocupado={salvando} alterado={alterado && !contaSalva} largo>
    {contaSalva ? <><div className="notice notice-success" role="status">A conta foi salva. Falta concluir o modelo recorrente; tentar novamente não duplicará a conta.</div>{erro && <p role="alert" className="notice notice-error">{erro}</p>}<div className="dialog-actions"><button type="button" className="button-secondary" disabled={salvando} onClick={fechar}>Concluir sem modelo</button><button type="button" className="button-primary" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Tentar salvar modelo'}</button></div></> : <form onSubmit={salvar}>
      {!editar && inicial.fornecedor && <p className="notice">Rascunho recuperado. Confira os dados antes de salvar.</p>}
      {aviso && <p className="notice" role="status">{aviso}</p>}
      <fieldset disabled={salvando} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="notice"><div className="actions-row"><button type="button" className="button-secondary" title="Escanear código de barras" onClick={() => setScanner(true)}><Icon name="camera" size={18} />Escanear boleto</button><span>Use a câmera, uma imagem ou cole a linha digitável abaixo.</span></div></div>
        {revisao && <div className="notice"><strong>Confira os dados lidos</strong><p>Valor: {revisao.valor ? moeda(revisao.valor) : 'Não informado no código'}</p>{revisao.vencimentos.length ? <div className="field"><label htmlFor="data-lida">Vencimento identificado</label><select id="data-lida" value={dataLida} onChange={e => setDataLida(e.target.value)}>{[...revisao.vencimentos].reverse().map(d => <option key={d} value={d}>{formatarData(d)}</option>)}</select><small>O fator de vencimento é reutilizado. Compare com a data impressa no boleto.</small></div> : <p>Vencimento não identificado. Preencha manualmente.</p>}<div className="actions-row"><button type="button" className="button-primary" onClick={() => { setForm(f => ({ ...f, codigo_barras: revisao.codigo, previsao: false, ...(revisao.valor ? { valor: revisao.valor.toFixed(2).replace('.', ',') } : {}), ...(dataLida ? { vencimento: dataLida } : {}) })); setRevisao(null); }}>Aplicar dados lidos</button><button type="button" className="button-secondary" onClick={() => setRevisao(null)}>Descartar leitura</button></div></div>}
        <label className="field-hint field-inline" style={{ marginBottom: 16 }}><input type="checkbox" checked={form.previsao} onChange={e => alterar('previsao', e.target.checked)} />Ainda não recebi o boleto (conta prevista)</label>
        {!form.previsao && <div className="field"><label htmlFor="boleto-codigo">Código de barras / linha digitável *</label><input id="boleto-codigo" inputMode="numeric" value={form.codigo_barras} onChange={e => alterar('codigo_barras', e.target.value)} aria-invalid={!!erroCodigo} aria-describedby="ajuda-codigo" placeholder="44, 47 ou 48 dígitos" required /><small id="ajuda-codigo" style={erroCodigo ? { color: '#ef8c8c' } : undefined}>{erroCodigo || 'Os dígitos verificadores são conferidos antes de salvar.'}</small>{form.codigo_barras && !erroCodigo && <button type="button" className="link-button" onClick={() => ler(form.codigo_barras)}>Conferir valor e vencimento do código</button>}</div>}
        <div className="field"><label htmlFor="boleto-fornecedor">Fornecedor *</label><input id="boleto-fornecedor" value={form.fornecedor} onChange={e => alterar('fornecedor', e.target.value)} list="boleto-fornecedores" required /><datalist id="boleto-fornecedores">{fornecedores.map(f => <option key={f.id} value={f.nome} />)}</datalist></div>
        <div className="field-row"><div className="field"><label htmlFor="boleto-valor">Valor (R$) *</label><input id="boleto-valor" inputMode="decimal" value={form.valor} onChange={e => alterar('valor', e.target.value)} onBlur={() => { const v = parseValorBR(form.valor); if (v !== null) alterar('valor', formatarValorBR(v)); }} placeholder="450,00" required /></div><div className="field"><label htmlFor="boleto-vencimento">Vencimento *</label><input id="boleto-vencimento" type="date" value={form.vencimento} onChange={e => alterar('vencimento', e.target.value)} required /></div></div>
        <div className="field">
          <div className="actions-row" style={{ justifyContent: 'space-between' }}>
            <label htmlFor="boleto-categoria">{novaCategoria ? 'Nome da nova categoria *' : 'Categoria *'}</label>
            <button type="button" className="button-secondary" aria-pressed={novaCategoria} onClick={() => { setNovaCategoria(v => !v); if (!novaCategoria) alterar('categoria', ''); categoriaInput.current?.focus(); }}>
              <Icon name={novaCategoria ? 'categoria' : 'mais'} size={16} />{novaCategoria ? 'Ver categorias existentes' : 'Nova categoria'}
            </button>
          </div>
          <input ref={categoriaInput} id="boleto-categoria" value={form.categoria} onChange={e => alterar('categoria', e.target.value)} list={novaCategoria ? undefined : 'boleto-categorias'} placeholder={novaCategoria ? 'Ex.: Manutenção de equipamentos' : 'Escolha ou digite uma categoria'} aria-describedby="ajuda-categoria" required />
          <datalist id="boleto-categorias">{categorias.map(c => <option key={c} value={c} />)}</datalist>
          <small id="ajuda-categoria">{novaCategoria ? 'A nova categoria será criada ao salvar o boleto e ficará disponível nos próximos cadastros.' : 'Escolha uma sugestão ou use Nova categoria para cadastrar outro nome.'}</small>
        </div>
        <div className="field"><label htmlFor="boleto-descricao">Descrição</label><textarea id="boleto-descricao" value={form.descricao} onChange={e => alterar('descricao', e.target.value)} rows={2} /></div>
        {!editar && podeRecorrencia && <div className="notice"><label className="field-inline"><input type="checkbox" checked={form.recorrente} onChange={e => alterar('recorrente', e.target.checked)} />Salvar também como modelo recorrente</label><p>O modelo guarda valor, fornecedor e dia do vencimento. As próximas contas serão previsões, com código próprio após o recebimento. Gerencie os modelos na Administração.</p></div>}
      </fieldset>{erro && <p className="notice notice-error" role="alert">{erro}</p>}<div className="dialog-actions"><button type="button" className="button-secondary" disabled={salvando} onClick={() => dialog.current?.solicitarFechamento()}>Cancelar</button><button type="submit" className="button-primary" disabled={salvando || !!erroCodigo}>{salvando ? 'Salvando...' : 'Salvar Boleto'}</button></div>
    </form>}
  </Dialog>{scanner && <Suspense fallback={<Dialog aberto titulo="Carregando scanner" onFechar={() => setScanner(false)}><p role="status">Carregando leitor...</p></Dialog>}><ScannerBoleto aberto onFechar={() => setScanner(false)} onScan={ler} /></Suspense>}</>;
}
