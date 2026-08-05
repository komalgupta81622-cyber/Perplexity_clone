import axios from "axios";

export type SearxngResult = {
  title: string;
  url: string;
  content: string;
  img_src?: string;
  thumbnail?: string;
  iframe_src?: string;
  length?: string;
  engine?: string;
};

export type SearxngOptions = {
  language?: string;
  categories?: string[];
  engines?: string[];
};

type SearxngApiResponse = {
  results?: Array<Partial<SearxngResult>>;
};

export const searchSearxng = async (
  query: string,
  options: SearxngOptions = {},
): Promise<{ results: SearxngResult[] }> => {
  const baseUrl =
    process.env.SEARXNG_API_URL ?? "http://localhost:8080";

  const response = await axios.get<SearxngApiResponse>(
    `${baseUrl.replace(/\/$/, "")}/search`,
    {
      params: {
        q: query,
        format: "json",
        language: options.language ?? "en",

        ...(options.categories?.length
          ? {
              categories: options.categories.join(","),
            }
          : {}),

        ...(options.engines?.length
          ? {
              engines: options.engines.join(","),
            }
          : {}),
      },

      timeout: 20000,
    },
  );

  const results = (response.data.results ?? [])
    .filter(
      (result) =>
        typeof result.title === "string" &&
        typeof result.url === "string",
    )
    .map((result) => ({
      title: result.title ?? "",
      url: result.url ?? "",
      content: result.content ?? "",

      ...(result.img_src
        ? { img_src: result.img_src }
        : {}),

      ...(result.thumbnail
        ? { thumbnail: result.thumbnail }
        : {}),

      ...(result.iframe_src
        ? { iframe_src: result.iframe_src }
        : {}),

      ...(result.length
        ? { length: result.length }
        : {}),

      ...(result.engine
        ? { engine: result.engine }
        : {}),
    }));

  return { results };
};