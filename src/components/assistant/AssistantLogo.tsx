/**
 * The Recovery Assistant's mascot: a friendly robot head with blinking eyes,
 * an antenna and a sparkle, on a blue-violet gradient tile.
 */
export default function AssistantLogo({
  size = 40,
  animated = true,
  className = "",
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  const eye = animated ? "animate-blink [transform-box:fill-box] [transform-origin:center]" : "";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="al-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="0.55" stopColor="#6366f1" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="al-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e0e7ff" />
        </linearGradient>
        <radialGradient id="al-shine" cx="0.3" cy="0.2" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Tile */}
      <rect x="0" y="0" width="64" height="64" rx="18" fill="url(#al-bg)" />
      <rect x="0" y="0" width="64" height="64" rx="18" fill="url(#al-shine)" />

      {/* Antenna */}
      <line x1="32" y1="17" x2="32" y2="11" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="9.5" r="3" fill="#fde047">
        {animated && <animate attributeName="opacity" values="1;0.45;1" dur="2s" repeatCount="indefinite" />}
      </circle>

      {/* Ears */}
      <rect x="11" y="29" width="5" height="11" rx="2.5" fill="#c7d2fe" />
      <rect x="48" y="29" width="5" height="11" rx="2.5" fill="#c7d2fe" />

      {/* Head */}
      <rect x="15" y="17" width="34" height="32" rx="11" fill="url(#al-face)" />

      {/* Visor */}
      <rect x="19" y="23" width="26" height="15" rx="7.5" fill="#1e1b4b" />

      {/* Eyes */}
      <g className={eye}>
        <ellipse cx="26.5" cy="30.5" rx="3" ry="3.6" fill="#67e8f9" />
        <ellipse cx="37.5" cy="30.5" rx="3" ry="3.6" fill="#67e8f9" />
        <circle cx="27.4" cy="29.3" r="1" fill="#ffffff" />
        <circle cx="38.4" cy="29.3" r="1" fill="#ffffff" />
      </g>

      {/* Smile */}
      <path d="M27 42.5 Q32 46 37 42.5" fill="none" stroke="#6366f1" strokeWidth="2.4" strokeLinecap="round" />

      {/* Sparkle */}
      <path d="M53 9 L54.6 13.4 L59 15 L54.6 16.6 L53 21 L51.4 16.6 L47 15 L51.4 13.4 Z" fill="#fde047">
        {animated && <animateTransform attributeName="transform" type="rotate" values="0 53 15;20 53 15;0 53 15" dur="3s" repeatCount="indefinite" />}
      </path>
    </svg>
  );
}
