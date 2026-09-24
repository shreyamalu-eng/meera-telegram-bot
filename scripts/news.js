// Preview the news step for a note: keywords, searches, how many results survived filtering, and the pick.
// Usage: npm run news -- "my rough note here"
import { findNews } from "../lib/news.js";

const note = process.argv.slice(2).join(" ").trim();
if (!note) {
  console.error('Usage: npm run news -- "your note here"');
  process.exit(1);
}
const { keywords, query, candidates, item } = await findNews(note);
console.log(`Keywords:   ${keywords.join(", ")}`);
console.log(`Searches:   ${query}`);
console.log(`Candidates: ${candidates ?? 0} after filtering`);
console.log(item ? `Picked:     ${item.headline}\n            ${item.source} · ${item.date}\n            Why: ${item.why}\n            ${item.link}` : "Picked:     none relevant");
