// Shows where Telegram is sending messages and any recent delivery errors.
import { telegramApi } from "../lib/telegram.js";

console.log(await telegramApi("getWebhookInfo", {}));
