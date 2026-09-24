// Run the whole pipeline (score → news → draft) on a note without Telegram. Nothing is saved.
// Usage: npm run try -- "my rough note here"
import { runPipeline } from "../lib/pipeline.js";

const note = process.argv.slice(2).join(" ").trim();
if (!note) {
  console.error('Usage: npm run try -- "your note here"');
  process.exit(1);
}
const result = await runPipeline(note);
if (result.news) {
  const { keywords, query, candidates, item } = result.news;
  console.log(`[keywords: ${keywords.join(", ")}]\n[searches: ${query}] [${candidates ?? 0} candidates]`);
  console.log(`[picked: ${item ? `${item.headline} (${item.source}) — ${item.why}` : "none relevant"}]\n`);
}
console.log(result.message);
