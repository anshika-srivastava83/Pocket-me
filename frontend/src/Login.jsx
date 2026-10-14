import React, { useState } from 'react';
import { supabase } from './supabaseClient';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    const { data, error } = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
    } else if (isSignup && !data.session) {
      setMessage('Account created. Check your email to confirm it, then log in.');
    }
    setBusy(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-100 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h1 className="text-xl font-bold">Pocket Me</h1>
        <p className="text-sm text-slate-400">{isSignup ? 'Create your account' : 'Log in to continue'}</p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={isSignup ? 6 : undefined}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
        />

        {message && <p className="text-sm text-amber-300">{message}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-blue-600 py-2 rounded-lg font-semibold hover:bg-blue-500 transition disabled:opacity-50"
        >
          {busy ? 'Please wait...' : isSignup ? 'Sign up' : 'Log in'}
        </button>

        <button
          type="button"
          onClick={() => { setIsSignup(!isSignup); setMessage(''); }}
          className="w-full text-sm text-slate-400 hover:text-slate-200"
        >
          {isSignup ? 'Already have an account? Log in' : 'New here? Sign up'}
        </button>
      </form>
    </div>
  );
}

export default Login;