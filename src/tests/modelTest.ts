import "dotenv/config";

import { llm } from "../config/models";

const testModel = async (): Promise<void> => {
  try {
    console.log("Testing Google model...");

    const response = await llm.invoke(
      "Reply with only: Model is working",
    );

    console.log("Model response:", response.content);
  } catch (error) {
    console.error("FULL MODEL ERROR:");

    console.dir(error, {
      depth: null,
    });
  }
};

void testModel();