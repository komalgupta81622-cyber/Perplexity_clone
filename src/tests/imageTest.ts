import "dotenv/config";

import { llm } from "../config/models";
import handleImageSearch from "../agents/imageSearchAgent";

const runImageTest = async (): Promise<void> => {
  try {
    console.log("Testing Image Search Agent...");

    const results = await handleImageSearch(
      "Taj Mahal photographs",
      [],
      llm,
    );

    console.log("Image Search results:");
    console.log(results);

    console.log(
      `Total valid images: ${results.length}`,
    );

    console.log("Image Search completed.");
  } catch (error) {
    console.error(
      "Image Search error:",
      error instanceof Error
        ? error.message
        : error,
    );
  }
};

void runImageTest();