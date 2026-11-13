# Pocket Me

A personal AI assistant organised into topic **spaces**. Each space (Mehfil, coding, reminders, and more) holds its own chats, and chats inside a space know about each other. Built as an installable PWA, and designed to run entirely on free tiers.

**Live:** https://pocket-me-ten.vercel.app

---

## Features

- **Spaces:** six main spaces, one per area of life or work. Create, edit and delete your own.
- **Chats:** create, rename and delete chats inside a space. Full history is saved in the database.
- **Memory:** the last 20 messages are kept verbatim. Older messages are compressed into rolling summaries stored in the database, and summaries are shared across chats within the same space.
- **Multi-model AI:** Gemini and Groq APIs with multiple models, plus a fallback button that switches model when one is busy.
- **Message actions:** copy, edit and resend on any message. Markdown rendering for AI replies.
- **Stop button:** cancel an AI reply while it is being generated.
- **Reminders:** add and delete reminders, synced straight to Google Calendar so your phone notifies you.
- **PWA:** installable on phone and desktop, app name "Pocket Me".

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, supabase-js |
| Backend | Node.js, Express 5, axios, cors, dotenv |
| Database & Auth | Supabase |
| AI | Gemini API, Groq API |
| Calendar | Google Calendar API (service account) |
| PWA | vite-plugin-pwa |
| Hosting | Vercel (two projects from one repo) |

---

## Project Structure

```
pocket-me/
├── backend/          # Express API (AI calls, chats, summaries, reminders)
│   └── .env          # secrets, never committed
├── frontend/         # React + Vite PWA
│   ├── src/
│   │   └── reminders.jsx
│   ├── public/       # favicon.svg, PWA icons
│   └── vercel.json   # forwards /api to the backend project
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (free tier)
- Gemini API key and Groq API key
- A Google Cloud service account with access to your calendar

### Google Calendar sync

1. Create a service account in Google Cloud and download its credentials.
2. Share your Google Calendar with the service account email, with the permission **Make changes to events**.
3. Put the credentials in `backend/.env`.

Every reminder you add is now created directly in your calendar.

---

## Deployment

Both apps deploy to Vercel from the same repo as two separate projects:

| Project | Root directory |
|---|---|
| Backend | `backend` |
| Frontend | `frontend` |

`frontend/vercel.json` rewrites `/api` requests to the backend project. Add all environment variables in each Vercel project's settings.

---

## Free-Tier Notes

Pocket Me is built so that nothing costs money.

- **Supabase free tier pauses after 7 days of inactivity.** Open the app at least once a week to keep the database awake.
- Gemini and Groq free tiers have rate limits. Use the model fallback button when a model is busy.

---

## Roadmap

- [ ] Landing page showing all spaces at once
- [ ] Snowfall effect on the landing page only
- [ ] Icons instead of text links for Copy / Edit / Resend
- [ ] In-app pop-up warning before the Supabase database pauses
- [ ] New app icon
- [ ] Beige theme with bold borders and orange Send button across all screens

---

## License

Personal project. All rights reserved.