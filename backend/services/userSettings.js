const supabase = require('./supabase');
const { decrypt } = require('./crypto');

function safeDecrypt(value) {
    try { return value ? decrypt(value) : ''; } catch { return ''; }
}

async function getUserSettings(userId) {
    const { data } = await supabase
        .from('user_settings')
        .select('gemini_key, groq_key, calendar_id')
        .eq('user_id', userId)
        .maybeSingle();
    return {
        geminiKey: safeDecrypt(data?.gemini_key),
        groqKey: safeDecrypt(data?.groq_key),
        calendarId: data?.calendar_id || ''
    };
}

module.exports = { getUserSettings };