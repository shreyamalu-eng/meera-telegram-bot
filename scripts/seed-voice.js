// Copies voice-skill.txt into Supabase's voice_skill table. The bot uses the newest row.
// Run again after editing voice-skill.txt: npm run seed-voice
import { readFileSync } from "node:fs";
import { dbEnabled, saveVoiceSkill } from "../lib/db.js";

if (!dbEnabled()) {
  console.error("Add SUPABASE_URL and SUPABASE_SECRET_KEY to .env first.");
  process.exit(1);
}
const [row] = await saveVoiceSkill(readFileSync("voice-skill.txt", "utf8").trim());
console.log(`Saved voice skill #${row.id} (${row.content.length} characters).`);
