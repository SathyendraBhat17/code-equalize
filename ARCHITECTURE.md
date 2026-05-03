# ARCHITECTURE — Code Equalize

**Version:** 1.2 (Final - Phase 1)

---

## 1. Folder Structure

```
code-equalize/
├── .cursorrules
├── PRD.md
├── ARCHITECTURE.md
├── backend/
│   ├── server.js
│   ├── routes/
│   │   └── explain.js
│   ├── services/
│   │   ├── chromaService.js
│   │   ├── embeddingService.js
│   │   ├── aiService.js
│   │   └── ragService.js
│   ├── utils/
│   │   └── promptBuilder.js
│   ├── seed/
│   │   └── seedErrors.js
│   ├── config/
│   │   └── config.js
│   ├── .env
│   └── package.json
├── extension/
│   ├── src/
│   │   ├── extension.ts
│   │   ├── errorExtractor.ts
│   │   ├── apiService.ts
│   │   └── panelView.ts
│   ├── package.json
│   └── tsconfig.json
└── chromadb/
    └── start.py
```

---

## 2. System Overview

Code Equalize follows a three-layer architecture:

* **Extension Layer (VS Code)** → captures errors and displays results
* **Backend Layer (Node.js)** → processes RAG logic
* **Data Layer (ChromaDB)** → stores and retrieves semantic knowledge

---

## 3. Component Responsibilities

### Backend

| File                         | Purpose                              |
| ---------------------------- | ------------------------------------ |
| server.js                    | Starts Express server                |
| routes/explain.js            | Handles POST `/explain`              |
| services/embeddingService.js | Converts text → embeddings           |
| services/chromaService.js    | Performs similarity search & storage |
| services/aiService.js        | Calls AI model                       |
| services/ragService.js       | Core RAG pipeline logic              |
| utils/promptBuilder.js       | Builds structured prompts            |
| seed/seedErrors.js           | Seeds initial dataset                |
| config/config.js             | Stores config values                 |

---

### Extension

| File              | Purpose                      |
| ----------------- | ---------------------------- |
| extension.ts      | Registers commands           |
| errorExtractor.ts | Extracts error + nearby code |
| apiService.ts     | Sends request to backend     |
| panelView.ts      | Displays side panel UI       |

---

### Data Layer

* ChromaDB stores embeddings and metadata for semantic retrieval

---

## 4. API Contract

### POST `/explain`

**URL:**
http://localhost:3000/explain

**Request:**

```json
{
  "error": "ArrayIndexOutOfBoundsException",
  "code": "int[] arr = new int[5]; arr[10] = 100;",
  "language": "Java",
  "targetLanguage": "Kannada"
}
```

**Response:**

```json
{
  "explanation": "...",
  "fix": "...",
  "source": "ChromaDB"
}
```

---

## 5. Data Flow

```
User triggers command in VS Code
        ↓
Extension extracts:
  - error message
  - code snippet (limited context)
  - language
  - target language
        ↓
POST request → backend
        ↓
ragService.js:
  → embeddingService generates embedding
  → chromaService searches similar errors
  → if similarity is sufficiently high:
         return stored explanation
     else:
         call AI service
         optionally store result
        ↓
If needed:
  → AI translates explanation to target language
        ↓
Response returned to extension
        ↓
panelView displays:
  - explanation
  - fix
  - source indicator
```

---

## 6. ChromaDB Schema

**Collection:** `code_errors`

Each entry:

```json
{
  "id": "uuid",
  "document": "error text",
  "metadata": {
    "language": "Java",
    "explanation": "Base explanation in English",
    "fix": "Suggested fix",
    "timestamp": "..."
  }
}
```

---

## 7. RAG Logic (Core)

1. Receive error + code snippet
2. Generate embedding
3. Perform semantic search in ChromaDB
4. If similarity is above configurable threshold:

   * use retrieved explanation
5. Else:

   * call AI model
6. Optionally store new result
7. Translate explanation if needed
8. Return final response

---

## 8. Error Handling Strategy

* If DB fails → fallback to AI
* If AI fails → return basic fallback message
* If both fail → notify user gracefully

---

## 9. Environment Variables

```
OPENAI_API_KEY=your_key_here
CHROMA_HOST=localhost
CHROMA_PORT=8000
PORT=3000
```

---

## 10. Build Order

1. Backend skeleton (server + route)
2. Mock RAG pipeline
3. AI integration
4. ChromaDB integration
5. Seed initial data
6. Extension development
7. Connect extension to backend
8. End-to-end testing

---

## 11. Ports

| Service  | Port |
| -------- | ---- |
| Backend  | 3000 |
| ChromaDB | 8000 |

---

## 12. Design Decisions

* Context limited to nearby code for simplicity
* Base explanations stored in English
* Native language explanations generated dynamically
* Hybrid system (retrieval + AI) for efficiency
* Avoid duplicate multilingual storage

---

## 13. Future Improvements

* Multi-file context understanding
* Additional programming languages
* Improved similarity ranking
* Offline caching for frequent errors

---
