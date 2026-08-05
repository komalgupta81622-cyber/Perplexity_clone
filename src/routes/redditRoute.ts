import { Router } from "express";

import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import handleRedditSearch from "../agents/redditSearchAgent";
import { llm, embeddings } from "../config/models";

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

router.post("/reddit", (request, response) => {
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

  response.setHeader(
    "Content-Type",
    "text/event-stream",
  );

  response.setHeader(
    "Cache-Control",
    "no-cache",
  );

  response.setHeader(
    "Connection",
    "keep-alive",
  );

  response.flushHeaders();

  const formattedHistory =
    convertHistory(history);

  const emitter = handleRedditSearch(
    query,
    formattedHistory,
    llm,
    embeddings,
  );

  const handleData = (data: string): void => {
    response.write(`data: ${data}\n\n`);
  };

  const handleEnd = (): void => {
    response.write(
      `event: end\ndata: ${JSON.stringify({
        success: true,
      })}\n\n`,
    );

    response.end();
  };

  const handleError = (
    error: string,
  ): void => {
    if (!response.writableEnded) {
      response.write(
        `event: error\ndata: ${error}\n\n`,
      );

      response.end();
    }
  };

  emitter.on("data", handleData);
  emitter.once("end", handleEnd);
  emitter.once("error", handleError);

  response.on("close", () => {
    emitter.off("data", handleData);
    emitter.off("end", handleEnd);
    emitter.off("error", handleError);
  });
});

export default router;