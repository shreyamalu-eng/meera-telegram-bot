// Tells Telegram where to send Meera's messages.
// Usage: npm run set-webhook -- https://your-project.vercel.app
import { telegramApi } from "../lib/telegram.js";

const base = (process.argv[2] || "").replace(/\/+$/, "");
if (!base.startsWith("https://")) {
  console.error("Give your Vercel address, e.g.  npm run set-webhook -- https://your-project.vercel.app");
  process.exit(1);
}

const url = `${base}/api/telegram`;
await telegramApi("setWebhook", {
  url,
  allowed_updates: ["message"],
  drop_pending_updates: true,
  ...(process.env.TELEGRAM_WEBHOOK_SECRET ? { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET } : {}),
});
console.log(`Done. Telegram will now send messages to ${url}`);
