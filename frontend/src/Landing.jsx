import React from 'react';
import Snowfall from './snowfall';

function Landing({ spaces, onOpen, onNew }) {
  const visible = spaces.filter((s) => s.name !== 'Reminders');
  return (
    <div className="relative flex-1 overflow-hidden">
      <Snowfall />
      <div className="relative z-10 h-full overflow-y-auto p-5 md:p-10">
        <h1 className="nb-label mb-6">Your spaces</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {visible.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onOpen(s.id)}
              style={{ '--i': i }}
              className="nb-card nb-slide text-left p-5"
            >
              <div className="text-lg font-bold">{s.name}</div>
              <div className="mt-2 text-sm text-muted line-clamp-2">
                {s.instructions || 'No instructions'}
              </div>
            </button>
          ))}
          <button
            onClick={onNew}
            style={{ '--i': visible.length }}
            className="nb-slide text-left p-5 border-2 border-dashed border-ink rounded-sm font-mono text-sm font-bold uppercase tracking-wide"
          >
            + New space
          </button>
        </div>
      </div>
    </div>
  );
}

export default Landing;