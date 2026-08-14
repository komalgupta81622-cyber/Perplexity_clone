Perplexity Clone

A Node.js + TypeScript backend for a Perplexity-style AI search application. It supports AI-powered search, YouTube search, academic search, web search, Reddit search, image search, and AI-generated responses.

🚀 Features
🔎 Web Search
▶️ YouTube Search
📚 Academic Search
📰 Reddit Search
🖼️ Image Search
✍️ AI Writing Assistant
🤖 LLM-powered responses
📚 RAG-style document retrieval and reranking
🔄 Streaming responses using Server-Sent Events (SSE)
🔌 SearXNG integration
🧠 LangChain integration
📦 Embeddings-based similarity search
🛠️ Tech Stack
Node.js
TypeScript
Express.js
LangChain
SearXNG
Axios
LLM API
Embeddings
Server-Sent Events (SSE)

backend/
├── src/
│   ├── agents/
│   │   ├── academicSearchAgent.ts
│   │   ├── imageSearchAgent.ts
│   │   ├── redditSearchAgent.ts
│   │   ├── suggestionGeneratorAgent.ts
│   │   ├── videoSearchAgent.ts
│   │   ├── webSearchAgent.ts
│   │   ├── writingAssistantAgent.ts
│   │   └── youtubeSearchAgent.ts
│   │
│   ├── config/
│   │   └── models.ts
│   │
│   ├── routes/
│   │   ├── academicRoute.ts
│   │   ├── imageRoute.ts
│   │   ├── redditRoute.ts
│   │   ├── suggestionRoute.ts
│   │   ├── videoRoute.ts
│   │   ├── webRoute.ts
│   │   ├── writingRoute.ts
│   │   └── youtubeRoute.ts
│   │
│   ├── services/
│   │   └── searchSearxng.ts
│   │
│   ├── utils/
│   │   ├── computeSimilarity.ts
│   │   ├── formatHistory.ts
│   │   └── handleStream.ts
│   │
│   └── index.ts
│
├── .env
├── package.json
├── tsconfig.json
└── README.md
⚙️ Installation

Clone the repository:

git clone https://github.com/komalgupta81622-cyber/Perplexity_clone.git

Go to the backend folder:

cd Perplexity_clone/backend

Install dependencies:

npm install
🔐 Environment Variables

Create a .env file inside the backend folder.

Example:

PORT=3000


SEARXNG_API_URL=http://localhost:8080


GROQ_API_KEY=your_groq_api_key

Add any other API keys required by your models.ts configuration.

Important: Never push your .env file or API keys to GitHub.

Add this to .gitignore:

.env
node_modules
dist
🔎 SearXNG Setup

The backend uses SearXNG for search results.

with parameters such as:

q
format=json
language
engines
▶️ Run Backend

Start the development server:

npm run dev

The backend will run on:

http://localhost:3000
🔗 API Endpoints
Endpoint	Method	Purpose
/api/web	POST	Web search
/api/youtube	POST	YouTube search
/api/video	POST	Video search
/api/academic	POST	Academic search
/api/reddit	POST	Reddit search
/api/image	POST	Image search
/api/writing	POST	AI writing assistant
/api/suggestion	POST	Generate suggestions
Example: YouTube Search

Request body:

{
  "query": "React tutorial for beginners",
  "history": []
}

The API returns results using Server-Sent Events (SSE).

🧠 Search Flow
User Query
    ↓
Express Route
    ↓
Search Agent
    ↓
LLM Query Rewriting
    ↓
SearXNG
    ↓
Search Results
    ↓
Embeddings
    ↓
Similarity / Reranking
    ↓
Relevant Documents
    ↓
LLM
    ↓
Streaming Response
📡 Streaming

The backend uses Server-Sent Events (SSE) to stream AI responses to the frontend.

Response format:

data: {...}


event: end
data: {"success":true}
🎯 Project Objective

The main objective of this project is to build a Perplexity-inspired AI search backend that combines web search, LLMs, embeddings, and multiple specialized search agents to provide relevant and summarized answers.

👩‍💻 Author

Komal Gupta

B.Tech Computer Science Engineering
O.P. Jindal University
