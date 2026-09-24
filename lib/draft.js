import { gemini } from "./gemini.js";
import { claude } from "./claude.js";
import { loadVoice } from "./voice.js";

// provider: "gemini" or "claude". Defaults to DRAFT_PROVIDER, else gemini.
// The voice skill (voice-skill.txt, or its newest copy in Supabase) is the model's system instruction.
export async function generateDraft(note, news, provider = process.env.DRAFT_PROVIDER || "gemini") {
  const system = await loadVoice();
  const prompt = buildPrompt(note, news?.item);

  const { text, model } =
    provider === "claude" ? await claude({ system, prompt }) : await gemini({ system, parts: prompt });

  // The model reports on its last line whether it used the news item; strip that line out.
  const marker = text.match(/\n?\s*USED_NEWS:\s*(yes|no)\s*$/i);
  const usedNews = Boolean(news?.item) && marker?.[1].toLowerCase() === "yes";
  const draft = (marker ? text.slice(0, marker.index) : text).replace(/\*\*/g, "").replace(/^#{1,6}\s+/gm, "").trim();

  return { draft, usedNews, provider, model };
}

function buildPrompt(note, item) {
  let prompt = `Here is my note:\n\n${note}`;
  if (item) {
    prompt +=
      `\n\nNews item found for this note:\n` +
      `Headline: ${item.headline}\nSource: ${item.source}\nDate: ${item.date}\nSummary: ${item.summary}\n\n` +
      `If this news item is genuinely relevant, use it to make the post timely. ` +
      `If it doesn't fit naturally, ignore it. Only state what the headline and summary actually say.`;
  } else {
    prompt += `\n\nNo relevant news item was found. Do not invent current events, news or statistics.`;
  }
  prompt +=
    `\n\nAfter everything else, end your reply with one final line on its own: ` +
    `"USED_NEWS: yes" if the draft uses the news item, otherwise "USED_NEWS: no".`;
  return prompt;
}

// Mandatory footer for any draft that leans on a news item.
export function verifyFlag(item) {
  const rule = "─────────────────────────────────";
  return [
    rule,
    `NEWS SOURCE: ${item.headline}`,
    `FROM: ${item.source} · ${item.date}`,
    `LINK: ${item.link}`,
    "⚠ Check this before publishing — you are the author of this claim",
    rule,
  ].join("\n");
}
