const axios = require('axios');
const { JWT } = require('google-auth-library');

let auth;

function getAuth() {
    if (!auth) {
        auth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/^"|"$/g, '').replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/calendar.events']
        });
    }
    return auth;
}

async function calendarRequest(method, path, data) {
    const { token } = await getAuth().getAccessToken();
    const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID);
    return axios({
        method,
        url: `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events${path}`,
        data,
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
    });
}

// Adds an event to your Google Calendar and returns its Google event id.
async function createCalendarEvent(title, startDate) {
    const end = new Date(startDate.getTime() + 15 * 60 * 1000);
    const response = await calendarRequest('post', '', {
        summary: title,
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: end.toISOString() },
        reminders: { useDefault: true }
    });
    return response.data.id;
}

async function deleteCalendarEvent(eventId) {
    try {
        await calendarRequest('delete', `/${encodeURIComponent(eventId)}`);
    } catch (err) {
        // Already gone from Google Calendar: nothing left to remove.
        if ([404, 410].includes(err.response?.status)) return;
        throw err;
    }
}

module.exports = { createCalendarEvent, deleteCalendarEvent };