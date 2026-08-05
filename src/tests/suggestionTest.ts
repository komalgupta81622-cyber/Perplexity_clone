import "dotenv/config";

import {
  AIMessage,
  HumanMessage,
} from "@langchain/core/messages";

import { llm } from "../config/models";
import generateSuggestions from "../agents/suggestionGeneratorAgent";

const runSuggestionTest =
  async (): Promise<void> => {
    try {
      console.log(
        "Testing Suggestion Generator...",
      );

      const suggestions =
        await generateSuggestions(
          {
            chat_history: [
              new HumanMessage(
                "What is artificial intelligence?",
              ),

              new AIMessage(
                "Artificial intelligence allows machines to perform tasks that normally require human intelligence.",
              ),
            ],
          },
          llm,
        );

      console.log(
        "Generated suggestions:",
      );

      console.log(suggestions);

      console.log(
        `Total suggestions: ${suggestions.length}`,
      );

      console.log(
        "Suggestion Generator completed.",
      );
    } catch (error) {
      console.error(
        "Suggestion Generator error:",
        error instanceof Error
          ? error.message
          : error,
      );
    }
  };

void runSuggestionTest();