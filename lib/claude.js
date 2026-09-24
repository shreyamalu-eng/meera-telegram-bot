const DEFAULT_MODEL = "claude-sonnet-5";
const RETRY_STATUSES = [429, 500, 503, 529]; // rate-limited or overloaded

export async function claude({ system, prompt }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = process.env.CLAUDE_MODEL || DEFAULT_MODEL;

  let lastError;
  for (let i = 0; i < 3; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2000 * i));
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Only needed for API keys that aren't tied to a single workspace.
        ...(process.env.ANTHROPIC_WORKSPACE_ID
          ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID }
          : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      if (!text) throw new Error(`Claude returned no text (${data.stop_reason || "empty reply"})`);
      return { text, model };
    }
    lastError = new Error(`Claude error ${res.status}: ${data.error?.message || "unknown"}`);
    if (!RETRY_STATUSES.includes(res.status)) break;
    console.warn(`Claude busy (${res.status}), retrying`);
  }
  throw lastError;
}
