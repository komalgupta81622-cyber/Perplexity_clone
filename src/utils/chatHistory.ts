export const formatChatHistoryAsString = (
  history: any[]
): string => {
  if (!history || history.length === 0) return "";

  return history
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n");
};