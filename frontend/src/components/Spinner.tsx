export default function Spinner({ className = "w-5 h-5", light = false }: { className?: string; light?: boolean }) {
  return (
    <svg
      className={`animate-spin ${className} ${light ? "text-white" : "text-emerald-600"}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
