import "dotenv/config";

import { llm, embeddings } from "../config/models";
import handleWebSearch from "../agents/webSearchAgent";

const emitter = handleWebSearch(
  "What are the latest features of React?",
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
  console.log("Web Search completed.");
});

emitter.once("error", (error: string) => {
  console.error("Web Search error:", error);
});