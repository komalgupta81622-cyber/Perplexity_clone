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

const imageSearchChainPrompt = `
You will be given a conversation and a follow-up question.

Rewrite the follow-up question as a clear standalone image search query.

The query should be suitable for finding relevant photographs,
illustrations, diagrams, posters, maps, or other visual content.

Do not answer the question. Only return the rewritten image search query.

Examples:

Follow-up question: Show me pictures of the Taj Mahal
Rephrased question: Taj Mahal photographs

Follow-up question: I need a diagram of the water cycle
Rephrased question: Water cycle educational diagram

Follow-up question: Show me a map of India
Rephrased question: Political map of India

Conversation:
{chat_history}

Follow-up question:
{query}

Rephrased question:
`;

const stringParser = new StringOutputParser();

type ImageSearchChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

export type ImageSearchResult = {
  img_src: string;
  url: string;
  title: string;
};

const createImageSearchChain = (
  llm: BaseChatModel,
) => {
  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (
        input: ImageSearchChainInput,
      ) =>
        formatChatHistoryAsString(
          input.chat_history,
        ),

      query: (
        input: ImageSearchChainInput,
      ) => input.query,
    }),

    PromptTemplate.fromTemplate(
      imageSearchChainPrompt,
    ),

    llm,

    stringParser,

    RunnableLambda.from(
      async (
        input: string,
      ): Promise<ImageSearchResult[]> => {
        const standaloneQuery = input.trim();

        if (!standaloneQuery) {
          return [];
        }

        const response = await searchSearxng(
          standaloneQuery,
          {
            language: "en",

            categories: ["images"],

            engines: [
              "bing images",
              "google images",
            ],
          },
        );

        const results: ImageSearchResult[] = [];

        response.results.forEach((result) => {
          const imgSrc = result.img_src;
          const url = result.url;
          const title = result.title;

          const hasRequiredFields =
            typeof imgSrc === "string" &&
            imgSrc.trim().length > 0 &&
            typeof url === "string" &&
            url.trim().length > 0 &&
            typeof title === "string" &&
            title.trim().length > 0;

          if (!hasRequiredFields) {
            return;
          }

          results.push({
            img_src: imgSrc,
            url,
            title,
          });
        });

        return results.slice(0, 10);
      },
    ),
  ]);
};

const handleImageSearch = async (
  message: string,
  history: BaseMessage[],
  llm: BaseChatModel,
): Promise<ImageSearchResult[]> => {
  try {
    const imageSearchChain =
      createImageSearchChain(llm);

    const results =
      await imageSearchChain.invoke({
        chat_history: history,
        query: message,
      });

    return results;
  } catch (error) {
    console.error(
      "Image search agent error:",
      error,
    );

    throw new Error(
      error instanceof Error
        ? error.message
        : "Image search failed",
    );
  }
};

export default handleImageSearch;