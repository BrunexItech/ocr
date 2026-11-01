let gradientSeq = 0;

export default function Spinner({ className = "w-5 h-5", light = false }: { className?: string; light?: boolean }) {
  // Unique per mount so multiple spinners on one page don't collide on the same
  // gradient id - svg <defs> ids are global to the document, not scoped per-icon.
  const gradientId = `spinner-grad-${(gradientSeq++).toString(36)}`;
  const color = light ? "#ffffff" : "#10b981"; // emerald-500, matches the brand accent

  return (
    <span className={`inline-flex items-center justify-center ${className}`} role="status" aria-label="Loading">
      <svg className="w-full h-full animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="9.5" stroke={color} strokeOpacity="0.15" strokeWidth="2.5" />
        <circle
          cx="12"
          cy="12"
          r="9.5"
          stroke={`url(#${gradientId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="42 60"
        />
      </svg>
    </span>
  );
}
