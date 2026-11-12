const supabase = require('./supabase');
const { decrypt } = require('./crypto');

function safeDecrypt(value) {
    try { return value ? decrypt(value) : ''; } catch { return ''; }
}

async function getUserSettings(userId) {
    const { data } = await supabase
        .from('user_settings')
        .select('gemini_key, groq_key, calendar_id, mode')
        .eq('user_id', userId)
        .maybeSingle();

    const ownGeminiKey = safeDecrypt(data?.gemini_key);
    const ownGroqKey = safeDecrypt(data?.groq_key);

    // Users who saved keys before modes existed count as "own".
    const mode = data?.mode || (ownGeminiKey || ownGroqKey ? 'own' : 'shared');
    const useShared = mode === 'shared';

    return {
        mode,
        modeSaved: !!data?.mode,
        geminiKey: useShared ? process.env.GEMINI_API_KEY || '' : ownGeminiKey,
        groqKey: useShared ? process.env.GROQ_API_KEY || '' : ownGroqKey,
        calendarId: data?.calendar_id || '',
        ownGeminiKey,
        ownGroqKey,
        hasOwnGemini: !!ownGeminiKey,
        hasOwnGroq: !!ownGroqKey
    };
}

module.exports = { getUserSettings };