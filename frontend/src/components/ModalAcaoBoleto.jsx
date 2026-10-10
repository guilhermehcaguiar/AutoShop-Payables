import Dialog from './Dialog.jsx';
import Icon from './Icon.jsx';
import { moeda, formatarData } from '../boletosView.js';

export default function ModalAcaoBoleto({ aberto, boleto, onFechar, onEditar, onPagar, onDeletar, onDesfazerPagamento }) {
  if (!boleto) return null;
  const pago = boleto.status === 'Pago';
  const campos = [['Fornecedor', boleto.fornecedor], ['Valor', moeda(boleto.valor)], ['Vencimento', formatarData(boleto.vencimento)], ['Categoria', boleto.categoria], ['Status', pago ? 'Pago' : 'Pendente'], ['Descrição', boleto.descricao], ...(pago ? [['Pago em', formatarData(boleto.data_pagamento)], ['Método', boleto.metodo_pagamento], ['Banco', boleto.banco]] : [])];
  return <Dialog aberto={aberto} titulo="Detalhes do boleto" onFechar={onFechar}><dl className="detail-grid">{campos.map(([nome, valor]) => <div key={nome}><dt>{nome}</dt><dd>{valor || '—'}</dd></div>)}</dl><div className="field"><label htmlFor="detalhe-codigo">Código de barras</label><input id="detalhe-codigo" readOnly value={boleto.codigo_barras || 'Previsão: boleto ainda não recebido'} /></div><div className="dialog-actions"><button className="button-secondary" type="button" onClick={() => onEditar(boleto)}><Icon name="editar" size={16} />Editar</button>{pago ? <button className="button-secondary" type="button" onClick={() => onDesfazerPagamento(boleto.id)}>Desfazer pagamento</button> : <><button className="button-danger" type="button" onClick={() => onDeletar(boleto.id)}><Icon name="excluir" size={16} />Excluir</button><button className="button-primary" type="button" onClick={() => onPagar(boleto.id)}>Registrar pagamento</button></>}</div></Dialog>;
}
