const DEFAULT_MODEL = "gemini-3.6-flash";
const FALLBACK_MODEL = "gemini-3.5-flash";
const BUSY_STATUSES = [429, 500, 503]; // Gemini is overloaded; worth trying again

// One Gemini call with retries: main model twice, then the fallback model once.
// `parts` is the user turn (text and/or inline audio). `schema` asks for JSON back.
export async function gemini({ system, parts, schema }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const attempts = [model, model, FALLBACK_MODEL];
  let lastError;
  for (let i = 0; i < attempts.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      const text = await callGemini(attempts[i], apiKey, { system, parts, schema });
      return { text: schema ? JSON.parse(text) : text, model: attempts[i] };
    } catch (err) {
      lastError = err;
      if (!BUSY_STATUSES.includes(err.status)) throw err;
      console.warn(`Gemini ${attempts[i]} busy (${err.status}), retrying`);
    }
  }
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
