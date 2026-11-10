const FLAKES = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 12 + ((i * 7) % 14),
  delay: -((i * 1.9) % 16),
  duration: 11 + ((i * 3) % 9),
  drift: ((i * 13) % 50) - 25,
}));

export default function Snowfall() {
  return (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}
    >
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="nb-flake"
          style={{
            left: `${f.left}%`,
            fontSize: f.size,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            '--drift': `${f.drift}px`,
          }}
        >
          {'\u2744\uFE0E'}
        </span>
      ))}
    </div>
  );
}