import { EventEmitter } from "node:events";

import type { BaseMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

import {
  RunnableSequence,
} from "@langchain/core/runnables";

import { StringOutputParser } from "@langchain/core/output_parsers";

import { handleStream } from "../utils/handleStream";

const writingAssistantPrompt = `
You are FutureSearch, an AI writing assistant.

Your job is to help the user write, rewrite, improve, summarize, expand,
shorten, correct, or organize text.

Instructions:

- Follow the user's writing instructions carefully.
- Preserve the user's intended meaning.
- Use the tone, format, language, and length requested by the user.
- Give clear and well-structured writing.
- Correct grammar, spelling, punctuation, and sentence structure when needed.
- Do not perform web searches.
- Do not invent facts that the user has not provided.
- If important information is missing, ask the user for the required details.
- If the task requires current facts or online research, clearly suggest using
  an appropriate search focus mode.
- Return only the useful writing response without unnecessary explanation.
`;

const stringParser = new StringOutputParser();

type WritingAssistantInput = {
  chat_history: BaseMessage[];
  query: string;
};

const createWritingAssistantChain = (
  llm: BaseChatModel,
) => {
  return RunnableSequence.from([
    ChatPromptTemplate.fromMessages([
      ["system", writingAssistantPrompt],

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
const handleWritingAssistant = (
  message: string,
  history: BaseMessage[],
  llm: BaseChatModel,
): EventEmitter => {
  const emitter = new EventEmitter();

  const runAgent = async (): Promise<void> => {
    try {
      const writingChain =
        createWritingAssistantChain(llm);

      const stream =
        writingChain.streamEvents(
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
        "Writing assistant error:",
        error,
      );

      emitter.emit(
        "error",
        JSON.stringify({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Writing assistant failed",
        }),
      );
    }
  };

  void runAgent();

  return emitter;
};

export default handleWritingAssistant;