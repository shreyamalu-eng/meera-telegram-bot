import { waitUntil } from "@vercel/functions";
import { runPipeline, transcribe } from "../lib/pipeline.js";
import { sendMessage, sendTyping, downloadFile } from "../lib/telegram.js";
import { dbEnabled, saveNote, updateNote, updateDraft, findDraftForDecision } from "../lib/db.js";

// Telegram posts every new message here (the "webhook"). Works for a private chat with the bot
// and for a channel the bot is an admin of.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Meera's draft bot is running.");
  }

  // Only accept requests that carry the secret we gave Telegram in set-webhook.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers["x-telegram-bot-api-secret-token"] !== secret) {
    return res.status(401).send("Unauthorized");
  }

  const update = req.body || {};
  const message = update.message || update.channel_post;
  if (!message?.chat) return res.status(200).send("ignored");

  // Answer Telegram straight away (so it never re-sends the note), then keep working in the background.
  waitUntil(handleMessage(update.update_id, message));
  return res.status(200).send("ok");
}

async function handleMessage(updateId, message) {
  const chatId = message.chat.id;
  let noteId = null;

  try {
    const allowed = (process.env.ALLOWED_CHAT_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(String(chatId))) {
      await sendMessage(chatId, `Sorry, this is a private bot. (This chat's ID is ${chatId}.)`);
      return;
    }

    const text = (message.text || message.caption || "").trim();

    if (/^\/(start|help)\b/.test(text)) {
      await sendMessage(
        chatId,
        "Hi Meera! Send me any note — typed or a voice note. I'll score it, and if it's worth a post " +
          "I'll send back a draft in your voice. Reply APPROVE or REJECT to a draft to record your decision. " +
          `Nothing is ever posted for you.\n\n(This chat's ID is ${chatId}.)`
      );
      return;
    }

    const decision = text.match(/^(approve|reject)\b/i)?.[1].toUpperCase();
    if (decision) {
      await recordDecision(chatId, message, decision);
      return;
    }

    let note = text;
    let kind = "text";
    const audio = message.voice || message.audio;
    if (!note && audio) {
      await sendTyping(chatId);
      note = await transcribe(await downloadFile(audio.file_id), audio.mime_type || "audio/ogg");
      kind = "voice";
    }
    if (!note) {
      await sendMessage(chatId, "Send me your note as text or a voice note and I'll work on it.");
      return;
    }

    const saved = await saveNote({ chatId, updateId, text: note, kind });
    if (!saved) return; // Telegram re-sent a note we already handled
    noteId = saved.id;

    await sendTyping(chatId);
    const result = await runPipeline(note, { noteId, chatId });
    const heard = kind === "voice" ? `From your voice note: “${note}”\n\n` : "";
    const ids = await sendMessage(chatId, heard + result.message, message.message_id);
    if (result.draftId) await updateDraft(result.draftId, { telegram_message_ids: ids });
  } catch (err) {
    console.error(err);
    await updateNote(noteId, { status: "error", error: String(err.message).slice(0, 500) }).catch(() => {});
    const reply = err.geminiUnavailable
      ? "Gemini is out of free capacity right now, so I couldn't work on that note. " +
        "Please send it again in an hour or so."
      : "Sorry, something went wrong with that note. Please try again in a minute.";
    await sendMessage(chatId, reply).catch(() => {});
  }
}

async function recordDecision(chatId, message, decision) {
  if (!dbEnabled()) {
    await sendMessage(chatId, "Saving drafts isn't switched on yet, so I couldn't record that.");
    return;
  }
  const draft = await findDraftForDecision(chatId, message.reply_to_message?.message_id);
  if (!draft) {
    await sendMessage(chatId, "I couldn't find a draft to mark. Reply APPROVE or REJECT directly to a draft.");
    return;
  }
  const status = decision === "APPROVE" ? "approved" : "rejected";
  await updateDraft(draft.id, { status, decided_at: new Date().toISOString() });
  await sendMessage(
    chatId,
    status === "approved"
      ? "Marked as approved. Nothing has been posted — publish it on LinkedIn yourself when you're ready."
      : "Marked as rejected. It's kept on record so the drafts can improve.",
    message.message_id
  );
}
