import { useEffect } from 'react';
import Icon from './Icon.jsx';
export default function Toast({ mensagem, tipo, visivel, onFechar }) {
  useEffect(() => {
    if (!visivel || tipo === 'erro') return;
    const timer = setTimeout(onFechar, 5000);
    return () => clearTimeout(timer);
  }, [visivel, tipo, onFechar]);
  if (!visivel) return null;
  return <div className={`app-toast ${tipo === 'erro' ? 'toast-error' : ''}`} role={tipo === 'erro' ? 'alert' : 'status'}><Icon name={tipo === 'erro' ? 'alerta' : 'check'} /><span>{mensagem}</span><button type="button" className="icon-button" aria-label="Fechar mensagem" onClick={onFechar}><Icon name="fechar" size={18} /></button></div>;
}
