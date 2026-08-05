import "dotenv/config";

import { embeddings } from "../config/models";

const testEmbeddings = async (): Promise<void> => {
  try {
    console.log("Testing embeddings...");

    const result = await embeddings.embedQuery(
      "What is artificial intelligence?",
    );

    console.log("Embedding is working.");
    console.log("Embedding length:", result.length);
    console.log("First 5 values:", result.slice(0, 5));
  } catch (error) {
    console.error("FULL EMBEDDING ERROR:");

    console.dir(error, {
      depth: null,
    });
  }
};

void testEmbeddings();