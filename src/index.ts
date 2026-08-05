import "dotenv/config";

import express from "express";
import cors from "cors";

import academicRouter from "./routes/academicRoute";
import redditRouter from "./routes/redditRoute";
import webRouter from "./routes/webRoute";
import youtubeRouter from "./routes/youtubeRoute";
import imageRouter from "./routes/imageRoute";
import videoRouter from "./routes/videoRoute";
import writingRouter from "./routes/writingRoute";
import suggestionRouter from "./routes/suggestionRoute";

const app = express();

const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

app.get("/", (_request, response) => {
  response.json({
    success: true,
    message: "Perplexity Clone API Running",
  });
});

// Routes
app.use("/api", academicRouter);
app.use("/api", redditRouter);
app.use("/api", webRouter);
app.use("/api", youtubeRouter);
app.use("/api", imageRouter);
app.use("/api", videoRouter);
app.use("/api", writingRouter);
app.use("/api", suggestionRouter);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});