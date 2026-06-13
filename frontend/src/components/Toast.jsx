import { useEffect } from 'react';

function Toast({ mensagem, tipo, visivel, onFechar }) {
  useEffect(() => {
    if (visivel) {
      const timer = setTimeout(onFechar, 3000);
      return () => clearTimeout(timer);
    }
  }, [visivel, onFechar]);

  if (!visivel) return null;

  const bgColor = tipo === 'sucesso' ? 'bg-emerald-600' : 'bg-rose-600';
  const icone = tipo === 'sucesso' ? '✅' : '⚠️';

  return (
    <div className="fixed top-5 right-5 z-[60] animate-fade-in">
      <div className={`${bgColor} text-white text-sm font-medium px-5 py-3 rounded-lg shadow-2xl flex items-center gap-2.5`}>
        <span>{icone}</span>
        <span>{mensagem}</span>
        <button onClick={onFechar} className="ml-3 opacity-60 hover:opacity-100 text-lg leading-none">&times;</button>
      </div>
    </div>
  );
}

export default Toast;