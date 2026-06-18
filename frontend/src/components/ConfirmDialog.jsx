function ConfirmDialog({ aberto, titulo, mensagem, onConfirmar, onCancelar, carregando }) {
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/60" onClick={onCancelar} />

      <div className="relative w-full max-w-sm bg-atend-card border border-atend-border rounded-2xl shadow-2xl p-6 z-10 animate-fade-in-scale">
        <h3 className="text-lg font-bold text-white mb-2">{titulo}</h3>
        <p className="text-sm text-slate-400 mb-6">{mensagem}</p>

        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            disabled={carregando}
            className="flex-1 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] focus:outline-none text-slate-300 text-sm font-medium py-2.5 rounded-lg transition-all duration-200 border border-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={carregando}
            className="flex-1 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] focus:outline-none disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg transition-all duration-200"
          >
            {carregando ? 'Excluindo...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;