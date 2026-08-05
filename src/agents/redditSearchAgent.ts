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

const redditRetrieverPrompt = `
You will be given a conversation and a follow-up question.

Rewrite the follow-up question as a clear standalone search query that can be
used to find relevant Reddit discussions, user opinions, experiences, and
community responses.

If the user is only greeting, making casual conversation, or asking for a
writing task that does not need a search, return exactly:

not_needed

Examples:

Follow-up question: What do people think about the new iPhone?
Rephrased question: Reddit opinions about the new iPhone

Follow-up question: Is React better than Angular?
Rephrased question: Reddit discussion comparing React and Angular

Follow-up question: Which laptop is good for programming?
Rephrased question: Reddit recommendations for programming laptops

Follow-up question: Hello
Rephrased question: not_needed

Conversation:
{chat_history}

Follow-up question:
{query}

Rephrased question:
`;

const redditResponsePrompt = `
You are FutureSearch, an AI search assistant.

You are working in focus mode "Reddit". The supplied context contains
discussions, opinions, experiences, recommendations, and community responses
retrieved from Reddit.

Answer the user's question using only relevant information available in the
context.

Instructions:

- Give an informative and useful answer.
- Clearly summarize common opinions and different viewpoints.
- Use a neutral and unbiased tone.
- Do not present individual Reddit opinions as verified facts.
- Mention when opinions are mixed or based on personal experiences.
- Do not repeat the same information.
- Do not tell the user to visit another website to obtain the answer.
- You may use headings, paragraphs, and bullet points.
- Cite relevant statements using numbered citations such as [1], [2], or [1][2].
- Citation numbers correspond to the numbered items in the supplied context.
- Do not invent citations or information.
- If the context contains no relevant information, clearly say that relevant
  Reddit discussions could not be found.

<context>
{context}
</context>

Today's date is ${new Date().toISOString()}.
`;

const stringParser = new StringOutputParser();

type RedditChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

type RetrieverOutput = {
  query: string;
  docs: Document[];
};

const createRedditSearchRetrieverChain = (
  llm: BaseChatModel,
) => {
  return RunnableSequence.from([
    PromptTemplate.fromTemplate(
      redditRetrieverPrompt,
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

        const redditQuery = `${standaloneQuery} site:reddit.com`;


        const response = await searchSearxng(
          redditQuery,
          {
            language: "en",
            engines: ["google"],
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
const createRedditSearchAnsweringChain = (
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const retrieverChain =
    createRedditSearchRetrieverChain(llm);

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
      .map(
        (doc, index) =>
          `${index + 1}. ${doc.pageContent}`,
      )
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
        input: RedditChainInput,
      ) => input.query,

      chat_history: (
        input: RedditChainInput,
      ) => input.chat_history,

      context: RunnableSequence.from([
        (
          input: RedditChainInput,
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
      ["system", redditResponsePrompt],

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

const handleRedditSearch = (
  message: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
): EventEmitter => {
  const emitter = new EventEmitter();

  const runAgent = async (): Promise<void> => {
    try {
      const answeringChain =
        createRedditSearchAnsweringChain(
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
      console.error(error);

      emitter.emit(
        "error",
        JSON.stringify({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Reddit search failed",
        }),
      );
    }
  };

  void runAgent();

  return emitter;
};

export default handleRedditSearch;