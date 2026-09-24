import { generateDraft } from "../lib/draft.js";
import { sendMessage, sendTyping } from "../lib/telegram.js";

// Telegram posts every new message here (the "webhook").
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Meera's draft bot is running.");
  }

  // Only accept requests that carry the secret we gave Telegram in set-webhook.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers["x-telegram-bot-api-secret-token"] !== secret) {
    return res.status(401).send("Unauthorized");
  }

  const message = req.body?.message;
  if (!message?.chat) return res.status(200).send("ignored");

  const chatId = message.chat.id;
  const text = message.text?.trim();

  try {
    const allowed = (process.env.ALLOWED_CHAT_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(String(chatId))) {
      await sendMessage(chatId, `Sorry, this is a private bot. (Your chat ID is ${chatId}.)`);
      return res.status(200).send("ok");
    }

    if (!text) {
      await sendMessage(chatId, "Send me your note as a text message and I'll turn it into a draft post.");
    } else if (text.startsWith("/start") || text.startsWith("/help")) {
      await sendMessage(
        chatId,
        `Hi Meera! Send me any note and I'll send back a draft post in your voice.\n\n(Your chat ID is ${chatId}.)`
      );
    } else {
      await sendTyping(chatId);
      const draft = await generateDraft(text);
      await sendMessage(chatId, draft, message.message_id);
    }
  } catch (err) {
    console.error(err);
    await sendMessage(chatId, "Sorry, something went wrong making that draft. Please try again in a minute.").catch(
      () => {}
    );
  }

  // Always answer 200 so Telegram doesn't keep re-sending the same note.
  return res.status(200).send("ok");
}
