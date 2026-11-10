export default function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="pbar__track">
        <div className="pbar__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="pbar__label">
        {value}/{max}
      </span>
    </div>
  );
}
