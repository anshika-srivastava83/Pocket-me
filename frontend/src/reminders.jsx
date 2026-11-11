import React, { useState, useEffect } from 'react';

function Reminders({ token }) {
  const [reminders, setReminders] = useState([]);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/reminders', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((list) => {
        if (Array.isArray(list)) setReminders(list);
      })
      .catch(() => {});
  }, [token]);

  const addReminder = async (e) => {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, remindAt: new Date(when).toISOString() })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Could not add the reminder.');
      return;
    }
    setReminders((prev) =>
      [...prev, data].sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at))
    );
    setTitle('');
    setWhen('');
  };

  const deleteReminder = async (id) => {
    const res = await fetch(`/api/reminders/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <form onSubmit={handleSubmit} className="nb-panel w-full max-w-sm space-y-4 p-6">
        <h1 className="font-mono text-xl font-bold uppercase tracking-wider">Pocket Me</h1>
        <p className="nb-label">{isSignup ? 'Create your account' : 'Log in to continue'}</p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="nb-input"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={isSignup ? 6 : undefined}
          className="nb-input"
        />

        {message && <p className="text-sm font-bold text-accent">{message}</p>}

        <button type="submit" disabled={busy} className="nb-btn nb-btn-accent w-full">
          {busy ? 'Please wait' : isSignup ? 'Sign up' : 'Log in'}
        </button>

        <button
          type="button"
          onClick={() => { setIsSignup(!isSignup); setMessage(''); }}
          className="nb-link w-full text-center"
        >
          {isSignup ? 'Already have an account? Log in' : 'New here? Sign up'}
        </button>
      </form>
    </div>
  );
}

export default Reminders;