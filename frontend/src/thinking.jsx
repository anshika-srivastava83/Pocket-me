import React, { useState, useEffect } from 'react';
import pikachu from './assets/pikachu.png';

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
      <div className="pm-track" aria-hidden="true">
        <span className="pm-walker">
          <span className="pm-flip">
            <img src={pikachu} alt="" className="pm-pika" />
          </span>
        </span>
      </div>
      <span key={i} className="nb-label">{PHRASES[i]}...</span>
    </div>
  );
}