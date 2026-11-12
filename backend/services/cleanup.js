const supabase = require('./supabase');
const { callAI } = require('./aiService');
const { getUserSettings } = require('./userSettings');

const KEEP_DAYS = 14;
const FILE_KEEP_DAYS = 7;
const FILE_MARK = '\n\n---\nAttached file: ';
const FILE_STUB = 'File removed after 7 days.';

// Keeps each file's name but drops its text.
function stripFiles(content) {
    const parts = content.split(FILE_MARK);
    if (parts.length === 1) return null;
    return parts
        .map((p, i) => {
            if (i === 0) return p;
            const cut = p.indexOf('\n\n');
            const name = cut === -1 ? p : p.slice(0, cut);
            return `${name}\n\n${FILE_STUB}`;
        })
        .join(FILE_MARK);
}

async function removeOldAttachments() {
    const cutoff = new Date(Date.now() - FILE_KEEP_DAYS * 86400000).toISOString();
    const { data } = await supabase
        .from('messages')
        .select('id, content')
        .eq('sender', 'user')
        .lt('created_at', cutoff)
        .like('content', '%Attached file:%')
        .not('content', 'like', `%${FILE_STUB}%`)
        .limit(500);
    for (const m of data || []) {
        const next = stripFiles(m.content);
        if (next) await supabase.from('messages').update({ content: next }).eq('id', m.id);
    }
}

async function cleanupOldMessages() {
    await removeOldAttachments();
    await supabase
        .from('usage_log')
        .delete()
        .lt('created_at', new Date(Date.now() - 7 * 86400000).toISOString());
    const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString();
    const { data: old } = await supabase
        .from('messages')
        .select('id, chat_id, sender, content')
        .lt('created_at', cutoff)
        .order('created_at', { ascending: true })
        .limit(2000);
    if (!old || !old.length) return;

    const byChat = {};
    for (const m of old) (byChat[m.chat_id] ||= []).push(m);

    const keyCache = {};
    for (const [chatId, msgs] of Object.entries(byChat)) {
        try {
            const { data: chat } = await supabase
                .from('chats')
                .select('user_id, summary, summarized_count')
                .eq('id', chatId)
                .single();
            if (!chat) continue;

            if (!keyCache[chat.user_id]) {
                const s = await getUserSettings(chat.user_id);
                keyCache[chat.user_id] = { gemini: s.geminiKey, groq: s.groqKey };
            }
            const keys = keyCache[chat.user_id];
            if (!keys.gemini && !keys.groq) continue; // no key, keep the messages

            const transcript = msgs.map((m) => `${m.sender}: ${m.content}`).join('\n').slice(0, 12000);
            const history = [{
                role: 'user',
                content: `Existing summary: ${chat.summary || 'none'}\n\nOld messages:\n${transcript}\n\nWrite ONE line (max 30 words) capturing everything important. Output only that line.`
            }];
            const { text } = await callAI(history, '', undefined, true, undefined, keys);
            const oneLine = (text || '').trim();
            if (!oneLine) continue;

            await supabase.from('messages').delete().in('id', msgs.map((m) => m.id));
            await supabase.from('chats').update({
                summary: oneLine,
                summarized_count: Math.max(0, (chat.summarized_count || 0) - msgs.length)
            }).eq('id', chatId);
        } catch (e) {
            console.error('cleanup failed for chat', chatId, e.message);
        }
    }
}

module.exports = { cleanupOldMessages };