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

export { SkeletonLinha, SkeletonCard };