import "dotenv/config";
import { createApp } from "./app.mjs";
import { startChatListener } from "./services/chatEvents.mjs";

const app = createApp();
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startChatListener().catch((error) => {
    console.error("Chat realtime listener failed:", error.message);
  });
});
