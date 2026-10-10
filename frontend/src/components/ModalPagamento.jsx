import { useEffect, useState, useRef } from 'react';
import { apiJson } from '../api.js';
import { moeda, dataLocal, formatarData } from '../boletosView.js';
import Dialog from './Dialog.jsx';

export default function ModalPagamento({ aberto, boletos, boleto, onFechar, onConfirmado }) {
  const contas = boletos || (boleto ? [boleto] : []);
  const [metodo, setMetodo] = useState('');
  const [banco, setBanco] = useState('');
  const [bancos, setBancos] = useState([]);
  const [data, setData] = useState(dataLocal);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);
  const lock = useRef(false);
  const dialog = useRef(null);
  useEffect(() => {
    if (!aberto) return;
    const controller = new AbortController();
    apiJson('/boletos/bancos-utilizados', { signal: controller.signal }).then(setBancos).catch(() => { /* Sugestões opcionais; o campo permite digitação. */ });
    return () => controller.abort();
  }, [aberto]);
  const confirmar = async e => {
    e.preventDefault(); if (lock.current) return;
    lock.current = true; setSalvando(true); setErro('');
    try {
      const dados = { metodo_pagamento: metodo, banco: metodo === 'Dinheiro' ? '' : banco.trim(), data_pagamento: data };
      await apiJson(contas.length === 1 ? `/boletos/${contas[0].id}/pagar` : '/boletos/pagar-lote', { method: contas.length === 1 ? 'PATCH' : 'POST', body: JSON.stringify({ ...dados, ...(contas.length > 1 ? { ids: contas.map(b => b.id) } : {}) }) });
      onConfirmado(contas[0].id, metodo, banco);
    } catch (e) { setErro(e.message); }
    finally { lock.current = false; setSalvando(false); }
  };
  return <Dialog ref={dialog} aberto={aberto} titulo="Registrar pagamento" descricao="Confirme os dados de um pagamento já realizado." onFechar={onFechar} ocupado={salvando} alterado={!!(metodo || banco)}>
    <div className="notice"><strong>{contas.length} {contas.length === 1 ? 'conta' : 'contas'} · {moeda(contas.reduce((s, b) => s + Number(b.valor), 0))}</strong><p>Este registro atualiza o financeiro. Nenhuma transferência será realizada.</p></div>
    <details style={{ margin: '16px 0' }} open={contas.length === 1}><summary>Contas incluídas</summary>{contas.map(b => <p key={b.id}>{b.fornecedor} · {moeda(b.valor)} · {formatarData(b.vencimento)}</p>)}</details>
    {contas.length === 1 && contas[0].codigo_barras && <div className="field"><label htmlFor="codigo-pagamento">Código de barras</label><div className="field-inline"><input id="codigo-pagamento" value={contas[0].codigo_barras} readOnly /><button type="button" className="button-secondary" onClick={async () => { try { await navigator.clipboard.writeText(contas[0].codigo_barras); setCopiado(true); } catch { setErro('Não foi possível copiar. Selecione o código e copie manualmente.'); } }}>{copiado ? 'Copiado!' : 'Copiar'}</button></div></div>}
    <form onSubmit={confirmar}><fieldset disabled={salvando} style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="field"><label htmlFor="pag-metodo">Método de pagamento *</label><select id="pag-metodo" value={metodo} onChange={e => setMetodo(e.target.value)} required><option value="">Selecione...</option>{['Boleto', 'Pix', 'Transferência', 'Cartão', 'Dinheiro'].map(m => <option key={m}>{m}</option>)}</select></div>
      {metodo !== 'Dinheiro' && <div className="field"><label htmlFor="pag-banco">Banco *</label><input id="pag-banco" value={banco} onChange={e => setBanco(e.target.value)} list="bancos-pag" placeholder="Ex.: Itaú, Bradesco" required /><datalist id="bancos-pag">{bancos.map(b => <option key={b} value={b} />)}</datalist></div>}
      <div className="field"><label htmlFor="pag-data">Data do pagamento *</label><input id="pag-data" type="date" max={dataLocal()} value={data} onChange={e => setData(e.target.value)} required /></div>
    </fieldset>{erro && <p className="notice-error" role="alert">{erro}</p>}<div className="dialog-actions"><button type="button" className="button-secondary" disabled={salvando} onClick={() => dialog.current?.solicitarFechamento()}>Cancelar</button><button type="submit" className="button-primary" disabled={salvando || !metodo || (metodo !== 'Dinheiro' && !banco.trim())}>{salvando ? 'Registrando...' : `Registrar ${contas.length === 1 ? 'pagamento' : `${contas.length} pagamentos`}`}</button></div></form>
  </Dialog>;
}
