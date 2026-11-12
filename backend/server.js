const express = require('express');
require('dotenv').config();
const supabase = require('./services/supabase');
const requireAuth = require('./middleware/requireAuth');
const { callAI, getModels } = require('./services/aiService');
const { createCalendarEvent, deleteCalendarEvent } = require('./services/googleCalendar');
const { waitUntil } = require('@vercel/functions');
const { getUserSettings } = require('./services/userSettings');
const { encrypt } = require('./services/crypto');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// How many earlier messages are sent to the AI with each new one.
const HISTORY_LIMIT = 20;

// After this many new messages, fold them into the chat's saved summary.
const SUMMARY_EVERY = 2;
// How many other chats in the same space are used as background.
const SUMMARY_MAX_OTHER_CHATS = 5;

// Shared AI: one daily token pool, split between everyone who chose "shared".
const SHARED_DAILY_TOKENS = Number(process.env.SHARED_DAILY_TOKENS) || 150000;
const MIN_USER_TOKENS = 15000;
const approxTokens = (text) => Math.ceil((text || '').length / 4);

async function getSharedQuota(userId) {
    const { count } = await supabase
        .from('user_settings')
        .select('*', { count: 'exact', head: true })
        .eq('mode', 'shared');
    const sharers = Math.max(1, count || 1);
    const budget = Math.max(MIN_USER_TOKENS, Math.floor(SHARED_DAILY_TOKENS / sharers));

    const since = new Date(Date.now() - 86400000).toISOString();
    const { data } = await supabase
        .from('usage_log')
        .select('tokens')
        .eq('user_id', userId)
        .gte('created_at', since);
    const used = (data || []).reduce((sum, r) => sum + r.tokens, 0);
    return { budget, used, sharers };
}

/*const DEFAULT_SPACES = [
    { name: 'Coding', instructions: 'You are my coding mentor. I am a beginner learning DSA with Java and web development. Explain simply, give code in small parts, and explain what each part does.' },
    { name: 'Mehfil', instructions: 'You are a mentor and partner for my open mic and event business called Mehfil. Help with planning, promotion and ideas.' },
    { name: 'Brand and Resume', instructions: 'Help me build my student brand and tailor my resume to job descriptions. Never add skills or achievements I have not told you about.' },
    { name: 'E-cell', instructions: 'Help with my college entrepreneurship cell: event plans, documents, letters, question sets and brainstorming. Use a direct formal tone for letters.' },
    { name: 'College', instructions: 'Help me keep track of my college projects and files.' },
    { name: 'Miscellaneous', instructions: '' },
    { name: 'Reminders', instructions: 'Help me track deadlines, important dates and birthdays.' }
];*/

// Fold new messages into the chat's saved summary.
async function updateSummary(chatId, userId, summarizedCount, oldSummary, keys) {
    const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chatId)
        .eq('user_id', userId);

    if (!count || count - summarizedCount < SUMMARY_EVERY) return;

    const { data: fresh, error } = await supabase
        .from('messages')
        .select('sender, content')
        .eq('chat_id', chatId)
        .eq('user_id', userId)
        .order('created_at')
        .range(summarizedCount, count - 1);
    if (error || !fresh || fresh.length === 0) return;

    const transcript = fresh
        .map((m) => `${m.sender === 'ai' ? 'Assistant' : 'User'}: ${m.content.slice(0, 2000)}`)
        .join('\n');

    const instruction =
        'Update the running summary of a conversation. Keep names, decisions, facts about the user, ' +
        'and open tasks. Stay under 200 words. Reply with the new summary only.\n\n' +
        `Current summary:\n${oldSummary || '(none yet)'}\n\nNew messages:\n${transcript}`;

    const result = await callAI([{ role: 'user', content: instruction }], '', undefined, true, undefined, keys);

    await supabase
        .from('chats')
        .update({ summary: result.text.trim(), summarized_count: count })
        .eq('id', chatId)
        .eq('user_id', userId)
        .eq('summarized_count', summarizedCount);
}

// Public test route
app.get('/', (req, res) => {
    res.json({ message: 'Pocket Me backend is running successfully!' });
});

app.get('/api/models', requireAuth, async (req, res) => {
    const s = await getUserSettings(req.user.id);
    res.json(getModels({ gemini: s.geminiKey, groq: s.groqKey }).map((m) => ({ id: m.id, label: m.label })));
});

app.get('/api/health/db', requireAuth, async (req, res) => {
    const { count, error } = await supabase
        .from('spaces')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('DB check failed:', error.message);
        return res.status(500).json({ ok: false, error: error.message });
    }
    res.json({ ok: true, spacesCount: count });
});

// ---------- Spaces ----------

app.get('/api/spaces', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('spaces')
        .select('id, name, instructions')
        .eq('user_id', req.user.id)
        .order('position')
        .order('created_at');

    if (error) {
        console.error('List spaces failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }

    res.json(data);
});

app.post('/api/spaces', requireAuth, async (req, res) => {
    const name = (req.body.name || '').trim();
    const instructions = (req.body.instructions || '').trim();

    if (!name || name.length > 40) {
        return res.status(400).json({ success: false, error: 'Name is required and must be 40 characters or less.' });
    }
    if (instructions.length > 4000) {
        return res.status(400).json({ success: false, error: 'Instructions are too long.' });
    }

    const { count } = await supabase
        .from('spaces')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id);

    const { data, error } = await supabase
        .from('spaces')
        .insert({ user_id: req.user.id, name, instructions, position: count || 0 })
        .select('id, name, instructions')
        .single();

    if (error) {
        console.error('Create space failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
    res.json(data);
});

// Rename a space or change its instructions
app.patch('/api/spaces/:spaceId', requireAuth, async (req, res) => {
    const name = (req.body.name || '').trim();
    const instructions = (req.body.instructions || '').trim();

    if (!name || name.length > 40) {
        return res.status(400).json({ success: false, error: 'Name is required and must be 40 characters or less.' });
    }
    if (instructions.length > 4000) {
        return res.status(400).json({ success: false, error: 'Instructions are too long.' });
    }

    const { data, error } = await supabase
        .from('spaces')
        .update({ name, instructions })
        .eq('id', req.params.spaceId)
        .eq('user_id', req.user.id)
        .select('id, name, instructions')
        .maybeSingle();

    if (error) {
        console.error('Update space failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
    if (!data) {
        return res.status(404).json({ success: false, error: 'Space not found.' });
    }
    res.json(data);
});

// Delete a space together with its chats and messages
app.delete('/api/spaces/:spaceId', requireAuth, async (req, res) => {
    const spaceId = req.params.spaceId;

    const { data: chats, error: chatsError } = await supabase
        .from('chats')
        .select('id')
        .eq('space_id', spaceId)
        .eq('user_id', req.user.id);

    if (chatsError) {
        return res.status(500).json({ success: false, error: chatsError.message });
    }

    const chatIds = (chats || []).map((c) => c.id);
    if (chatIds.length > 0) {
        const { error: messagesError } = await supabase
            .from('messages')
            .delete()
            .in('chat_id', chatIds)
            .eq('user_id', req.user.id);
        if (messagesError) {
            return res.status(500).json({ success: false, error: messagesError.message });
        }

        const { error: chatsDeleteError } = await supabase
            .from('chats')
            .delete()
            .in('id', chatIds)
            .eq('user_id', req.user.id);
        if (chatsDeleteError) {
            return res.status(500).json({ success: false, error: chatsDeleteError.message });
        }
    }

    const { error } = await supabase
        .from('spaces')
        .delete()
        .eq('id', spaceId)
        .eq('user_id', req.user.id);

    if (error) {
        console.error('Delete space failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true });
});

// ---------- Reminders ----------

app.get('/api/reminders', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('reminders')
        .select('id, title, remind_at')
        .eq('user_id', req.user.id)
        .order('remind_at');

    if (error) {
        console.error('List reminders failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
    res.json(data);
});

app.post('/api/reminders', requireAuth, async (req, res) => {
    const title = (req.body.title || '').trim();
    const remindAt = new Date(String(req.body.remindAt));

    if (!title || title.length > 200) {
        return res.status(400).json({ success: false, error: 'Title is required and must be 200 characters or less.' });
    }
    if (Number.isNaN(remindAt.getTime())) {
        return res.status(400).json({ success: false, error: 'A valid date and time is required.' });
    }

        const { calendarId } = await getUserSettings(req.user.id);
    if (!calendarId) {
        return res.status(400).json({ success: false, error: 'Add your Google Calendar ID in Settings first.' });
    }
    let eventId;
    try {
        eventId = await createCalendarEvent(title, remindAt, calendarId);
    } catch (err) {
        console.error('Google Calendar create failed:', err.response?.data?.error?.message || err.message);
        return res.status(502).json({ success: false, error: 'Could not add the reminder to Google Calendar.' });
    }

    const { data, error } = await supabase
        .from('reminders')
        .insert({ user_id: req.user.id, title, remind_at: remindAt.toISOString(), google_event_id: eventId })
        .select('id, title, remind_at')
        .single();

    if (error) {
        console.error('Create reminder failed:', error.message);
        await deleteCalendarEvent(eventId, calendarId).catch(() => {});
        return res.status(500).json({ success: false, error: error.message });
    }
    res.json(data);
});

app.delete('/api/reminders/:id', requireAuth, async (req, res) => {
    const { data: reminder } = await supabase
        .from('reminders')
        .select('google_event_id')
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .maybeSingle();

    if (!reminder) {
        return res.status(404).json({ success: false, error: 'Reminder not found.' });
    }

    const { calendarId } = await getUserSettings(req.user.id);
    if (reminder.google_event_id && calendarId) {
        try {
            await deleteCalendarEvent(reminder.google_event_id, calendarId);
        } catch (err) {
            console.error('Google Calendar delete failed:', err.response?.data?.error?.message || err.message);
            return res.status(502).json({ success: false, error: 'Could not remove the reminder from Google Calendar.' });
        }
    }

    const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', req.user.id);

    if (error) {
        console.error('Delete reminder failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true });
});

// ---------- Chats ----------

// List the chats in a space, newest first
app.get('/api/spaces/:spaceId/chats', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('chats')
        .select('id, title, created_at, pinned')
        .eq('space_id', req.params.spaceId)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('List chats failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
    res.json(data);
});

// Get all messages of one chat
app.get('/api/chats/:chatId/messages', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('messages')
        .select('id, sender, content, provider, created_at')
        .eq('chat_id', req.params.chatId)
        .eq('user_id', req.user.id)
        .order('created_at');

    if (error) {
        console.error('List messages failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
    res.json(data);
});

// Rename a chat or pin and unpin it
app.patch('/api/chats/:chatId', requireAuth, async (req, res) => {
    const updates = {};

    if (req.body.title !== undefined) {
        const title = String(req.body.title).trim();
        if (!title || title.length > 100) {
            return res.status(400).json({ success: false, error: 'Title is required and must be 100 characters or less.' });
        }
        updates.title = title;
    }
    if (req.body.pinned !== undefined) {
        updates.pinned = req.body.pinned === true;
    }
    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, error: 'Nothing to update.' });
    }

    const { data, error } = await supabase
        .from('chats')
        .update(updates)
        .eq('id', req.params.chatId)
        .eq('user_id', req.user.id)
        .select('id, title, pinned')
        .maybeSingle();

    if (error) {
        console.error('Update chat failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
    if (!data) {
        return res.status(404).json({ success: false, error: 'Chat not found.' });
    }
    res.json(data);
});

// Delete a chat and its messages
app.delete('/api/chats/:chatId', requireAuth, async (req, res) => {
    const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', req.params.chatId)
        .eq('user_id', req.user.id);

    if (messagesError) {
        return res.status(500).json({ success: false, error: messagesError.message });
    }

    const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', req.params.chatId)
        .eq('user_id', req.user.id);

    if (error) {
        console.error('Delete chat failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true });
});

// Send a message. Creates a new chat if no chatId is given.
app.post('/api/chat', requireAuth, async (req, res) => {
    try {
        const { prompt, modelId, autoFallback, spaceId, chatId } = req.body;

        if (!prompt || !prompt.trim()) {
            return res.status(400).json({ success: false, error: 'Prompt is required.' });
        }
        if (prompt.length > 20000) {
            return res.status(400).json({ success: false, error: 'Message is too long.' });
        }
        if (!spaceId) {
            return res.status(400).json({ success: false, error: 'spaceId is required.' });
        }

        // The space must belong to the logged in user.
        const { data: space } = await supabase
            .from('spaces')
            .select('id, instructions')
            .eq('id', spaceId)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (!space) {
            return res.status(404).json({ success: false, error: 'Space not found.' });
        }

        // Use the existing chat, or create a new one titled with the start of the first message.
        let activeChatId = chatId;
        let isNewChat = false;
        let chatSummary = '';
        let summarizedCount = 0;

        if (activeChatId) {
            const { data: chat } = await supabase
                .from('chats')
                .select('id, summary, summarized_count')
                .eq('id', activeChatId)
                .eq('space_id', spaceId)
                .eq('user_id', req.user.id)
                .maybeSingle();
            if (!chat) {
                return res.status(404).json({ success: false, error: 'Chat not found.' });
            }
            chatSummary = chat.summary || '';
            summarizedCount = chat.summarized_count || 0;
        } else {
            const title = prompt.trim().slice(0, 50);
            const { data: created, error: createError } = await supabase
                .from('chats')
                .insert({ user_id: req.user.id, space_id: spaceId, title })
                .select('id, title')
                .single();
            if (createError) {
                return res.status(500).json({ success: false, error: createError.message });
            }
            activeChatId = created.id;
            isNewChat = true;
        }

        // Load the most recent messages, then put them in the right order.
        const { data: recent } = await supabase
            .from('messages')
            .select('sender, content')
            .eq('chat_id', activeChatId)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(HISTORY_LIMIT);

        const history = (recent || [])
            .reverse()
            .map((m) => ({ role: m.sender === 'ai' ? 'assistant' : 'user', content: m.content }));
            history.push({ role: 'user', content: prompt });

        // Background context: older part of this chat, and other chats in this space.
        const { data: otherChats } = await supabase
            .from('chats')
            .select('title, summary')
            .eq('space_id', spaceId)
            .eq('user_id', req.user.id)
            .neq('id', activeChatId)
            .neq('summary', '')
            .order('created_at', { ascending: false })
            .limit(SUMMARY_MAX_OTHER_CHATS);

        let system = space.instructions || '';
        if (chatSummary && (recent || []).length >= HISTORY_LIMIT) {
            system += `\n\nSummary of the earlier part of this chat:\n${chatSummary}`;
        }
        if (otherChats && otherChats.length > 0) {
            system +=
                '\n\nSummaries of other chats in this space, for background only:\n' +
                otherChats.map((c) => `- ${c.title}: ${c.summary}`).join('\n');
        }

        // Save the user's message.
        const { error: saveUserError } = await supabase
            .from('messages')
            .insert({ chat_id: activeChatId, user_id: req.user.id, sender: 'user', content: prompt });
        if (saveUserError) {
            return res.status(500).json({ success: false, error: saveUserError.message });
        }

        // Ask the AI. If it fails, the user's message is still saved.
                // If the browser cancels the request (Stop button), cancel the AI call too.
        const controller = new AbortController();
        res.on('close', () => {
            if (!res.writableFinished) controller.abort();
        });

        // Ask the AI. If it fails, the user's message is still saved.
        const settings = await getUserSettings(req.user.id);
        const keys = { gemini: settings.geminiKey, groq: settings.groqKey };
                if (!settings.mode) {
            return res.status(400).json({ success: false, chatId: activeChatId, error: 'Open Settings and choose how to use AI first.' });
        }
        if (!keys.gemini && !keys.groq) {
            return res.status(400).json({
                success: false,
                chatId: activeChatId,
                error: settings.mode === 'own' ? 'Add your Gemini or Groq key in Settings first.' : 'Shared AI is not set up on the server.'
            });
        }
        if (settings.mode === 'shared') {
            const q = await getSharedQuota(req.user.id);
            if (q.used >= q.budget) {
                return res.status(429).json({
                    success: false,
                    chatId: activeChatId,
                    error: `You have used your share of the free AI (${q.used} of ${q.budget} tokens in the last 24 hours). It frees up gradually. Switch to your own keys in Settings to remove the limit.`
                });
            }
        }
        let result;
        try {
            result = await callAI(history, system, modelId, autoFallback === true, controller.signal, keys);
        } catch (aiError) {
            if (aiError.aborted) {
                console.log('Request stopped by user.');
                return;
            }
            console.error('AI Error:', aiError.message);
            return res.status(500).json({ success: false, chatId: activeChatId, error: aiError.message });
        }

        // Save the AI reply.
        await supabase
            .from('messages')
            .insert({ chat_id: activeChatId, user_id: req.user.id, sender: 'ai', content: result.text, provider: result.provider });

                if (settings.mode === 'shared') {
            const tokens =
                approxTokens(system) +
                history.reduce((n, m) => n + approxTokens(m.content), 0) +
                approxTokens(result.text);
            await supabase.from('usage_log').insert({ user_id: req.user.id, tokens });
        }

        // Update the summary in the background. The reply does not wait for it.
        const summaryJob = updateSummary(activeChatId, req.user.id, summarizedCount, chatSummary, keys).catch((err) =>
            console.error('Summary update failed:', err.message)
        );
        try {
            waitUntil(summaryJob); // On Vercel, keeps the function alive until the summary is saved.
        } catch {
            // Not on Vercel: the job already runs by itself.
        }

        res.json({
            success: true,
            chatId: activeChatId,
            isNewChat,
            provider: result.provider,
            response: result.text
        });
    } catch (error) {
        console.error('Chat route error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ---------- Settings (each user's own keys and calendar) ----------

const hint = (k) => (k ? `${k.slice(0, 4)}...${k.slice(-4)}` : '');

async function settingsStatus(userId) {
    const s = await getUserSettings(userId);
    const quota = s.mode === 'shared' ? await getSharedQuota(userId) : null;
    return {
        mode: s.mode,
        hasGemini: s.hasOwnGemini,
        hasGroq: s.hasOwnGroq,
        geminiHint: hint(s.ownGeminiKey),
        groqHint: hint(s.ownGroqKey),
        calendarId: s.calendarId,
        serviceEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
        sharedAvailable: !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY),
        quota
    };
}

app.get('/api/settings', requireAuth, async (req, res) => {
    try {
        res.json(await settingsStatus(req.user.id));
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/settings', requireAuth, async (req, res) => {
    try {
        const geminiKey = String(req.body.geminiKey || '').trim();
        const groqKey = String(req.body.groqKey || '').trim();
        const row = { user_id: req.user.id, updated_at: new Date().toISOString() };

        if (req.body.clearGemini === true) {
            row.gemini_key = null;
        } else if (geminiKey) {
            if (geminiKey.length < 20 || /\s/.test(geminiKey)) {
                return res.status(400).json({ success: false, error: 'That does not look like a valid Gemini key. Copy the whole key with no spaces.' });
            }
            row.gemini_key = encrypt(geminiKey);
        }

        if (req.body.clearGroq === true) {
            row.groq_key = null;
        } else if (groqKey) {
            if (!groqKey.startsWith('gsk_')) {
                return res.status(400).json({ success: false, error: 'That does not look like a Groq key (starts with gsk_).' });
            }
            row.groq_key = encrypt(groqKey);
        }

        if (req.body.mode !== undefined) {
            if (!['own', 'shared'].includes(req.body.mode)) {
                return res.status(400).json({ success: false, error: 'Invalid mode.' });
            }
            if (req.body.mode === 'shared' && !(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY)) {
                return res.status(400).json({ success: false, error: 'Shared AI is not available right now.' });
            }
            row.mode = req.body.mode;
        }

        if (req.body.calendarId !== undefined) {
            row.calendar_id = String(req.body.calendarId).trim().slice(0, 200) || null;
        }

        const { error } = await supabase.from('user_settings').upsert(row, { onConflict: 'user_id' });
        if (error) return res.status(500).json({ success: false, error: error.message });

        res.json(await settingsStatus(req.user.id));
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Checks each saved key and the calendar, so a user knows their setup works.
app.post('/api/settings/test', requireAuth, async (req, res) => {
    try {
        const s = await getUserSettings(req.user.id);
        const keys = { gemini: s.geminiKey, groq: s.groqKey };
        const out = {
            gemini: { ok: null, message: 'Not set.' },
            groq: { ok: null, message: 'Not set.' },
            calendar: { ok: null, message: 'Not set.' }
        };

        const tested = new Set();
        for (const m of getModels(keys)) {
            const provider = m.id.split(':')[0];
            if (tested.has(provider)) continue;
            tested.add(provider);
            try {
                await callAI([{ role: 'user', content: 'Reply with the single word OK.' }], '', m.id, false, undefined, keys);
                out[provider] = { ok: true, message: 'Working.' };
            } catch (e) {
                out[provider] = { ok: false, message: String(e.message).slice(0, 300) };
            }
        }

        if (s.calendarId) {
            try {
                const id = await createCalendarEvent('Pocket Me setup test (safe to ignore)', new Date(Date.now() + 3600000), s.calendarId);
                await deleteCalendarEvent(id, s.calendarId).catch(() => {});
                out.calendar = { ok: true, message: 'Working. A test event was created and removed.' };
            } catch (e) {
                const status = e.response?.status;
                const message =
                    status === 404 ? 'Calendar not found. Check the Calendar ID.'
                    : status === 403 ? 'No permission. Share the calendar with the service email and choose Make changes to events.'
                    : e.response?.data?.error?.message || e.message;
                out.calendar = { ok: false, message };
            }
        }

        res.json(out);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Run a normal server locally. On Vercel the exported app is used instead.
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

const { cleanupOldMessages } = require('./services/cleanup');

app.post('/api/cron/cleanup', (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  waitUntil(cleanupOldMessages());
  res.json({ started: true });
});
module.exports = app;