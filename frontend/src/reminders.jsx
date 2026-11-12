import React, { useState, useEffect } from 'react';

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
};

const EditIcon = () => (
  <svg {...iconProps}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const TrashIcon = () => (
  <svg {...iconProps}>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

const toLocalInput = (iso) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const sortByTime = (list) => [...list].sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at));

function Reminders({ token }) {
  const [reminders, setReminders] = useState([]);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editWhen, setEditWhen] = useState('');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

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
    setNote('');

    const res = await fetch('/api/reminders', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, remindAt: new Date(when).toISOString() })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Could not add the reminder.');
      return;
    }
    setReminders((prev) => sortByTime([...prev, data]));
    setTitle('');
    setWhen('');
    setNote(data.synced === false ? 'Saved in Pocket Me only. Add a Calendar ID in Settings for Google Calendar alerts.' : '');
  };

  const startEdit = (r) => {
    setError('');
    setEditingId(r.id);
    setEditTitle(r.title);
    setEditWhen(toLocalInput(r.remind_at));
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await fetch(`/api/reminders/${editingId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ title: editTitle, remindAt: new Date(editWhen).toISOString() })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Could not save the reminder.');
      return;
    }
    setReminders((prev) => sortByTime(prev.map((r) => (r.id === data.id ? data : r))));
    setEditingId(null);
  };

  const deleteReminder = async (id) => {
    if (!window.confirm('Delete this reminder?')) return;
    const res = await fetch(`/api/reminders/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-surface space-y-3">
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
      {note && <p className="nb-label">{note}</p>}

      {reminders.length === 0 ? (
        <p className="nb-label">No reminders yet</p>
      ) : (
        <ul className="space-y-2">
          {reminders.map((r) => (
            <li key={r.id} className="bg-hi px-3 py-2 text-sm">
              {editingId === r.id ? (
                <form onSubmit={saveEdit} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={200}
                    required
                    autoFocus
                    className="nb-input nb-input-sm flex-1 min-w-40"
                  />
                  <input
                    type="datetime-local"
                    value={editWhen}
                    onChange={(e) => setEditWhen(e.target.value)}
                    required
                    className="nb-input nb-input-sm"
                  />
                  <button type="submit" className="nb-link">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="nb-link">Cancel</button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-bold">{r.title}</div>
                    <div className="font-mono text-xs text-muted">{new Date(r.remind_at).toLocaleString()}</div>
                  </div>
                  <button type="button" onClick={() => startEdit(r)} className="nb-msg-action" aria-label="Edit reminder" title="Edit">
                    <EditIcon />
                  </button>
                  <button type="button" onClick={() => deleteReminder(r.id)} className="nb-msg-action" aria-label="Delete reminder" title="Delete">
                    <TrashIcon />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Reminders;