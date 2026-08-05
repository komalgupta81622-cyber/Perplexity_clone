import { Router } from "express";

import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import handleImageSearch from "../agents/imageSearchAgent";
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

router.post("/images", async (request, response) => {
  try {
    const { query, history = [] } = request.body as {
      query?: string;
      history?: HistoryItem[];
    };

    if (!query || typeof query !== "string") {
      response.status(400).json({
        success: false,
        error: "Query is required.",
      });

      return;
    }

    const results = await handleImageSearch(
      query,
      convertHistory(history),
      llm,
    );

    response.json({
      success: true,
      data: results,
    });
  } catch (error) {
    response.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Image search failed",
    });
  }
});

export default router;