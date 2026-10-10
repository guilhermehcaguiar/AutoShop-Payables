import { useId } from 'react';
import Icon from './Icon.jsx';

export default function AccordionSection({ indice, icone, titulo, descricao, children, aberto, onToggle }) {
  const id = useId();
  return <section className="page-accordion">
    <button type="button" id={`${id}-titulo`} className="page-accordion-toggle" aria-expanded={aberto} aria-controls={id} onClick={() => onToggle(indice)}>
      <span className="page-accordion-icon"><Icon name={icone} size={22} /></span>
      <span className="page-accordion-title"><span>{titulo}</span><small>{descricao}</small></span>
      <Icon name="chevron" size={18} className={`page-accordion-chevron ${aberto ? 'is-open' : ''}`} />
    </button>
    <div id={id} role="region" aria-labelledby={`${id}-titulo`} aria-hidden={!aberto} inert={!aberto} className={`page-accordion-region ${aberto ? 'is-open' : ''}`}><div className="page-accordion-content">{children}</div></div>
  </section>;
}
