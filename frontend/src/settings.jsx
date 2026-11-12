import React, { useState, useEffect } from 'react';

function Row({ label, r }) {
  const text = r.ok === null ? 'Not set' : r.ok ? 'OK' : 'Failed';
  return (
    <p className="text-sm">
      <b>{label}:</b> {text}. {r.ok === null ? '' : r.message}
    </p>
  );
}

function Settings({ token, email, onClose }) {
  const [status, setStatus] = useState(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const link = 'underline';

  useEffect(() => {
    fetch('/api/settings', { headers })
      .then((r) => r.json())
      .then((s) => {
        setStatus(s);
        setCalendarId(s.calendarId || '');
      })
      .catch(() => setMessage('Could not load settings.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (body, okMessage) => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/settings', { method: 'PUT', headers, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || 'Could not save.');
        return false;
      }
      setStatus(data);
      setCalendarId(data.calendarId || '');
      setGeminiKey('');
      setGroqKey('');
      setTestResult(null);
      setMessage(okMessage);
      return true;
    } catch {
      setMessage('Could not reach the server.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const chooseMode = (m) => {
    if (status?.mode === m) return;
    send({ mode: m }, m === 'shared' ? 'Now using the shared AI.' : 'Now using your own keys.');
  };

  const save = (e) => {
    e.preventDefault();
    send({ geminiKey, groqKey, calendarId }, 'Saved. Press Test setup to check it.');
  };

  const removeKey = (which) => {
    if (!window.confirm('Remove this key?')) return;
    send(which === 'gemini' ? { clearGemini: true } : { clearGroq: true }, 'Key removed.');
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/test', { method: 'POST', headers });
      const data = await res.json().catch(() => null);
      setTestResult(res.ok && data ? data : { error: 'The test could not run.' });
    } catch {
      setTestResult({ error: 'Could not reach the server.' });
    } finally {
      setTesting(false);
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(status.serviceEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const mode = status?.mode;
  const q = status?.quota;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="nb-panel w-full max-w-md space-y-5 bg-surface p-5 fade-in">
        <div className="flex items-center justify-between">
          <h2 className="font-mono font-bold uppercase tracking-wider">Settings</h2>
          <button type="button" onClick={onClose} className="nb-btn">Close</button>
        </div>

        {email && <p className="text-sm">Signed in as <b>{email}</b></p>}

        <div className="space-y-2">
          <p className="nb-label">AI source</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => chooseMode('shared')}
              disabled={saving || !status || !status.sharedAvailable}
              className={`nb-btn flex-1 ${mode === 'shared' ? 'nb-btn-accent' : ''}`}
            >
              Shared AI
            </button>
            <button
              type="button"
              onClick={() => chooseMode('own')}
              disabled={saving || !status}
              className={`nb-btn flex-1 ${mode === 'own' ? 'nb-btn-accent' : ''}`}
            >
              My own keys
            </button>
          </div>

          {status && !mode && (
            <p className="text-sm font-bold text-accent">
              Choose how Pocket Me should use AI for you. Shared needs no setup. Your own keys have no limit. You can switch any time.
            </p>
          )}
          {mode === 'shared' && q && (
            <p className="text-sm">
              About {q.used} of {q.budget} tokens used in the last 24 hours. {q.sharers} {q.sharers === 1 ? 'person shares' : 'people share'} the daily pool, so your share shrinks as more people join. These are estimates. Switch to your own keys for no limit.
            </p>
          )}
        </div>

        {mode && (
          <form onSubmit={save} className="space-y-5">
            {mode === 'own' && (
              <>
                <div className="space-y-2">
                  <p className="nb-label">Your Gemini key</p>
                  {status?.hasGemini && (
                    <div className="flex items-center gap-2 text-sm">
                      <span>Saved: <code>{status.geminiHint}</code></span>
                      <button type="button" onClick={() => removeKey('gemini')} className="nb-link">Remove</button>
                    </div>
                  )}
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder={status?.hasGemini ? 'Paste a new key to replace it' : 'AQ... or AIza...'}
                    className="nb-input"
                  />
                  <details className="text-sm" open={!status?.hasGemini}>
                    <summary className="nb-link cursor-pointer">How to get a free Gemini key</summary>
                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                      <li>
                        Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className={link}>aistudio.google.com/apikey</a> and sign in with Google.
                      </li>
                      <li>Click Create API key. If it asks for a project, create a new one.</li>
                      <li>Copy the whole key and paste it above.</li>
                    </ol>
                  </details>
                </div>

                <div className="space-y-2">
                  <p className="nb-label">Your Groq key</p>
                  {status?.hasGroq && (
                    <div className="flex items-center gap-2 text-sm">
                      <span>Saved: <code>{status.groqHint}</code></span>
                      <button type="button" onClick={() => removeKey('groq')} className="nb-link">Remove</button>
                    </div>
                  )}
                  <input
                    type="password"
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder={status?.hasGroq ? 'Paste a new key to replace it' : 'gsk_...'}
                    className="nb-input"
                  />
                  <details className="text-sm" open={!status?.hasGroq}>
                    <summary className="nb-link cursor-pointer">How to get a free Groq key</summary>
                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                      <li>
                        Open <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className={link}>console.groq.com/keys</a> and sign up.
                      </li>
                      <li>Click Create API Key, name it Pocket Me, and copy it right away. It is shown only once.</li>
                      <li>Paste it above. One key is enough to start. Having both lets the app switch when one is busy.</li>
                    </ol>
                  </details>
                </div>
              </>
            )}

            <div className="space-y-2">
              <p className="nb-label">Your Calendar ID (for reminders)</p>
              <input
                type="text"
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                placeholder="your Gmail address"
                className="nb-input"
              />
              <details className="text-sm" open={!status?.calendarId}>
                <summary className="nb-link cursor-pointer">How to connect your Google Calendar</summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>On a computer, open <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className={link}>calendar.google.com</a>.</li>
                  <li>In the left list, hover over your calendar, click the three dots, then Settings and sharing.</li>
                  <li>
                    Under Share with specific people or groups, click Add people and groups. Paste this email, set the permission to Make changes to events, and click Send:
                    <div className="mt-1 flex items-center gap-2">
                      <code className="break-all text-xs">{status?.serviceEmail || '...'}</code>
                      {status?.serviceEmail && (
                        <button type="button" onClick={copyEmail} className="nb-btn">{copied ? 'Copied' : 'Copy'}</button>
                      )}
                    </div>
                  </li>
                  <li>On the same page, scroll to Integrate calendar and copy the Calendar ID. For a main calendar it is the Gmail address of the account that owns it. Paste it above.</li>
                  <li>For phone alerts, install the Google Calendar app and sign in with the same account. Add an event notification in the same settings so reminders ring.</li>
                </ol>
              </details>
            </div>

            {message && <p className="text-sm font-bold text-accent">{message}</p>}

            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="nb-btn nb-btn-accent flex-1">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={runTest} disabled={testing} className="nb-btn flex-1">
                {testing ? 'Testing...' : 'Test setup'}
              </button>
            </div>

            {testResult && (
              <div className="space-y-1">
                {testResult.error ? (
                  <p className="text-sm font-bold text-accent">{testResult.error}</p>
                ) : (
                  <>
                    <Row label="Gemini" r={testResult.gemini} />
                    <Row label="Groq" r={testResult.groq} />
                    <Row label="Calendar" r={testResult.calendar} />
                  </>
                )}
              </div>
            )}
          </form>
        )}

        {!mode && message && <p className="text-sm font-bold text-accent">{message}</p>}
      </div>
    </div>
  );
}

export default Settings;