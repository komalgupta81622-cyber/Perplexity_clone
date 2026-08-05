import type { EventEmitter } from "node:events";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof AggregateError) {
    const nestedMessages = error.errors
      .map((nestedError: unknown) => {
        if (nestedError instanceof Error) {
          return nestedError.message || nestedError.name;
        }

        if (typeof nestedError === "string") {
          return nestedError;
        }

        try {
          return JSON.stringify(nestedError);
        } catch {
          return "Unknown nested error";
        }
      })
      .filter((message: string) => message.length > 0);

    if (nestedMessages.length > 0) {
      return nestedMessages.join(" | ");
    }

    return error.message || "Aggregate error occurred";
  }

  if (error instanceof Error) {
    return error.message || error.name;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Streaming failed";
  }
};

export const handleStream = async (
  stream: AsyncIterable<unknown>,
  emitter: EventEmitter,
): Promise<void> => {
  try {
    for await (const rawEvent of stream) {
      const event = rawEvent as {
        event?: string;
        name?: string;
        data?: {
          output?: unknown;
          chunk?: unknown;
        };
      };

      if (
        event.event === "on_chain_end" &&
        event.name === "FinalSourceRetriever"
      ) {
        emitter.emit(
          "data",
          JSON.stringify({
            type: "sources",
            data: event.data?.output ?? [],
          }),
        );
      }

      if (
        event.event === "on_chain_stream" &&
        event.name === "FinalResponseGenerator"
      ) {
        emitter.emit(
          "data",
          JSON.stringify({
            type: "response",
            data: event.data?.chunk ?? "",
          }),
        );
      }

      if (
        event.event === "on_chain_end" &&
        event.name === "FinalResponseGenerator"
      ) {
        emitter.emit("end");
      }
    }
  } catch (error) {
    console.error("FULL STREAM ERROR:");

    console.dir(error, {
      depth: null,
    });

    emitter.emit(
      "error",
      JSON.stringify({
        success: false,
        error: getErrorMessage(error),
      }),
    );
  }
};