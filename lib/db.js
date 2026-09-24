// Supabase memory layer (REST API, no SDK). Every function is a no-op when Supabase isn't configured,
// so the bot still works without it.

export function dbEnabled() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

async function rest(path, { method = "GET", body, prefer } = {}) {
  const key = process.env.SUPABASE_SECRET_KEY;
  const res = await fetch(`${process.env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]} failed: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// Returns the saved note, or null if this Telegram update was already handled (Telegram retried).
export async function saveNote({ chatId, updateId, text, kind }) {
  if (!dbEnabled()) return { id: null };
  const rows = await rest("notes?on_conflict=telegram_update_id", {
    method: "POST",
    body: { chat_id: chatId, telegram_update_id: updateId, text, kind, status: "received" },
    prefer: "resolution=ignore-duplicates,return=representation",
  });
  return rows[0] || null;
}

export async function updateNote(id, fields) {
  if (!dbEnabled() || !id) return;
  await rest(`notes?id=eq.${id}`, { method: "PATCH", body: fields });
}

export async function saveDraft(fields) {
  if (!dbEnabled()) return { id: null };
  const rows = await rest("drafts", {
    method: "POST",
    body: { status: "pending", ...fields },
    prefer: "return=representation",
  });
  return rows[0];
}

export async function updateDraft(id, fields) {
  if (!dbEnabled() || !id) return;
  await rest(`drafts?id=eq.${id}`, { method: "PATCH", body: fields });
}

// The draft Meera replied to, or else her most recent pending draft.
export async function findDraftForDecision(chatId, replyToMessageId) {
  if (!dbEnabled()) return null;
  if (replyToMessageId) {
    const rows = await rest(
      `drafts?chat_id=eq.${chatId}&telegram_message_ids=cs.%7B${replyToMessageId}%7D&limit=1`
    );
    if (rows[0]) return rows[0];
  }
  const rows = await rest(`drafts?chat_id=eq.${chatId}&status=eq.pending&order=created_at.desc&limit=1`);
  return rows[0] || null;
}

export async function latestVoiceSkill() {
  if (!dbEnabled()) return null;
  const rows = await rest("voice_skill?select=content&order=created_at.desc&limit=1");
  return rows[0]?.content?.trim() || null;
}

export async function saveVoiceSkill(content) {
  return rest("voice_skill", { method: "POST", body: { content }, prefer: "return=representation" });
}
