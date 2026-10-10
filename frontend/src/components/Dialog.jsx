import { useEffect, useId, useRef, useState, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

let abertos = 0;
let overflowAnterior = '';

export default function Dialog({ aberto, titulo, descricao, onFechar, ocupado = false, alterado = false, children, largo = false, label, ref: controle }) {
  const ref = useRef(null);
  const tituloId = useId();
  const descricaoId = useId();
  const [descartar, setDescartar] = useState(false);
  const fechar = () => {
    if (ocupado) return;
    if (alterado) setDescartar(true);
    else { setDescartar(false); onFechar(); }
  };
  useImperativeHandle(controle, () => ({ solicitarFechamento: fechar }));

  useEffect(() => {
    if (!aberto) return;
    const dialog = ref.current;
    const focoAnterior = document.activeElement;
    if (abertos++ === 0) { overflowAnterior = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    dialog.showModal();
    return () => {
      dialog.close();
      if (--abertos === 0) document.body.style.overflow = overflowAnterior;
      if (focoAnterior?.isConnected) focoAnterior.focus();
    };
  }, [aberto]);

  if (!aberto) return null;
  return createPortal(
    <dialog ref={ref} className={`app-dialog ${largo ? 'app-dialog-wide' : ''}`} aria-label={label} aria-labelledby={label ? undefined : tituloId} aria-describedby={descricao ? descricaoId : undefined} aria-busy={ocupado} onCancel={e => { e.preventDefault(); fechar(); }} onClick={e => {
      const r = e.currentTarget.getBoundingClientRect();
      if (e.target === e.currentTarget && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) fechar();
    }}>
      <header className="dialog-header"><div><h2 id={tituloId}>{titulo}</h2>{descricao && <p id={descricaoId}>{descricao}</p>}</div><button type="button" className="icon-button" aria-label="Fechar janela" disabled={ocupado} onClick={fechar}><Icon name="fechar" /></button></header>
      {descartar ? <div className="dialog-discard"><h3>Descartar alterações?</h3><p>Os dados preenchidos ainda não foram salvos.</p><div className="dialog-actions"><button type="button" className="button-secondary" onClick={() => setDescartar(false)}>Continuar editando</button><button type="button" className="button-danger" onClick={() => { setDescartar(false); onFechar(); }}>Descartar</button></div></div> : children}
    </dialog>, document.body,
  );
}
