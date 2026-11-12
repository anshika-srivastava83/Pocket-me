import React, { useState, useEffect } from 'react';
import pikachu from './assets/pikachu-working.webp';

const PHRASES = [
  'Thinking',
  'Reading your chat',
  'Gathering ideas',
  'Writing the reply',
  'Almost there'
];

export default function Thinking() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % PHRASES.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pm-thinking" role="status" aria-live="polite">
      <div className="pm-work" aria-hidden="true">
        <img src={pikachu} alt="" className="pm-work-img" />
      </div>
      <span key={i} className="nb-label">{PHRASES[i]}...</span>
    </div>
  );
}