const supabase = require('./supabase');
const { callAI } = require('./aiService');

const KEEP_DAYS = 30;

async function cleanupOldMessages() {
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

  for (const [chatId, msgs] of Object.entries(byChat)) {
    try {
      const { data: chat } = await supabase
        .from('chats').select('summary, summarized_count').eq('id', chatId).single();
      const transcript = msgs.map(m => `${m.sender}: ${m.content}`).join('\n').slice(0, 12000);
      const history = [{
        role: 'user',
        content: `Existing summary: ${chat?.summary || 'none'}\n\nOld messages:\n${transcript}\n\nWrite ONE line (max 30 words) capturing everything important. Output only that line.`
      }];
      const oneLine = (await callAI(history, 'You write concise one-line summaries.', null, true)).trim();
      if (!oneLine) continue;

      await supabase.from('messages').delete().in('id', msgs.map(m => m.id));
      await supabase.from('chats').update({
        summary: oneLine,
        summarized_count: Math.max(0, (chat?.summarized_count || 0) - msgs.length),
      }).eq('id', chatId);
    } catch (e) {
      console.error('cleanup failed for chat', chatId, e.message);
    }
  }
}

module.exports = { cleanupOldMessages };