const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env');
}

// One shared client for the whole backend.
// persistSession is false because the backend is a server, not a browser.
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false } }
);

module.exports = supabase;