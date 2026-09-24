# Meera's draft bot

Meera texts a note to a Telegram bot. The bot sends the note to Gemini along with the
instructions in `voice-skill.txt`, then replies in the same chat with a draft post.

## What's in here

| File | What it does |
|---|---|
| `voice-skill.txt` | **How Meera writes.** Paste the voice instructions here. |
| `api/telegram.js` | The address Telegram sends each message to. Replies with the draft. |
| `lib/draft.js` | Sends the note plus `voice-skill.txt` to Gemini. |
| `lib/telegram.js` | Sends messages back to Telegram. |
| `scripts/` | Helpers for testing and connecting Telegram. |
| `.env.example` | List of the keys the bot needs. |

## Setup

1. **Create the bot.** In Telegram, message `@BotFather`, send `/newbot`, and copy the token it gives you.
2. **Get a Gemini key** at https://aistudio.google.com/apikey.
3. **Fill in the keys.** Copy `.env.example` to `.env` and fill it in. Leave `ALLOWED_CHAT_IDS` empty for now.
4. **Add the voice.** Replace the contents of `voice-skill.txt` with Meera's writing instructions.
5. **Try it on your computer (optional):** `npm run try -- "some rough note"` prints a draft.
6. **Deploy to Vercel.** Run `vercel` in this folder (or import it on vercel.com). In the Vercel
   project, go to Settings → Environment Variables and add the same values from `.env`.
   Then redeploy (`vercel --prod`).
7. **Connect Telegram to Vercel:** `npm run set-webhook -- https://YOUR-PROJECT.vercel.app`
8. **Lock it to Meera.** Have Meera send `/start` to the bot. It replies with her chat ID.
   Put that number in `ALLOWED_CHAT_IDS` on Vercel and redeploy.

## Changing the voice later

Edit `voice-skill.txt` and redeploy. Every new note uses the updated instructions.

## If it isn't replying

- `npm run webhook-info` shows the last error Telegram got when it tried to reach the bot.
- Vercel → your project → Logs shows errors from the bot itself.
- If you change `TELEGRAM_WEBHOOK_SECRET`, run step 7 again.
