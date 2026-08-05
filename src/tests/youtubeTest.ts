import "dotenv/config";

import { llm, embeddings } from "../config/models";
import handleYoutubeSearch from "../agents/youtubeSearchAgent";

const emitter = handleYoutubeSearch(
  "Find a React tutorial for beginners",
  [],
  llm,
  embeddings,
);

emitter.on("data", (data: string) => {
  console.log(JSON.parse(data));
});

emitter.once("end", () => {
  console.log("YouTube Search completed.");
});

emitter.once("error", (error: string) => {
  console.error("YouTube Search error:", error);
});