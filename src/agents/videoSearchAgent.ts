import type { BaseMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import {
  RunnableLambda,
  RunnableMap,
  RunnableSequence,
} from "@langchain/core/runnables";

import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

import formatChatHistoryAsString from "../utils/formatHistory";
import { searchSearxng } from "../services/searchSearxng";

const videoSearchChainPrompt = `
You will be given a conversation and a follow-up question.

Rewrite the follow-up question as a clear standalone video search query.

The query should be suitable for finding relevant YouTube videos,
tutorials, demonstrations, lectures, reviews, and explainers.

Do not answer the question. Only return the rewritten video search query.

Examples:

Follow-up question: Show me a React tutorial
Rephrased question: React tutorial for beginners

Follow-up question: I want a video explaining binary search
Rephrased question: Binary search explained video

Follow-up question: Find a video about machine learning
Rephrased question: Machine learning introduction video

Conversation:
{chat_history}

Follow-up question:
{query}

Rephrased question:
`;

const stringParser = new StringOutputParser();

type VideoSearchChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

export type VideoSearchResult = {
  img_src: string;
  url: string;
  title: string;
  iframe_src: string;
};

const createVideoSearchChain = (
  llm: BaseChatModel,
) => {
  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (
        input: VideoSearchChainInput,
      ) =>
        formatChatHistoryAsString(
          input.chat_history,
        ),

      query: (
        input: VideoSearchChainInput,
      ) => input.query,
    }),

    PromptTemplate.fromTemplate(
      videoSearchChainPrompt,
    ),

    llm,

    stringParser,

    RunnableLambda.from(
      async (
        input: string,
      ): Promise<VideoSearchResult[]> => {
        const standaloneQuery = input.trim();

        if (!standaloneQuery) {
          return [];
        }

        const response = await searchSearxng(
          standaloneQuery,
          {
            language: "en",
            engines: ["youtube"],
          },
        );

        const results: VideoSearchResult[] = [];

        response.results.forEach((result) => {
          const thumbnail =
            result.thumbnail ?? result.img_src;

          const url = result.url;
          const title = result.title;
          const iframeSrc = result.iframe_src;

          const hasRequiredFields =
            typeof thumbnail === "string" &&
            thumbnail.trim().length > 0 &&
            typeof url === "string" &&
            url.trim().length > 0 &&
            typeof title === "string" &&
            title.trim().length > 0 &&
            typeof iframeSrc === "string" &&
            iframeSrc.trim().length > 0;

          if (!hasRequiredFields) {
            return;
          }

          results.push({
            img_src: thumbnail,
            url,
            title,
            iframe_src: iframeSrc,
          });
        });

        return results.slice(0, 10);
      },
    ),
  ]);
};
const handleVideoSearch = async (
  message: string,
  history: BaseMessage[],
  llm: BaseChatModel,
): Promise<VideoSearchResult[]> => {
  try {
    const videoSearchChain =
      createVideoSearchChain(llm);

    const results =
      await videoSearchChain.invoke({
        chat_history: history,
        query: message,
      });

    return results;
  } catch (error) {
    console.error(
      "Video search agent error:",
      error,
    );

    throw new Error(
      error instanceof Error
        ? error.message
        : "Video search failed",
    );
  }
};

export default handleVideoSearch;