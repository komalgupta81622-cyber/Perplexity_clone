import "dotenv/config";

import { llm, embeddings } from "../config/models";
import handleRedditSearch from "../agents/redditSearchAgent";

const emitter = handleRedditSearch(
  "What do people think about React?",
  [],
  llm,
  embeddings,
);

emitter.on("data", (data: string) => {
  try {
    console.log(JSON.parse(data));
  } catch {
    console.log(data);
  }
});

emitter.once("end", () => {
  console.log("Reddit Search completed.");
});

emitter.once("error", (error: string) => {
  console.error("Reddit Search error:", error);
});