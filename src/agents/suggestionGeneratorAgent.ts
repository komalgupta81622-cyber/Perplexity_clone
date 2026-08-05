import type { BaseMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import {
  RunnableMap,
  RunnableSequence,
} from "@langchain/core/runnables";

import { PromptTemplate } from "@langchain/core/prompts";

import formatChatHistoryAsString from "../utils/formatHistory";
import ListLineOutputParser from "../parsers/listLineOutputParser";

const suggestionGeneratorPrompt = `
You are FutureSearch, an AI follow-up suggestion generator.

Based on the conversation below, generate 4 to 5 relevant follow-up questions
that the user may want to ask next.

Instructions:

- Suggestions must be directly related to the conversation.
- Each suggestion should be a useful, medium-length question.
- Do not repeat questions already asked in the conversation.
- Do not generate unrelated or overly broad questions.
- Keep each suggestion on a separate line.
- Wrap all suggestions inside the following XML tags:

<suggestions>
First follow-up question
Second follow-up question
Third follow-up question
Fourth follow-up question
</suggestions>

Return only the XML block. Do not include explanations.

Conversation:
{chat_history}
`;

type SuggestionGeneratorInput = {
  chat_history: BaseMessage[];
};

const outputParser = new ListLineOutputParser({
  key: "suggestions",
});

const createSuggestionGeneratorChain = (
  llm: BaseChatModel,
) => {
  return RunnableSequence.from([
    RunnableMap.from({
      chat_history: (
        input: SuggestionGeneratorInput,
      ) =>
        formatChatHistoryAsString(
          input.chat_history,
        ),
    }),

    PromptTemplate.fromTemplate(
      suggestionGeneratorPrompt,
    ),

    llm,

    outputParser,
  ]);
};
const generateSuggestions = async (
  input: SuggestionGeneratorInput,
  llm: BaseChatModel,
): Promise<string[]> => {
  // Assignment ke according consistent suggestions ke liye
  // invoke se pehle temperature zero karna hai.
  (
    llm as BaseChatModel & {
      temperature?: number;
    }
  ).temperature = 0;

  const chain =
    createSuggestionGeneratorChain(llm);

  return chain.invoke(input);
};

export default generateSuggestions;