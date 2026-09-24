const MAX_MESSAGE_LENGTH = 4096; // Telegram's per-message limit

async function call(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description || res.status}`);
  return data.result;
}

// Sent as plain text (no Markdown parsing) so stray * or _ in a draft can't break delivery.
export async function sendMessage(chatId, text, replyToMessageId) {
  for (let i = 0; i < text.length; i += MAX_MESSAGE_LENGTH) {
    await call("sendMessage", {
      chat_id: chatId,
      text: text.slice(i, i + MAX_MESSAGE_LENGTH),
      ...(i === 0 && replyToMessageId
        ? { reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true } }
        : {}),
    });
  }
}

export function sendTyping(chatId) {
  return call("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
}

export { call as telegramApi };
