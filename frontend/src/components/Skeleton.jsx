function SkeletonLinha({ colunas = 8 }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: colunas }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-4 bg-slate-700/50 rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="px-5 py-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-4 h-4 bg-slate-700/50 rounded mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-700/50 rounded w-3/4" />
          <div className="h-3 bg-slate-700/50 rounded w-1/2" />
          <div className="h-5 bg-slate-700/50 rounded w-1/3" />
          <div className="flex gap-2">
            <div className="h-3 bg-slate-700/50 rounded w-16" />
            <div className="h-3 bg-slate-700/50 rounded w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonResumo({ cards = 3 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl">
          <div className="h-3 bg-slate-700/50 rounded w-20 mb-3" />
          <div className="h-8 bg-slate-700/50 rounded w-28 mb-2" />
          <div className="h-3 bg-slate-700/50 rounded w-24" />
        </div>
      ))}
    </div>
  );
}

function SkeletonGrafico() {
  return (
    <div className="rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl animate-pulse">
      <div className="h-4 bg-slate-700/50 rounded w-48 mb-4" />
      <div className="h-64 bg-slate-700/30 rounded-lg" />
    </div>
  );
}

function SkeletonTabela({ linhas = 5, colunas = 5 }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex gap-4 px-5 py-3">
          {Array.from({ length: colunas }).map((_, j) => (
            <div key={j} className="h-4 bg-slate-700/50 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export { SkeletonLinha, SkeletonCard, SkeletonResumo, SkeletonGrafico, SkeletonTabela };