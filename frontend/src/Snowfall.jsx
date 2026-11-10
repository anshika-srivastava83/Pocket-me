import React from 'react';

// Created once when the page loads, so the flakes keep their positions between re-renders.
const FLAKES = Array.from({ length: 45 }, () => ({
  left: Math.random() * 100,
  size: 3 + Math.random() * 6,
  duration: 8 + Math.random() * 10,
  delay: -Math.random() * 18,
  drift: (Math.random() - 0.5) * 80,
  opacity: 0.4 + Math.random() * 0.5,
  glyph: Math.random() < 0.35
}));

const CSS = `
@keyframes snow-fall {
  0%   { transform: translate3d(0, -6vh, 0); opacity: 0; }
  10%  { opacity: var(--o); }
  90%  { opacity: var(--o); }
  100% { transform: translate3d(var(--drift), 106vh, 0); opacity: 0; }
}
.snowflake { position: absolute; top: 0; color: #fff; line-height: 1; will-change: transform; }
@media (prefers-reduced-motion: reduce) { .snowflake { display: none; } }
`;

function Snowfall() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{CSS}</style>
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="snowflake"
          style={{
            left: `${f.left}%`,
            animation: `snow-fall ${f.duration}s linear ${f.delay}s infinite`,
            '--drift': `${f.drift}px`,
            '--o': f.opacity,
            ...(f.glyph
              ? { fontSize: `${f.size * 2.4}px` }
              : { width: `${f.size}px`, height: `${f.size}px`, borderRadius: '50%', background: '#fff' })
          }}
        >
          {f.glyph ? '\u2744\uFE0E' : null}
        </span>
      ))}
    </div>
  );
}

export default Snowfall;