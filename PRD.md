# PRD — Code Equalize

**Version:** 1.1 (Phase 1 - Refined)
**Presentation Date:** May 5, 2026
**Team:** Sathya + 1 member

---

## 1. Problem Statement

When developers, especially students, encounter programming errors, the explanations available online are often in English and can be abstract or difficult to interpret.
Non-native English speakers struggle to understand both the cause of the error and how to fix it efficiently.

---

## 2. Solution

Code Equalize is a VS Code extension that provides clear, contextual explanations of programming errors in the user’s native language (Kannada or Hindi), along with suggested fixes.

The system uses a Retrieval-Augmented Generation (RAG) approach:

* First retrieves similar known errors from a local knowledge base
* Falls back to an AI model when no suitable match is found

Programming keywords are preserved in English to maintain technical accuracy.

---

## 3. Goals for Phase 1 (May 5)

* Working VS Code extension for Java and Python
* User can right-click an error → "Explain in My Language"
* Backend processes error using RAG pipeline
* ChromaDB used for semantic retrieval of known errors
* AI fallback using OpenAI GPT-4o-mini
* Explanation displayed in VS Code side panel
* Output available in Kannada or Hindi
* Limited dataset used to demonstrate retrieval capability

---

## 4. Supported Languages

### Programming Languages

* Java
* Python

### Explanation Languages

* Kannada
* Hindi

---

## 5. Tech Stack

* **Extension:** VS Code Extension API (TypeScript)
* **Backend:** Node.js + Express
* **Vector Database:** ChromaDB (local instance)
* **Embeddings:** OpenAI text-embedding-3-small
* **AI Model:** OpenAI GPT-4o-mini
* **Communication:** REST API (HTTP)

---

## 6. Core Features (Phase 1)

### F1 — Error Detection

The extension reads error diagnostics from VS Code when the user triggers the command via right-click.

---

### F2 — Data Extraction

The extension collects:

* Error message
* Code snippet (limited to nearby lines for context)
* Programming language
* Target explanation language

---

### F3 — RAG Pipeline (Backend)

* Convert error message into embedding
* Perform semantic similarity search in ChromaDB
* If similarity is sufficiently high (threshold-based):

  * Retrieve stored explanation and fix
* Otherwise:

  * Fallback to AI model for generation

---

### F4 — AI Explanation Generation

The AI model receives:

* Error message
* Code snippet
* Target language

Returns:

* Simple explanation in native language
* Suggested fix steps

Technical keywords remain in English.

---

### F5 — Knowledge Storage

AI-generated responses may be optionally stored in the database after validation to improve future retrieval and reduce repeated API calls.

---

### F6 — Result Display

A side panel in VS Code displays:

* Error name
* Explanation (Kannada/Hindi)
* Fix suggestion
* Source indicator:

  * "ChromaDB" (retrieved)
  * "AI" (generated)

---

## 7. Out of Scope for Phase 1

* Support for additional programming languages (C/C++, JavaScript)
* Full project-level context understanding
* Cloud deployment (runs locally only)
* User authentication
* Web or mobile interface

---

## 8. Success Criteria

* [ ] Extension activates successfully
* [ ] Right-click command works on Java errors
* [ ] Right-click command works on Python errors
* [ ] Backend receives and processes requests
* [ ] ChromaDB retrieves relevant results
* [ ] AI generates correct explanations in Kannada
* [ ] AI generates correct explanations in Hindi
* [ ] End-to-end flow works during live demo

---

## 9. Known Risks

* Initial setup complexity of ChromaDB
* API usage costs during testing
* Learning curve for VS Code Extension API

---

## 10. Future Scope

* Support for more programming languages
* Improved context understanding across files
* Smarter ranking of retrieved results
* Offline caching for frequently occurring errors
* UI improvements and user customization
