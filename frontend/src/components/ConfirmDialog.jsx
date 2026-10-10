import Dialog from './Dialog.jsx';
export default function ConfirmDialog({ aberto, titulo, mensagem, onConfirmar, onCancelar, carregando, confirmarTexto = 'Confirmar', perigo = true, erro }) {
  return <Dialog aberto={aberto} titulo={titulo} onFechar={onCancelar} ocupado={carregando}><p className="subtle">{mensagem}</p>{erro && <p className="notice notice-error" role="alert">{erro}</p>}<div className="dialog-actions"><button type="button" className="button-secondary" onClick={onCancelar} disabled={carregando}>Cancelar</button><button type="button" className={perigo ? 'button-danger' : 'button-primary'} onClick={onConfirmar} disabled={carregando}>{carregando ? 'Aguarde...' : confirmarTexto}</button></div></Dialog>;
}
