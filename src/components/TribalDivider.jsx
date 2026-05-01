/**
 * Tribal-art-inspired SVG dividers (Warli + Gond motifs).
 * Used between sections — feels hand-drawn, not AI-perfect.
 */

export function WarliDivider({ className = '' }) {
  return (
    <svg
      viewBox="0 0 320 32"
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="8" y1="16" x2="40" y2="16" />
        {/* Warli figure left */}
        <circle cx="56" cy="10" r="3" fill="currentColor" />
        <line x1="56" y1="13" x2="56" y2="22" />
        <line x1="48" y1="17" x2="64" y2="17" />
        <line x1="56" y1="22" x2="50" y2="28" />
        <line x1="56" y1="22" x2="62" y2="28" />
        <line x1="72" y1="16" x2="120" y2="16" />
        {/* Sun */}
        <circle cx="136" cy="16" r="5" />
        <line x1="136" y1="6" x2="136" y2="2" />
        <line x1="136" y1="30" x2="136" y2="26" />
        <line x1="126" y1="16" x2="122" y2="16" />
        <line x1="150" y1="16" x2="146" y2="16" />
        <line x1="129" y1="9" x2="126" y2="6" />
        <line x1="143" y1="9" x2="146" y2="6" />
        <line x1="129" y1="23" x2="126" y2="26" />
        <line x1="143" y1="23" x2="146" y2="26" />
        <line x1="152" y1="16" x2="200" y2="16" />
        {/* Warli figure right */}
        <circle cx="216" cy="10" r="3" fill="currentColor" />
        <line x1="216" y1="13" x2="216" y2="22" />
        <line x1="208" y1="17" x2="224" y2="17" />
        <line x1="216" y1="22" x2="210" y2="28" />
        <line x1="216" y1="22" x2="222" y2="28" />
        <line x1="232" y1="16" x2="280" y2="16" />
        {/* Triangle hill cluster */}
        <path d="M 282 22 L 290 12 L 298 22 Z" />
        <path d="M 296 22 L 304 14 L 312 22 Z" />
      </g>
    </svg>
  );
}

export function GondDots({ className = '' }) {
  return (
    <svg viewBox="0 0 320 12" className={className} aria-hidden="true">
      <g fill="currentColor">
        {Array.from({ length: 32 }).map((_, i) => (
          <circle key={i} cx={6 + i * 10} cy={6} r={i % 4 === 0 ? 1.6 : 1} />
        ))}
      </g>
    </svg>
  );
}

export default function TribalDivider({ variant = 'warli', className = '' }) {
  const Cmp = variant === 'gond' ? GondDots : WarliDivider;
  return (
    <div className={'w-full text-[var(--color-gold-dark)] my-4 ' + className}>
      <Cmp className="w-full h-6" />
    </div>
  );
}
