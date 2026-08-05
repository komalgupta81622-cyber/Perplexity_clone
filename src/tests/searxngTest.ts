import "dotenv/config";

import { searchSearxng } from "../services/searchSearxng";

const testSearxng = async (): Promise<void> => {
  try {
    console.log("Testing SearXNG...");

    const result = await searchSearxng(
      "artificial intelligence",
      {
        language: "en",
        engines: ["arxiv"],
      },
    );

    console.log("Results found:", result.results.length);
    console.log(result.results.slice(0, 2));
  } catch (error) {
    console.error("FULL SEARXNG ERROR:");

    console.dir(error, {
      depth: null,
    });
  }
};

void testSearxng();