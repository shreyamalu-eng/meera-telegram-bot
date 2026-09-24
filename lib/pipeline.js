import { gemini } from "./gemini.js";
import { scoreNote, PASS_SCORE } from "./score.js";
import { findNews } from "./news.js";
import { generateDraft, verifyFlag } from "./draft.js";
import { saveDraft, updateNote } from "./db.js";

// note → score → (stop, or) news → draft in Meera's voice → verify flag.
// Pure: returns what should be sent; the Telegram handler does the sending.
export async function runPipeline(note, { noteId, chatId, provider } = {}) {
  const score = await scoreNote(note);
  await updateNote(noteId, { score: score.score, score_reason: score.reason });

  if (!score.passed) {
    await updateNote(noteId, { status: "rejected_by_score" });
    return {
      score,
      message: `No draft for this one — scored ${score.score}/10 (needs ${PASS_SCORE}).\n${score.reason}`,
    };
  }

  const news = await findNews(note, score.searchPhrase);
  const { draft, usedNews, model } = await generateDraft(note, news, provider);
  const item = usedNews ? news.item : null;

  const message =
    `Score ${score.score}/10 — ${score.reason}\n\n` +
    draft +
    (item ? `\n\n${verifyFlag(item)}` : "") +
    `\n\nReply APPROVE or REJECT to this message.`;

  const saved = await saveDraft({
    note_id: noteId,
    chat_id: chatId,
    model,
    content: draft,
    news_query: news.query || null,
    used_news: Boolean(item),
    news_headline: item?.headline ?? null,
    news_source: item?.source ?? null,
    news_date: item?.date ?? null,
    news_link: item?.link ?? null,
  });
  await updateNote(noteId, { status: "drafted" });

  return { score, news, draft, usedNews: Boolean(item), message, draftId: saved?.id ?? null };
}

// Voice notes: Gemini turns the audio into text before anything else happens.
export async function transcribe(audio, mimeType = "audio/ogg") {
  const { text } = await gemini({
    tier: "light",
    parts: [
      { text: "Transcribe this voice note word for word. Reply with the transcript only." },
      { inline_data: { mime_type: mimeType, data: audio.toString("base64") } },
    ],
  });
  return text.trim();
}
