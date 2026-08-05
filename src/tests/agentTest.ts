import "dotenv/config";

import { llm, embeddings } from "../config/models";

import handleAcademicSearch from "../agents/academicSearchAgent";
import handleRedditSearch from "../agents/redditSearchAgent";
import handleWebSearch from "../agents/webSearchAgent";
import handleYoutubeSearch from "../agents/youtubeSearchAgent";
import handleImageSearch from "../agents/imageSearchAgent";
import handleVideoSearch from "../agents/videoSearchAgent";
import handleWritingAssistant from "../agents/writingAssistantAgent";
import generateSuggestions from "../agents/suggestionGeneratorAgent";

import {
  AIMessage,
  HumanMessage,
} from "@langchain/core/messages";

import type { EventEmitter } from "node:events";

const runStreamAgent = (
  name: string,
  emitter: EventEmitter,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    emitter.on("data", (data: string) => {
      try {
        console.log(
          `\n${name} data:`,
          JSON.parse(data),
        );
      } catch {
        console.log(
          `\n${name} data:`,
          data,
        );
      }
    });

    emitter.once("end", () => {
      console.log(`\n${name} completed.`);
      resolve();
    });

    emitter.once("error", (error: string) => {
      console.error(
        `\n${name} error:`,
        error,
      );

      reject(new Error(error));
    });
  });
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const main = async (): Promise<void> => {
  console.log("Starting agent tests...\n");

  await runStreamAgent(
    "Academic Search",
    handleAcademicSearch(
      "What is artificial intelligence?",
      [],
      llm,
      embeddings,
    ),
  );

  await wait(15000);

  await runStreamAgent(
    "Reddit Search",
    handleRedditSearch(
      "What do people think about React?",
      [],
      llm,
      embeddings,
    ),
  );

  await wait(15000);


  await runStreamAgent(
    "Web Search",
    handleWebSearch(
      "What are the latest features of React?",
      [],
      llm,
      embeddings,
    ),
  );

await wait(15000);

   await runStreamAgent(
     "YouTube Search",
     handleYoutubeSearch(
       "Find a React tutorial for beginners",
       [],
       llm,
       embeddings,
     ),
   );

  await wait(15000);


  const images = await handleImageSearch(
    "Taj Mahal photographs",
    [],
    llm,
  );

  console.log("\nImage Search results:");
  console.log(images);

  await wait(15000);


  const videos = await handleVideoSearch(
    "Node.js tutorial for beginners",
    [],
    llm,
  );

  console.log("\nVideo Search results:");
  console.log(videos);

  await wait(15000);


  await runStreamAgent(
    "Writing Assistant",
    handleWritingAssistant(
      "Write a short leave application.",
      [],
      llm,
    ),
  );

  await wait(15000);


  const suggestions =
    await generateSuggestions(
      {
        chat_history: [
          new HumanMessage(
            "Explain artificial intelligence.",
          ),
          new AIMessage(
            "Artificial intelligence allows machines to perform tasks that normally require human intelligence.",
          ),
        ],
      },
      llm,
    );

  console.log(
    "\nSuggestion Generator results:",
  );
  console.log(suggestions);

  console.log("\nAll tests completed.");
};

main().catch((error: unknown) => {
  console.error(
    "\nAgent testing failed:",
    error instanceof Error
      ? error.message
      : error,
  );

  process.exitCode = 1;
});