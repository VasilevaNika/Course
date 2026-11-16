// Несколько своих SVG-иконок (без библиотеки иконок). Цвет — currentColor.

type P = { size?: number; className?: string };

export function FlameIcon({ size = 20, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12.6 1.8c.6 3.4-1.7 5.2-1.7 7.6 0 1.5 1 2.6 2.4 2.6 1.7 0 2.6-1.4 2.4-3.3 2.4 1.8 3.8 4.5 3.8 7a7.4 7.4 0 0 1-14.9.2c0-4.9 6.8-7.6 8-14.1z" />
      <path d="M12 21.3a3.2 3.2 0 0 1-3.2-3.2c0-2.1 2.1-3.1 2.7-5.2 1.9 1.4 3.7 3.1 3.7 5.2a3.2 3.2 0 0 1-3.2 3.2z" fill="#fff" opacity=".45" />
    </svg>
  );
}

export function SnowIcon({ size = 16, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5" />
    </svg>
  );
}

export function ChestIcon({ size = 56, open = false, className }: P & { open?: boolean }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      {open ? (
        <path d="M8 22 14 8h36l6 14z" fill="#b8742a" stroke="#7a4a17" strokeWidth="2" strokeLinejoin="round" />
      ) : (
        <path d="M8 28c0-9 6-14 24-14s24 5 24 14z" fill="#c9832f" stroke="#7a4a17" strokeWidth="2" strokeLinejoin="round" />
      )}
      {open && <ellipse cx="32" cy="27" rx="18" ry="5" fill="#ffd95a" />}
      <rect x="8" y="27" width="48" height="27" rx="4" fill="#d9913a" stroke="#7a4a17" strokeWidth="2" />
      <rect x="8" y="34" width="48" height="5" fill="#f2c14e" />
      <rect x="28" y="31" width="8" height="11" rx="2" fill="#f2c14e" stroke="#7a4a17" strokeWidth="2" />
    </svg>
  );
}

export function ShieldIcon({ size = 20, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" />
    </svg>
  );
}

export function LockIcon({ size = 14, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm2 0h6V7a3 3 0 0 0-6 0z" />
    </svg>
  );
}

export function CheckIcon({ size = 16, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
