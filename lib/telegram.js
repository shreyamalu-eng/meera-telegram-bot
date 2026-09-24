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
// Returns the ids of the messages sent, so replies to any part of a long draft can be matched.
export async function sendMessage(chatId, text, replyToMessageId) {
  const ids = [];
  for (let i = 0; i < text.length; i += MAX_MESSAGE_LENGTH) {
    const sent = await call("sendMessage", {
      chat_id: chatId,
      text: text.slice(i, i + MAX_MESSAGE_LENGTH),
      ...(i === 0 && replyToMessageId
        ? { reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true } }
        : {}),
    });
    ids.push(sent.message_id);
  }
  return ids;
}

export function sendTyping(chatId) {
  return call("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
}

// Downloads a voice note / audio file Telegram is holding for us.
export async function downloadFile(fileId) {
  const file = await call("getFile", { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
  if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export { call as telegramApi };
