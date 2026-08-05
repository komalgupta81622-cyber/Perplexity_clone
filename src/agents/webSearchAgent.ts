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

const webRetrieverPrompt = `
You will be given a conversation and a follow-up question.

Rewrite the follow-up question as a clear standalone web search query.

The query should be suitable for searching general websites, news articles,
blogs, documentation, guides, and other reliable online sources.

If the user is only greeting, making casual conversation, or asking for a
writing task that does not require web search, return exactly:

not_needed

Examples:

Follow-up question: What is artificial intelligence?
Rephrased question: What is artificial intelligence and how does it work

Follow-up question: What are the latest features of React?
Rephrased question: Latest React features and updates

Follow-up question: How can I install Node.js?
Rephrased question: How to install Node.js step by step

Follow-up question: Who invented the World Wide Web?
Rephrased question: Inventor and history of the World Wide Web

Follow-up question: Hello
Rephrased question: not_needed

Conversation:
{chat_history}

Follow-up question:
{query}

Rephrased question:
`;

const webResponsePrompt = `
You are FutureSearch, an AI web research assistant.

You are working in focus mode "Web Search". The supplied context contains
general web search results, articles, documentation, guides, and other online
sources.

Answer the user's question using only relevant information available in the
context.

Instructions:

- Give an informative, clear, and accurate answer.
- Use a neutral and unbiased tone.
- Organize the answer using headings, paragraphs, or bullet points when useful.
- Do not repeat the same information.
- Do not tell the user to visit another website to get the answer.
- Prefer information that directly answers the user's question.
- Distinguish facts from opinions when necessary.
- Cite relevant statements using numbered citations such as [1], [2], or [1][2].
- Citation numbers must correspond to the numbered items in the supplied context.
- Do not invent citations, facts, or information.
- If the context contains no relevant information, clearly say that relevant
  web information could not be found.

<context>
{context}
</context>

Today's date is ${new Date().toISOString()}.
`;

const stringParser = new StringOutputParser();

type WebChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

type RetrieverOutput = {
  query: string;
  docs: Document[];
};

const createWebSearchRetrieverChain = (
  llm: BaseChatModel,
) => {
  return RunnableSequence.from([
    PromptTemplate.fromTemplate(
      webRetrieverPrompt,
    ),

    llm,

    stringParser,

    RunnableLambda.from(
      async (
        input: string,
      ): Promise<RetrieverOutput> => {
        const standaloneQuery = input.trim();

        if (
          standaloneQuery.toLowerCase() ===
          "not_needed"
        ) {
          return {
            query: "",
            docs: [],
          };
        }

        const response = await searchSearxng(
          standaloneQuery,
          {
            language: "en",
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

const createWebSearchAnsweringChain = (
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const retrieverChain =
    createWebSearchRetrieverChain(llm);

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
            : "Untitled source";

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
        input: WebChainInput,
      ) => input.query,

      chat_history: (
        input: WebChainInput,
      ) => input.chat_history,

      context: RunnableSequence.from([
        (
          input: WebChainInput,
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
      ["system", webResponsePrompt],

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

const handleWebSearch = (
  message: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
): EventEmitter => {
  const emitter = new EventEmitter();

  const runAgent = async (): Promise<void> => {
    try {
      const answeringChain =
        createWebSearchAnsweringChain(
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
        "Web search agent error:",
        error,
      );

      emitter.emit(
        "error",
        JSON.stringify({
          success: false,

          error:
            error instanceof Error
              ? error.message
              : "Web search failed",
        }),
      );
    }
  };

  void runAgent();

  return emitter;
};

export default handleWebSearch;