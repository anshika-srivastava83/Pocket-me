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
    <div className="p-4 bg-slate-800 border-b border-slate-700 space-y-3">
      <h2 className="font-semibold">Reminders</h2>

      <form onSubmit={addReminder} className="flex flex-wrap gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What do you need to remember?"
          maxLength={200}
          required
          className="flex-1 min-w-40 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          required
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-500 transition"
        >
          Add
        </button>
      </form>

      {error && <p className="text-sm text-amber-300">{error}</p>}

      {reminders.length === 0 ? (
        <p className="text-sm text-slate-400">No reminders yet.</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {reminders.map((r) => (
            <li key={r.id} className="flex items-center gap-3 bg-slate-900 rounded-lg px-3 py-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="truncate">{r.title}</div>
                <div className="text-xs text-slate-400">{new Date(r.remind_at).toLocaleString()}</div>
              </div>
              <button
                type="button"
                onClick={() => deleteReminder(r.id)}
                className="text-slate-400 hover:text-red-400"
              >
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