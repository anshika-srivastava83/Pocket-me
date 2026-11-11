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
    <div className="p-4 bg-surface border-b-2 border-ink space-y-3">
      <h2 className="nb-label">Reminders</h2>

      <form onSubmit={addReminder} className="flex flex-wrap gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What do you need to remember?"
          maxLength={200}
          required
          className="nb-input nb-input-sm flex-1 min-w-40"
        />
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          required
          className="nb-input nb-input-sm"
        />
        <button type="submit" className="nb-btn nb-btn-accent">
          Add
        </button>
      </form>

      {error && <p className="text-sm font-bold text-accent">{error}</p>}

      {reminders.length === 0 ? (
        <p className="nb-label">No reminders yet</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {reminders.map((r) => (
            <li key={r.id} className="flex items-center gap-3 bg-hi px-3 py-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="truncate font-bold">{r.title}</div>
                <div className="font-mono text-xs text-muted">{new Date(r.remind_at).toLocaleString()}</div>
              </div>
              <button type="button" onClick={() => deleteReminder(r.id)} className="nb-link">
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Reminders;