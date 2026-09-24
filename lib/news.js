import { gemini } from "./gemini.js";

// Google News (free RSS, no key) → filter out noise → Gemini picks the one genuinely relevant story, or none.
//
// Search terms come from the scoring call (see score.js) so they cost no extra Gemini request:
//   keywords: the 3–5 specific terms in the note (ingredients, regulators, claims)
//   queries:  2–3 short searches, most specific first. Google News needs every word to match,
//             so long phrases return nothing; short ones return plenty to filter.

export const SEARCH_TERMS_SCHEMA = {
  keywords: { type: "ARRAY", items: { type: "STRING" } },
  queries: { type: "ARRAY", items: { type: "STRING" } },
};

export const SEARCH_TERMS_INSTRUCTIONS = `Also give news search terms for this note:
- keywords: the 3–6 most specific terms in it, each a single term with no brackets or explanations — ingredient names (e.g. "niacinamide", "L-ascorbic acid"),
  regulators (e.g. "CDSCO"), label claims (e.g. "SPF", "clean beauty"), product types (e.g. "sunscreen").
  Use the standard public name, and add the everyday name too when it differs
  (e.g. "L-ascorbic acid" and "vitamin C"). Skip dates, internal words ("supplier", "batch", "customers", "our")
  and anything only Meera's brand would know.
- queries: 2–3 Google News searches of 1–3 words each, most specific first, broadest last.
  Every query must contain at least one of the keywords.
  Put multi-word names in quotes ("clean beauty"). The broadest should still be about the note's topic,
  e.g. "niacinamide skincare", never just "skincare".`;

const LOCALES = [
  { hl: "en-IN", gl: "IN", ceid: "IN:en" }, // Meera's market first
  { hl: "en-US", gl: "US", ceid: "US:en" },
];
const WINDOWS = ["30d", "180d"]; // recent first; widen only if too little comes back
const ENOUGH_CANDIDATES = 4;
const MAX_CANDIDATES = 12;

// Shopping round-ups, deals and paid market-research releases are never a news angle.
const NOISE_TITLE =
  /\b(best|top \d+|\d+ best)\b.*\b(20\d\d|to buy|for (dry|oily|glowing|sensitive))|tested and reviewed|\$\d|₹\s?\d|\bdeals?\b|\bsale\b|% off|discount|amazon|\bmarket (size|share|report|forecast|growth|analysis)|cagr/i;
const NOISE_SOURCE = /openpr|ein ?presswire|globe ?newswire|pr ?newswire|market ?research|mrfr|yahoo shopping/i;

export async function findNews(note, terms) {
  const raw = terms?.queries?.length ? terms : await searchTermsFor(note);
  const keywords = cleanKeywords(raw.keywords || []);
  const cleanQueries = cleanSearches(raw.queries || [], keywords);
  if (!cleanQueries.length) return { query: "", keywords, item: null };

  try {
    const candidates = await gatherCandidates(cleanQueries, keywords);
    const item = candidates.length ? await pickRelevant(note, keywords, candidates) : null;
    return { query: cleanQueries.join(" | "), keywords, candidates: candidates.length, item };
  } catch (err) {
    console.warn(`News search failed for ${cleanQueries.join(" | ")}: ${err.message}`);
    return { query: cleanQueries.join(" | "), keywords, item: null };
  }
}

// "niacinamide (vitamin B3)" → "niacinamide", "vitamin B3": headlines must contain a keyword verbatim.
function cleanKeywords(list) {
  const out = list
    .flatMap((k) => String(k).split(/[()/,;]| or /i))
    .map((k) => k.replace(/["']/g, "").trim().toLowerCase())
    .filter((k) => k.length > 1);
  return [...new Set(out)];
}

// Drop searches that don't mention a keyword (they drift off-topic); fall back to the keywords themselves.
function cleanSearches(list, keywords) {
  const onTopic = list
    .map((q) => String(q).trim())
    .filter((q) => q && keywords.some((k) => q.toLowerCase().replace(/["']/g, "").includes(k)));
  const searches = onTopic.length ? onTopic : keywords.slice(0, 2);
  return [...new Set(searches)].slice(0, 3);
}

// Only used when no terms were passed in (e.g. the compare script).
async function searchTermsFor(note) {
  const { text } = await gemini({
    tier: "light",
    system: `You pick news search terms for a skincare founder's note.\n\n${SEARCH_TERMS_INSTRUCTIONS}`,
    parts: `Note:\n\n${note}`,
    schema: { type: "OBJECT", properties: SEARCH_TERMS_SCHEMA, required: ["keywords", "queries"] },
  });
  return text;
}

async function gatherCandidates(queries, keywords) {
  const seen = new Set();
  const kept = [];
  for (const window of WINDOWS) {
    const batches = await Promise.all(
      queries.flatMap((q) => LOCALES.map((loc) => googleNews(q, window, loc).catch(() => [])))
    );
    for (const item of batches.flat()) {
      const key = item.headline.toLowerCase();
      if (seen.has(key) || isNoise(item) || keywordHits(item, keywords) === 0) continue;
      seen.add(key);
      kept.push(item);
    }
    if (kept.length >= ENOUGH_CANDIDATES) break;
  }
  // Most keyword matches first, then newest.
  return kept
    .sort((a, b) => keywordHits(b, keywords) - keywordHits(a, keywords) || b.date.localeCompare(a.date))
    .slice(0, MAX_CANDIDATES);
}

function isNoise(item) {
  return NOISE_TITLE.test(item.headline) || NOISE_SOURCE.test(item.source);
}

function keywordHits(item, keywords) {
  const haystack = `${item.headline} ${item.summary}`.toLowerCase();
  // Whole words only, so "ph" doesn't match "phone".
  return keywords.filter((k) => new RegExp(`(^|[^a-z0-9])${escapeRegex(k)}($|[^a-z0-9])`).test(haystack)).length;
}

async function pickRelevant(note, keywords, candidates) {
  const list = candidates.map((r, i) => `${i}. ${r.headline} — ${r.source}, ${r.date}`).join("\n");
  const { text } = await gemini({
    tier: "light",
    system:
      "You choose a news hook for a science-led skincare founder's LinkedIn post. Pick the ONE headline " +
      "that is about the same specific issue as her note — the same ingredient, claim, test, regulation " +
      "or industry practice — and that she could credibly reference. A headline that only shares a word, " +
      "is a product recommendation, or is celebrity/lifestyle content does not count. " +
      "Return -1 if none clearly fits; that is the right answer more often than not.",
    parts: `Note:\n${note}\n\nKey terms: ${keywords.join(", ")}\n\nHeadlines:\n${list}`,
    schema: {
      type: "OBJECT",
      properties: { index: { type: "INTEGER" }, why: { type: "STRING" } },
      required: ["index", "why"],
    },
  });
  const item = candidates[text.index];
  return item ? { ...item, why: String(text.why || "").trim() } : null;
}

async function googleNews(query, window, locale) {
  const url =
    "https://news.google.com/rss/search?" + new URLSearchParams({ q: `${query} when:${window}`, ...locale });
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (draft-bot)" } });
  if (!res.ok) throw new Error(`Google News ${res.status}`);
  const xml = await res.text();

  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
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
      summary: summary && !summary.startsWith(headline) ? summary : headline,
    };
  });
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
