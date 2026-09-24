import { gemini } from "./gemini.js";

// Ask Gemini for search terms, search Google News (free RSS, no key needed), then let Gemini pick the
// most relevant of the top results — Google's first hit is often only loosely related.
// `searchPhrase` comes free with the score; without it we ask Gemini for one.
export async function findNews(note, searchPhrase) {
  const query = searchPhrase || (await searchPhraseFor(note));
  if (!query) return { query, item: null };
  try {
    const results = await googleNews(query);
    return { query, item: await pickRelevant(note, results) };
  } catch (err) {
    console.warn(`News search failed for "${query}": ${err.message}`);
    return { query, item: null };
  }
}

async function searchPhraseFor(note) {
  const { text } = await gemini({
    tier: "light",
    system:
      "Pull 3–5 search keywords from this skincare founder's note and combine them into one short " +
      "Google News search phrase (2–5 words) likely to find a recent, relevant industry news story. " +
      "Prefer specific ingredients, regulations or industry trends over generic words.",
    parts: `Note:\n\n${note}`,
    schema: {
      type: "OBJECT",
      properties: {
        keywords: { type: "ARRAY", items: { type: "STRING" } },
        search_phrase: { type: "STRING" },
      },
      required: ["keywords", "search_phrase"],
    },
  });

  return String(text.search_phrase || "").trim();
}

const MAX_RESULTS = 8;

async function pickRelevant(note, results) {
  if (!results.length) return null;
  const list = results.map((r, i) => `${i}. ${r.headline} (${r.source}, ${r.date})`).join("\n");
  const { text } = await gemini({
    tier: "light",
    system:
      "Pick the one news headline that is most genuinely relevant to this skincare founder's note — " +
      "same ingredient, regulation, claim or industry issue. Return -1 if none is clearly relevant.",
    parts: `Note:\n${note}\n\nHeadlines:\n${list}`,
    schema: { type: "OBJECT", properties: { index: { type: "INTEGER" } }, required: ["index"] },
  });
  return results[text.index] ?? null;
}

async function googleNews(query) {
  const url =
    "https://news.google.com/rss/search?" +
    new URLSearchParams({ q: `${query} when:30d`, hl: "en-IN", gl: "IN", ceid: "IN:en" });
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (draft-bot)" } });
  if (!res.ok) throw new Error(`Google News ${res.status}`);
  const xml = await res.text();

  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, MAX_RESULTS).map(([, item]) => {
    const tag = (name) => decode(item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] || "");
    const source = tag("source");
    let headline = tag("title");
    if (source && headline.endsWith(` - ${source}`)) headline = headline.slice(0, -(source.length + 3));
    const summary = tag("description").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const published = new Date(tag("pubDate"));
    return {
      headline,
      source,
      link: tag("link"),
      date: isNaN(published) ? tag("pubDate") : published.toISOString().slice(0, 10),
      summary: summary && summary !== headline ? summary : headline,
    };
  });
}

function decode(s) {
  return s
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}
