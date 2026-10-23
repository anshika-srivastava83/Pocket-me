const express = require('express');
require('dotenv').config();
const supabase = require('./services/supabase');
const requireAuth = require('./middleware/requireAuth');
const { callAI, getModels } = require('./services/aiService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// How many earlier messages are sent to the AI with each new one.
const HISTORY_LIMIT = 20;

// After this many new messages, fold them into the chat's saved summary.
const SUMMARY_EVERY = 2;
// How many other chats in the same space are used as background.
const SUMMARY_MAX_OTHER_CHATS = 5;

const DEFAULT_SPACES = [
    { name: 'Coding', instructions: 'You are my coding mentor. I am a beginner learning DSA with Java and web development. Explain simply, give code in small parts, and explain what each part does.' },
    { name: 'Mehfil', instructions: 'You are a mentor and partner for my open mic and event business called Mehfil. Help with planning, promotion and ideas.' },
    { name: 'Brand and Resume', instructions: 'Help me build my student brand and tailor my resume to job descriptions. Never add skills or achievements I have not told you about.' },
    { name: 'E-cell', instructions: 'Help with my college entrepreneurship cell: event plans, documents, letters, question sets and brainstorming. Use a direct formal tone for letters.' },
    { name: 'College', instructions: 'Help me keep track of my college projects and files.' },
    { name: 'Miscellaneous', instructions: '' },
    { name: 'Reminders', instructions: 'Help me track deadlines, important dates and birthdays.' }
];

// Fold new messages into the chat's saved summary.
async function updateSummary(chatId, userId, summarizedCount, oldSummary) {
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

    const result = await callAI([{ role: 'user', content: instruction }], '', undefined, true);

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

app.get('/api/models', requireAuth, (req, res) => {
    res.json(getModels().map((m) => ({ id: m.id, label: m.label })));
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

    if (data.length > 0) {
        return res.json(data);
    }

    const rows = DEFAULT_SPACES.map((s, i) => ({ ...s, position: i, user_id: req.user.id }));
    const { data: seeded, error: seedError } = await supabase
        .from('spaces')
        .insert(rows)
        .select('id, name, instructions');

    if (seedError) {
        console.error('Seed spaces failed:', seedError.message);
        return res.status(500).json({ success: false, error: seedError.message });
    }
    const order = DEFAULT_SPACES.map((s) => s.name);
    seeded.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    res.json(seeded);
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

// ---------- Chats ----------

// List the chats in a space, newest first
app.get('/api/spaces/:spaceId/chats', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('chats')
        .select('id, title, created_at')
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
        let result;
        try {
            result = await callAI(history, system, modelId, autoFallback === true, controller.signal);
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

        // Update the summary in the background. The reply does not wait for it.
        updateSummary(activeChatId, req.user.id, summarizedCount, chatSummary).catch((err) =>
            console.error('Summary update failed:', err.message)
        );

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

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});