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

const academicRetrieverPrompt = `
You will be given a conversation and a follow-up question.

Rewrite the follow-up question as a clear standalone academic search query.

If the user is only greeting, making casual conversation, or asking for a
writing task that does not need a search, return exactly:

not_needed

Examples:

Follow-up question: How does stable diffusion work?
Rephrased question: Academic papers explaining how stable diffusion works

Follow-up question: What is linear algebra?
Rephrased question: Academic introduction to linear algebra

Follow-up question: What is the third law of thermodynamics?
Rephrased question: Academic research on the third law of thermodynamics

Follow-up question: Hello
Rephrased question: not_needed

Conversation:
{chat_history}

Follow-up question:
{query}

Rephrased question:
`;

const academicResponsePrompt = `
You are FutureSearch, an AI research assistant.

You are working in focus mode "Academic". The supplied context contains
academic papers, research articles, and scholarly search results.

Answer the user's question using only relevant information available in the
context.

Instructions:

- Give an informative and accurate answer.
- Use a neutral and unbiased tone.
- Do not repeat the same information.
- Do not tell the user to visit another website to obtain the answer.
- You may use headings, paragraphs, and bullet points.
- Cite relevant statements using numbered citations such as [1], [2], or [1][2].
- Citation numbers correspond to the numbered items in the supplied context.
- Do not invent citations or information.
- If the context contains no relevant information, clearly say that relevant
  academic information could not be found.

<context>
{context}
</context>

Today's date is ${new Date().toISOString()}.
`;

const stringParser = new StringOutputParser();

type AcademicChainInput = {
  chat_history: BaseMessage[];
  query: string;
};

type RetrieverOutput = {
  query: string;
  docs: Document[];
};

const createAcademicSearchRetrieverChain = (
  llm: BaseChatModel,
) => {
  return RunnableSequence.from([
    PromptTemplate.fromTemplate(
      academicRetrieverPrompt,
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
            engines: [
              "arxiv",
              "google scholar",
              "internetarchivescholar",
              "pubmed",
            ],
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

const createAcademicSearchAnsweringChain = (
  llm: BaseChatModel,
  embeddings: Embeddings,
) => {
  const retrieverChain =
    createAcademicSearchRetrieverChain(llm);

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

      // Highest similarity must come first.
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
        input: AcademicChainInput,
      ) => input.query,

      chat_history: (
        input: AcademicChainInput,
      ) => input.chat_history,

      context: RunnableSequence.from([
        (
          input: AcademicChainInput,
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
      ["system", academicResponsePrompt],

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

const handleAcademicSearch = (
  message: string,
  history: BaseMessage[],
  llm: BaseChatModel,
  embeddings: Embeddings,
): EventEmitter => {
  const emitter = new EventEmitter();

  const runAgent = async (): Promise<void> => {
    try {
      const answeringChain =
        createAcademicSearchAnsweringChain(
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
      console.error("FULL ACADEMIC SEARCH ERROR:");

console.dir(error, {
  depth: null,
});

      emitter.emit(
        "error",
        JSON.stringify({
          success: false,
          error:
  error instanceof Error
    ? error.message || error.name
    : typeof error === "string"
      ? error
      : JSON.stringify(error),
        }),
      );
    }
  };

  void runAgent();

  return emitter;
};

export default handleAcademicSearch;