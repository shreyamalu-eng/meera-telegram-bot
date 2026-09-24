// Draft the same note with Gemini and with Claude, side by side (same voice skill, same news item).
// Usage: npm run compare -- "my rough note here"
import { findNews } from "../lib/news.js";
import { generateDraft } from "../lib/draft.js";

const note = process.argv.slice(2).join(" ").trim();
if (!note) {
  console.error('Usage: npm run compare -- "your note here"');
  process.exit(1);
}
const news = await findNews(note);
console.log(`News item: ${news.item ? `${news.item.headline} (${news.item.source})` : "none found"}\n`);

const [g, c] = await Promise.all([generateDraft(note, news, "gemini"), generateDraft(note, news, "claude")]);
for (const d of [g, c]) {
  console.log(`=============== ${d.model} ${d.usedNews ? "(used the news)" : ""}\n\n${d.draft}\n`);
}
