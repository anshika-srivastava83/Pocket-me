import React from 'react';
import Snowfall from './Snowfall';

function Landing({ spaces, onOpen, onNew }) {
  return (
    <div className="relative flex-1 overflow-hidden">
      <Snowfall />
      <div className="relative z-10 h-full overflow-y-auto p-4">
        <h1 className="text-xl font-semibold mb-4">Your spaces</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {spaces.map((s) => (
            <button
              key={s.id}
              onClick={() => onOpen(s.id)}
              className="text-left bg-slate-800/80 border border-slate-700 rounded-xl p-4 hover:bg-slate-700/80 transition"
            >
              <div className="font-semibold">{s.name}</div>
              <div className="mt-1 text-xs text-slate-400 line-clamp-2">
                {s.instructions || 'No instructions yet'}
              </div>
            </button>
          ))}
          <button
            onClick={onNew}
            className="border border-dashed border-slate-600 rounded-xl p-4 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition"
          >
            + New space
          </button>
        </div>
      </div>
    </div>
  );
}

export default Landing;