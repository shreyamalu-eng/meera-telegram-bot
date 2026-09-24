import { readFileSync } from "node:fs";
import { join } from "node:path";
import { latestVoiceSkill } from "./db.js";

// The newest row in Supabase's voice_skill table wins; voice-skill.txt is the fallback.
// vercel.json bundles voice-skill.txt with the function.
let fileCache;
export async function loadVoice() {
  try {
    const fromDb = await latestVoiceSkill();
    if (fromDb) return fromDb;
  } catch (err) {
    console.warn(`Voice skill: using file, Supabase read failed: ${err.message}`);
  }
  if (fileCache === undefined) {
    fileCache = readFileSync(join(process.cwd(), "voice-skill.txt"), "utf8").trim();
  }
  return fileCache;
}
