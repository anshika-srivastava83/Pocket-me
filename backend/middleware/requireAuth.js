const supabase = require('../services/supabase');

// Runs before a route. Lets the request through only if it carries a valid login token.
async function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ success: false, error: 'Not logged in.' });
    }

    // Supabase checks that the token is real and not expired.
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
        return res.status(401).json({ success: false, error: 'Invalid or expired login.' });
    }

    req.user = data.user; // later routes will use this to know who is asking
    next();
}

module.exports = requireAuth;