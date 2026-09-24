// Each Gemini model has its own free-tier allowance, so when one is used up (429) or overloaded (503)
// we move down the list. "light" jobs (scoring, search words, picking news) use the cheap lite models;
// "draft" jobs use the full Flash models and only fall back to lite as a last resort.
const MODELS = {
  draft: [
    process.env.GEMINI_MODEL || "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
  ],
  light: ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.6-flash"],
};
const OVERLOADED = [500, 503]; // worth one more try on the same model
const USED_UP = 429; // quota for this model is gone; go straight to the next one

// `parts` is the user turn (text and/or inline audio). `schema` asks for JSON back.
export async function gemini({ system, parts, schema, tier = "draft" }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const models = [...new Set(MODELS[tier])];
  let lastError;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await callGemini(model, apiKey, { system, parts, schema });
        return { text: schema ? JSON.parse(text) : text, model };
      } catch (err) {
        lastError = err;
        if (err.status === USED_UP) {
          console.warn(`Gemini ${model} quota used up, trying next model`);
          break;
        }
        if (!OVERLOADED.includes(err.status)) throw err;
        console.warn(`Gemini ${model} busy (${err.status})`);
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  if (lastError?.status === USED_UP || OVERLOADED.includes(lastError?.status)) lastError.geminiUnavailable = true;
  throw lastError;
}

async function callGemini(model, apiKey, { system, parts, schema }) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
        contents: [{ role: "user", parts: typeof parts === "string" ? [{ text: parts }] : parts }],
        ...(schema
          ? { generationConfig: { responseMimeType: "application/json", responseSchema: schema } }
          : {}),
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Gemini error ${res.status} (${model}): ${data.error?.message || "unknown"}`);
    err.status = res.status;
    throw err;
  }

  const text = (data.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("")
    .trim();
  if (!text) {
    const reason = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || "empty reply";
    throw new Error(`Gemini returned no text (${reason})`);
  }
  return text;
}
