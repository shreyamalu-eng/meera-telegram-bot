# Meera's draft bot

Meera sends a note (typed or a voice note) to a Telegram bot. The bot:

1. **Scores** the note 0–10 with Gemini. Below 6, it replies with the reason and stops.
2. **Finds news**: Gemini picks search words, the bot searches Google News, and Gemini keeps the most
   relevant result (or none).
3. **Drafts** the post in Meera's voice. The whole of `voice-skill.txt` is sent as the model's instructions.
   Drafts that use a news item end with the source, date, link and a "check this before publishing" warning.
4. **Saves** the note and the draft in Supabase (status `pending`). Meera replies **APPROVE** or **REJECT**
   to the draft and the status updates. Nothing is ever posted for her.

## What's in here

| File | What it does |
|---|---|
| `voice-skill.txt` | **How Meera writes.** Sent to Gemini/Claude with every draft. |
| `api/telegram.js` | The address Telegram sends each message to (also reachable as `/api/webhook`). |
| `lib/pipeline.js` | The steps above, in order. Also turns voice notes into text. |
| `lib/score.js` | The 0–10 scoring rules. Edit here if scoring is too strict or too lenient. |
| `lib/news.js` | Key terms → short Google News searches (India + global, last 30 days, widening to 6 months) → drops shopping lists, deals, market-report spam and off-topic headlines → Gemini picks the relevant one, or none. Preview with `npm run news -- "a note"`. |
| `lib/draft.js` | Builds the draft request and the news warning box. |
| `lib/voice.js` | Loads the voice skill (newest copy in Supabase, else `voice-skill.txt`). |
| `lib/gemini.js`, `lib/claude.js` | Talk to Gemini and Claude, retrying when they're busy. |
| `lib/db.js` | Saves to Supabase. Does nothing if Supabase isn't set up. |
| `lib/telegram.js` | Sends messages to Telegram and downloads voice notes. |
| `supabase/schema.sql` | Creates the three tables: notes, drafts, voice_skill. |
| `.env.example` | List of the keys the bot needs. |

## Commands (run in this folder)

- `npm run try -- "a rough note"` — run the whole pipeline on your computer, nothing saved or sent.
- `npm run compare -- "a rough note"` — draft the same note with Gemini and Claude, side by side.
- `npm run seed-voice` — copy `voice-skill.txt` into Supabase.
- `npm run set-webhook -- https://YOUR-PROJECT.vercel.app` — connect Telegram to the bot.
- `npm run webhook-info` — see the last error Telegram got when reaching the bot.

## Setup

1. Create a bot with `@BotFather` in Telegram and get a Gemini key at https://aistudio.google.com/apikey.
2. Copy `.env.example` to `.env` and fill it in.
3. Supabase: paste `supabase/schema.sql` into the SQL Editor and run it, then `npm run seed-voice`.
4. Deploy to Vercel and add the same values under Settings → Environment Variables.
5. `npm run set-webhook -- https://YOUR-PROJECT.vercel.app`
6. Send `/start` to the bot. It replies with the chat ID — put it in `ALLOWED_CHAT_IDS` so only Meera can use it.

To use a Telegram **channel** instead of a private chat, add the bot to the channel as an admin and put the
channel's ID (the bot tells you it) in `ALLOWED_CHAT_IDS`.
