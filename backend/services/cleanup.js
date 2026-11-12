const supabase = require('./supabase');
const { callAI } = require('./aiService');
const { getUserSettings } = require('./userSettings');

const KEEP_DAYS = 60;

async function cleanupOldMessages() {
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