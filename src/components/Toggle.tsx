export function Toggle({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 p-4 cursor-pointer">
      <span className="flex-1"><span className="block text-sm font-medium">{label}</span>{sub && <span className="block text-xs text-muted-foreground">{sub}</span>}</span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
        className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-secondary"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all ${on ? "left-5.5" : "left-0.5"}`} />
      </button>
    </label>
  );
}