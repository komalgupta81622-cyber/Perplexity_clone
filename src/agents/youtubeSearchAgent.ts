import { EventEmitter } from "node:events";

import type { BaseMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { Embeddings } from "@langchain/core/embeddings";

import { Document } from "@langchain/core/documents";

import {
  RunnableLambda,
  RunnableMap,
  RunnableSequence,
} from "@langchain/core/runnables";

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from "@langchain/core/prompts";

import { StringOutputParser } from "@langchain/core/output_parsers";

import formatChatHistoryAsString from "../utils/formatHistory";
import computeSimilarity from "../utils/computeSimilarity";
import { handleStream } from "../utils/handleStream";
import { searchSearxng } from "../services/searchSearxng";

const youtubeRetrieverPrompt = `
You will be given a conversation and a follow-up question.

Rewrite the follow-up question as a clear standalone YouTube search query.

The query should help retrieve educational videos, tutorials, talks,
demonstrations, reviews, and explanatory content.

If the user is only greeting, making casual conversation, or asking for a
writing task that does not require search, return exactly:

not_needed

Examples:

Follow-up question: How do I learn React?
Rephrased question: React tutorial YouTube

Follow-up question: Explain binary search
Rephrased question: Binary search explained YouTube

Follow-up question: How to build a chatbot?
Rephrased question: AI chatbot tutorial YouTube

Follow-up question: Hello
Rephrased question: not_needed

Conversation:
{chat_history}

Follow-up question:
{query}

Rephrased question:
`;

const youtubeResponsePrompt = `
You are FutureSearch, an AI research assistant.

You are working in focus mode "YouTube".

The supplied context contains YouTube videos and educational content.

Answer the user's question using only relevant information available in the context.

Instructions:

- Give a clear and informative answer.
- Summarize the important concepts.
- Use a neutral tone.
- Do not invent information.
- Cite relevant statements using numbered citations like [1], [2].
- If no useful information exists, clearly say so.

<context>
{context}
</context>

Today's date is ${new Date().toISOString()}.
`;

const stringParser = new StringOutputParser();

type YoutubeChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

type RetrieverOutput = {
  query: string;
  docs: Document[];
};

const createYoutubeSearchRetrieverChain = (
  llm: BaseChatModel,
) => {
  return RunnableSequence.from([
    PromptTemplate.fromTemplate(
      youtubeRetrieverPrompt,
    ),

    llm,

    stringParser,

    RunnableLambda.from(
      async (
        input: string,
      ): Promise<RetrieverOutput> => {
        const standaloneQuery = input.trim();

        if (standaloneQuery === "not_needed") {
          return {
            query: "",
            docs: [],
          };
        }

        const response = await searchSearxng(
          standaloneQuery,
          {
            language: "en",
            engines: ["youtube"],
          },
        );

        const documents = response.results.map(
          (result) =>
            new Document({
              pageContent: result.content,
              metadata: {
                title: result.title,
                url: result.url,

                ...(result.img_src
                  ? {
                      img_src: result.img_src,
                    }
                  : {}),
              },
            }),
        );

        return {
          query: standaloneQuery,
          docs: documents,
        };
      },
    ),
  ]);
};
const createYoutubeSearchAnsweringChain = (
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const retrieverChain =
    createYoutubeSearchRetrieverChain(llm);

  const rerankDocs = async ({
    query,
    docs,
  }: RetrieverOutput): Promise<Document[]> => {
    if (!query || docs.length === 0) {
      return [];
    }

    const docsWithContent = docs.filter(
      (doc) =>
        typeof doc.pageContent === "string" &&
        doc.pageContent.trim().length > 0,
    );

    if (docsWithContent.length === 0) {
      return [];
    }

    const [documentEmbeddings, queryEmbedding] =
      await Promise.all([
        embeddings.embedDocuments(
          docsWithContent.map(
            (doc) => doc.pageContent,
          ),
        ),

        embeddings.embedQuery(query),
      ]);

    return documentEmbeddings
      .map((documentEmbedding, index) => ({
        index,
        similarity: computeSimilarity(
          queryEmbedding,
          documentEmbedding,
        ),
      }))
      .sort(
        (first, second) =>
          second.similarity - first.similarity,
      )
      .filter(
        (item) => item.similarity > 0.5,
      )
      .slice(0, 15)
      .map(
        (item) => docsWithContent[item.index],
      )
      .filter(
        (doc): doc is Document =>
          doc !== undefined,
      );
  };

  const processDocs = (
    docs: Document[],
  ): string => {
    return docs
      .map((doc, index) => {
        const title =
          typeof doc.metadata.title === "string"
            ? doc.metadata.title
            : "Untitled video";

        const url =
          typeof doc.metadata.url === "string"
            ? doc.metadata.url
            : "";

        return `
${index + 1}.
Title: ${title}
URL: ${url}
Content: ${doc.pageContent}
`;
      })
      .join("\n");
  };

  const sourceRetriever = retrieverChain
    .pipe(
      RunnableLambda.from(rerankDocs),
    )
    .withConfig({
      runName: "FinalSourceRetriever",
    });

  return RunnableSequence.from([
    RunnableMap.from({
      query: (
        input: YoutubeChainInput,
      ) => input.query,

      chat_history: (
        input: YoutubeChainInput,
      ) => input.chat_history,

      context: RunnableSequence.from([
        (
          input: YoutubeChainInput,
        ) => ({
          query: input.query,

          chat_history:
            formatChatHistoryAsString(
              input.chat_history,
            ),
        }),

        sourceRetriever,

        RunnableLambda.from(processDocs),
      ]),
    }),

    ChatPromptTemplate.fromMessages([
      ["system", youtubeResponsePrompt],

      new MessagesPlaceholder(
        "chat_history",
      ),

      ["user", "{query}"],
    ]),

    llm,

    stringParser,
  ]).withConfig({
    runName: "FinalResponseGenerator",
  });
};

const handleYoutubeSearch = (
  message: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
): EventEmitter => {
  const emitter = new EventEmitter();

  const runAgent = async (): Promise<void> => {
    try {
      const answeringChain =
        createYoutubeSearchAnsweringChain(
          llm,
          embeddings,
        );

      const stream =
        answeringChain.streamEvents(
          {
            chat_history: history,
            query: message,
          },
          {
            version: "v2",
          },
        );

      await handleStream(stream, emitter);
    } catch (error) {
      console.error(
        "YouTube search agent error:",
        error,
      );

      emitter.emit(
        "error",
        JSON.stringify({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "YouTube search failed",
        }),
      );
    }
  };

  void runAgent();

  return emitter;
};

export default handleYoutubeSearch;