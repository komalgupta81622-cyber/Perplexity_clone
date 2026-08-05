import { Router } from "express";

import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import generateSuggestions from "../agents/suggestionGeneratorAgent";
import { llm } from "../config/models";

const router = Router();

type HistoryItem = {
  role: string;
  content: string;
};

const convertHistory = (
  history: HistoryItem[] = [],
): BaseMessage[] => {
  return history.map((message) => {
    if (
      message.role === "assistant" ||
      message.role === "ai"
    ) {
      return new AIMessage(message.content);
    }

    if (message.role === "system") {
      return new SystemMessage(message.content);
    }

    return new HumanMessage(message.content);
  });
};

router.post("/suggestions", async (request, response) => {
  try {
    const { history = [] } = request.body as {
      history?: HistoryItem[];
    };

    const suggestions = await generateSuggestions(
      {
        chat_history: convertHistory(history),
      },
      llm,
    );

    response.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    response.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Suggestion generation failed",
    });
  }
});

export default router;