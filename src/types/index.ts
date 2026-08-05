import "dotenv/config";

import express from "express";
import cors from "cors";

const app = express();

const port = Number(
  process.env.PORT ?? 3000,
);

app.use(cors());
app.use(express.json());

app.get("/", (_request, response) => {
  response.json({
    success: true,
    data: {
      message:
        "Perplexity Clone Agents API is running",
    },
  });
});

app.listen(port, () => {
  console.log(
    `Server running at http://localhost:${port}`,
  );
});