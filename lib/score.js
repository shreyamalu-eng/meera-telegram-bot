import { gemini } from "./gemini.js";

export const PASS_SCORE = 6;

const SCORING_INSTRUCTIONS = `You screen raw notes for Meera Pillai, founder of Skinstinct, a science-led D2C skincare brand.
She has a pharmaceutical formulation background and writes LinkedIn posts for urban women aged 28–40
who are tired of marketing and respond to real formulation knowledge.

Score how much potential this note has to become a LinkedIn post she would publish. Be strict:
most raw notes are not posts.

0–3  Not a post: task reminders, logistics, shopping lists, greetings, a half-sentence with no idea,
     or something purely personal/private.
4–5  There is a topic but no real observation yet: too vague, too generic (anyone could say it),
     or too little substance to build on without inventing things.
6–7  A clear observation or opinion connected to her expertise or experience (formulation, labels,
     ingredients, customers, suppliers, manufacturing), with enough substance to develop honestly.
8–10 Specific and strong: a concrete incident, number, customer's words or mechanism, plus a point
     her audience would act on or learn from.

Give the score and one short line explaining it, written to Meera ("This is a reminder, not an idea").`;

export async function scoreNote(note) {
  const { text } = await gemini({
    system: SCORING_INSTRUCTIONS,
    parts: `Note:\n\n${note}`,
    schema: {
      type: "OBJECT",
      properties: {
        score: { type: "INTEGER" },
        reason: { type: "STRING" },
      },
      required: ["score", "reason"],
    },
  });
  const score = Math.max(0, Math.min(10, Math.round(Number(text.score) || 0)));
  return { score, reason: String(text.reason || "").trim(), passed: score >= PASS_SCORE };
}
