import "dotenv/config";

import { llm } from "../config/models";
import handleWritingAssistant from "../agents/writingAssistantAgent";

const emitter = handleWritingAssistant(
  "Write a short leave application for two days.",
  [],
  llm,
);

emitter.on("data", (data: string) => {
  try {
    console.log(JSON.parse(data));
  } catch {
    console.log(data);
  }
});

emitter.once("end", () => {
  console.log("Writing Assistant completed.");
});

emitter.once("error", (error: string) => {
  console.error(
    "Writing Assistant error:",
    error,
  );
});