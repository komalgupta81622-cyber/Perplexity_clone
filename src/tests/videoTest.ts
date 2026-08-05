import "dotenv/config";

import { llm } from "../config/models";
import handleVideoSearch from "../agents/videoSearchAgent";

const runVideoTest = async (): Promise<void> => {
  try {
    const results = await handleVideoSearch(
      "React tutorial for beginners",
      [],
      llm,
    );

    console.log(results);

    console.log(
      `Total valid videos: ${results.length}`,
    );

    console.log("Video Search completed.");
  } catch (error) {
    console.error(
      "Video Search error:",
      error instanceof Error
        ? error.message
        : error,
    );
  }
};

void runVideoTest();