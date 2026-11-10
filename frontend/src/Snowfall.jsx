const FLAKES = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 137) % 100,
  size: 3 + ((i * 7) % 4),
  delay: -((i * 1.7) % 14),
  duration: 12 + ((i * 3) % 10),
  drift: ((i * 11) % 40) - 20,
}));

export default function Snowfall() {
  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      <style>{`
        @keyframes nb-fall {
          from { transform: translate3d(0, -5vh, 0); }
          to { transform: translate3d(var(--drift), 105vh, 0); }
        }
      `}</style>
      {FLAKES.map((f, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            background: '#111',
            opacity: 0.18,
            '--drift': `${f.drift}px`,
            animation: `nb-fall ${f.duration}s linear ${f.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}