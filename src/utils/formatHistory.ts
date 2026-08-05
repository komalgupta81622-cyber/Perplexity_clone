import type { BaseMessage } from "@langchain/core/messages";

const formatChatHistoryAsString = (
  history: BaseMessage[] = [],
): string => {
  if (history.length === 0) {
    return "";
  }

  return history
    .map((message) => {
      const role = message.getType();
      const content =
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content);

      return `${role}: ${content}`;
    })
    .join("\n");
};

export default formatChatHistoryAsString;