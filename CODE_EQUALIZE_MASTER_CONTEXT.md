# CODE EQUALIZE — MASTER CONTEXT

**Document status:** Source-of-truth project context for implementation  
**Created from:** Live repository audit (source code preferred over older docs)  
**Last updated:** 2026-11-13  
**Constraint:** Do not clear or reseeding-wipe the existing ChromaDB `code_errors` collection.

---

## 1. Project purpose and functionality

Code Equalize is a VS Code extension plus local Node.js backend that helps beginners understand programming errors in their preferred language.

**Core purpose**

- Detect programming problems in Java, Python, C, and C++.
- Explain each detected problem in a selected natural language.
- Provide one corrected version of the full source file.
- Teach one practical takeaway so the student avoids repeating the mistake.
- Use Retrieval-Augmented Generation (RAG) with ChromaDB as supporting knowledge, and Groq as the generation model.

**Intended user flow (desired final experience)**

1. User opens a supported source file and runs **Explain in My Language**, or a debugger-reported runtime exception is captured.
2. User selects an explanation language.
3. Extension extracts the full source and a cleaned list of distinct errors.
4. Backend returns:
   - one explanation per detected error,
   - one consolidated fix for the entire file,
   - one Remember section.
5. Side panel shows:
   - branding / status / language selector,
   - detected-errors summary table (informational only),
   - all explanations stacked vertically and visible automatically,
   - one locked consolidated fix unlocked after 15 seconds,
   - one Remember section.
6. Changing language regenerates explanations, consolidated fix, and Remember together.

---

## 2. Actual technology stack and architecture

### Confirmed stack (from source)

| Layer | Technology |
|---|---|
| Extension | VS Code Extension API, TypeScript |
| Extension UI | Webview HTML/CSS/JS embedded in `panelView.ts` |
| Backend | Node.js, Express |
| AI generation | Groq SDK, model `openai/gpt-oss-120b` |
| Vector DB | ChromaDB (`chromadb` npm client v3) |
| Embeddings | `@chroma-core/default-embed` (`DefaultEmbeddingFunction`) via Chroma collection path |
| Config | `dotenv` + `backend/config/config.js` |
| Communication | HTTP REST (`POST /explain`, planned `POST /explain-all`) |

### Ports / environment (actual)

```
PORT=3000
CHROMA_HOST=localhost
CHROMA_PORT=8001            # host port; Docker maps 8001 → container 8000
SIMILARITY_THRESHOLD=0.85   # L2 distance threshold (lower = closer)
TOP_K_RESULTS=3
GROQ_API_KEY=...
GEMINI_API_KEY=...          # present in config/.env.example but unused by active AI path
```

**ChromaDB networking (established):**

- Backend connects to `CHROMA_HOST=localhost` and `CHROMA_PORT=8001`.
- Docker publishes host port **8001** to the Chroma container port **8000**.
- Do not change this host/port pairing without inspecting the live environment and verifying connectivity first.

### Supported languages (actual code)

**Programming languages:** Java, Python, C, C++  
**Explanation languages:** English, Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, Urdu, Kannada, Odia, Malayalam

### High-level architecture

```
VS Code Extension                         Backend                         Data
─────────────────                         ───────                         ────
extension.ts                              server.js
  errorExtractor.ts                       routes/explain.js
  runtimeErrorService.ts                  services/ragService.js
  apiService.ts                             chromaService.js  ←→ ChromaDB
  panelView.ts (webview)                    aiService.js      ←→ Groq
                                            promptBuilder.js
                                          config/config.js
```

### Important reality vs older docs

Older `PRD.md` / `ARCHITECTURE.md` still mention OpenAI, nearby code snippets, Kannada/Hindi only, and Java/Python only. **Those docs are outdated.** This master context and the source code are authoritative.

`CODE_EQUALIZE_MASTER_CONTEXT.md` did not previously exist in the repository; this file establishes it.

---

## 3. Current extension implementation

### Entry points

- Command: `code-equalize.explain` (“Explain in My Language”)
- Runtime observer: Debug Adapter Protocol tracker for exception/signal stops
- Activation events include command + debug resolve hooks
- No `editor/context` menu contribution currently (command palette / bound command only)

### Error extraction (`extension/src/errorExtractor.ts`)

Current pipeline:

1. Collect VS Code diagnostics with severity `Error`
2. Run heuristic “runtime-risk” regex/pattern scans and label them `runtime`
3. Detect unmatched braces/brackets/parentheses
4. Deduplicate exact matches of `lineNumber|errorType|message`
5. Sort by line, then type
6. If nothing found, return a synthetic full-file analysis request with `errors: []`

### Runtime capture (`extension/src/runtimeErrorService.ts`)

- Observes DAP `stopped` events with reason `exception` or `signal`
- Reads top stack frame, exception info when available, and source text
- Deduplicates per debug session
- Calls extension flow as a single runtime error

### Explanation orchestration (`extension/src/extension.ts`)

- Asks for target language via QuickPick
- Builds a list of errors and calls backend **once per error** (`generateAllExplanations`, concurrency 2)
- Opens panel with `errorResults[]`
- Language change regenerates every individual result the same way

### Backend client (`extension/src/apiService.ts`)

- `POST http://127.0.0.1:3000/explain`
- Sends `{ error, code, language, targetLanguage, errorType }`
- Validates `{ explanation, fix, source }` and optional `remember`
- Retries temporary failures (timeout/429/5xx), 20s timeout

### Panel / webview (`extension/src/panelView.ts`)

Current UI composition:

- Header with logo/branding and status badges
- Language selector
- Detected Errors table with clickable rows
- Single “WHY THIS HAPPENED” section (selected error only)
- Single “HOW TO FIX IT” section with 15s unlock (selected error’s fix)
- Single “REMEMBER FOR NEXT TIME” section (selected error’s remember)

Messages:

- webview → host: `changeLanguage`, `debugRowClick`
- host → webview: `update`, `error`

---

## 4. Current backend implementation

### HTTP API

- `GET /health` → `{ status, service }`
- `POST /explain` → single-error explanation pipeline

`POST /explain` request (actual):

```json
{
  "error": "string",
  "code": "string",
  "language": "Java|Python|C|C++",
  "targetLanguage": "English|Hindi|...",
  "errorType": "diagnostic|runtime"   // accepted by extension, ignored by backend
}
```

Response (actual):

```json
{
  "explanation": "string",
  "fix": "string",
  "remember": "string|null",
  "source": "ChromaDB|AI",
  "matchedError": "string?",
  "distance": "number|null"
}
```

### RAG pipeline (`ragService.js`)

1. Search Chroma for similar error text filtered by programming language
2. Accept match only when distance ≤ `SIMILARITY_THRESHOLD` and metadata has explanation/fix
3. **Always** call Groq (`aiService.generateExplanation`)
4. If match accepted, pass retrieved explanation/fix as supporting context
5. If no accepted match, store the new AI result into Chroma
6. Return generated explanation/fix/remember with source label

### AI (`aiService.js` + `promptBuilder.js`)

- Builds a single-error tutor prompt
- Requires English section labels: `Explanation:`, `Fix:`, `Remember:`
- Writes explanatory content in `targetLanguage`
- Asks for a fix of the reported error, preferably complete source when safe
- Parses those three sections strictly

### Chroma (`chromaService.js`)

- Collection name: `code_errors`
- Search via `queryTexts` + language metadata filter
- Store document = error text; metadata includes `language`, `explanation`, `fix`, optional `remember`
- `clearCollection()` exists and is destructive; **must not be used during this implementation work**
- `embeddingService.js` exists but is unused by the live RAG path

### Database constraint (critical)

- Existing ChromaDB collection `code_errors` and stored records must be preserved.
- Previously established record count: **243 records**.
- Live count must be verified before and after implementation whenever Chroma is reachable.
- Implementation must **not** modify, delete, recreate, clear, or reseed the existing collection.
- Do **not** call `clearCollection()`, deleteCollection, destructive reseed, or collection recreate.
- **Pre-implementation verification (2026-11-13):** Docker container `code-equalize-chroma` is running with `0.0.0.0:8001->8000/tcp` as expected, and backend config resolves to `localhost:8001`. However, Chroma HTTP/API calls timed out (heartbeat and `getCount()`), so the live record count could **not** be confirmed before coding. Do not restart, recreate, or otherwise alter the container/collection without explicit approval. Re-attempt count verification after implementation if the service becomes responsive.

---

## 5. Confirmed problems from audit

1. **Per-error generation and per-error fixes**  
   Extension calls `/explain` once per error. Each response includes its own fix. There is no whole-file consolidated fix.

2. **UI requires error-row selection**  
   Explanations are stored in `errorResults`, but the webview shows only the selected error’s explanation/fix/remember.

3. **No automatic vertical explanation list**  
   Desired stacked explanations are not rendered.

4. **Multiple Remember sections conceptually**  
   Each error result has its own remember field; UI shows one at a time based on selection.

5. **15s countdown tied to selected-error fix**  
   Countdown resets when switching rows; not designed around one consolidated fix.

6. **Error classification is incorrect**  
   Static heuristic findings are labeled `runtime`, colliding with true DAP runtime errors.

7. **Speculative regex detections are noisy**  
   Patterns for null/None, parseInt, int/float/open, etc. create false positives.

8. **Cascade / duplicate diagnostics insufficiently handled**  
   Dedup is exact-message only; compiler cascades and related brace/diagnostic overlaps remain.

9. **Index mismatch risk in panel**  
   Table rows can be re-sorted independently from `errorResults`, so row index can map to the wrong explanation.

10. **`errorType` ignored by backend**  
    Extension sends it; route/RAG/prompt do not use it.

11. **Language-change edge bugs**  
    Failed regenerate can restore a stale original language from closure; toolbar language text may not refresh; selection jumps to “primary” result.

12. **RAG storage can pollute knowledge base**  
    Non-English generated text may be stored and later reused as supporting context.

13. **Source label can mislead**  
    `"ChromaDB"` still means Groq generated the answer using retrieved context.

14. **Docs / deps drift**  
    Unused Gemini dependency/config; outdated PRD/ARCHITECTURE claims; missing prior master context.

15. **Weak automated tests**  
    Extension test is a sample assert; backend has no real test suite for explain/RAG contracts.

---

## 6. Desired final user experience

### Detection and classification

Errors shown to the user must be classified as one of:

- **Diagnostic** — compiler / language-server / editor diagnostics (and carefully retained true syntax findings if kept)
- **Runtime** — debugger-reported exceptions/signals only
- **Potential** — only high-confidence static runtime risks if any remain after removing speculative regex noise; prefer omitting weak guesses

Duplicate and cascade errors must be reduced so the panel explains distinct problems, not every follow-on compiler complaint.

### Panel behavior

1. Detected Errors table remains as a summary, **not** a selection controller for content.
2. Below it, render **all explanations automatically in vertical order** (typically by line number).
3. Each explanation block includes the error identity (message, line, type) and its explanation text.
4. Then render **exactly one** “HOW TO FIX IT” section:
   - 15-second unlock countdown
   - one consolidated corrected source file
   - copy support
5. Then render **exactly one** “REMEMBER FOR NEXT TIME” section.
6. Language selector regenerates:
   - every explanation,
   - the consolidated fix,
   - the Remember section.
7. Preserve existing branding, logo assets, dark professional VS Code styling, section structure language, and overall layout language of the current panel. Do not redesign into a new visual system.

### Runtime path

Debugger-captured runtime errors should produce the same panel contract (explanations list may contain one item, still with one consolidated fix and one Remember).

---

## 7. Proposed architecture and API changes

### Architecture decision (finalized)

Adopt a **unified batch-generation backend endpoint**: `POST /explain-all`.

**Why this fits the current backend**

- Current backend is already a thin Express route over `ragService` + `aiService`.
- The hard product requirement is one consolidated fix and one Remember derived from the **full file and all errors together**.
- N× `/explain` cannot reliably produce one coherent whole-file fix; merging N independent full-file rewrites in the extension is fragile.
- A dedicated batch route keeps the existing single-error `/explain` intact for compatibility/debugging while the extension switches to the batch contract.

**Chosen generation strategy**

Inside `/explain-all`:

1. Validate programming language, target language, full source, and errors array.
2. Optionally retrieve Chroma context for each error (bounded concurrency), using current similarity rules.
3. Call Groq **once** with a batch prompt containing:
   - full source,
   - all detected errors (message, line, type),
   - optional retrieved supporting contexts,
   - strict output schema for multiple explanations + one fix + one remember.
4. Parse and validate the batch response.
5. Return one payload to the extension.
6. Chroma write policy for batch responses must protect the existing 243 records and avoid multilingual pollution:
   - **Do not clear the collection.**
   - Prefer **no automatic store** from batch responses initially, or store only carefully scoped English base entries if explicitly implemented later.
   - Never wipe/reseed as part of this feature work.

Increase completion budget as needed for multi-error responses; current single-error `MAX_COMPLETION_TOKENS = 4096` may be insufficient for larger batches.

### Proposed request contract

```json
POST /explain-all
{
  "code": "string",
  "language": "Java",
  "targetLanguage": "Hindi",
  "errors": [
    {
      "id": "stable-id",
      "error": "cannot find symbol",
      "lineNumber": 12,
      "errorType": "diagnostic"
    }
  ]
}
```

Notes:

- `lineNumber` remains 0-based to match current extension diagnostics indexing, unless both sides are changed together.
- `errorType` values: `diagnostic` | `runtime` | `potential`
- `id` should be stable across language regeneration (`line|type|normalizedMessage` or equivalent)

### Proposed response contract

```json
{
  "explanations": [
    {
      "id": "stable-id",
      "error": "cannot find symbol",
      "lineNumber": 12,
      "errorType": "diagnostic",
      "explanation": "...",
      "source": "AI",
      "matchedError": "optional",
      "distance": null
    }
  ],
  "fix": "```java\n...complete corrected file...\n```",
  "remember": "One practical takeaway...",
  "source": "AI"
}
```

### Extension orchestration after change

1. Extract and classify errors.
2. One `sendExplainAll(...)` call.
3. Render all explanations vertically.
4. Bind countdown exclusively to `fix`.
5. Bind Remember exclusively to `remember`.
6. Language change repeats the same single batch call and replaces all three content areas.

### Error-detection policy after change

- Keep VS Code Error diagnostics as primary.
- Keep DAP runtime capture as true runtime.
- Remove or severely disable speculative whole-file regex “possible exception” scanners.
- If brace/delimiter heuristics remain, ensure they do not duplicate diagnostics already reported by the compiler/language server.
- Add cascade-aware deduplication (for example collapse dependent diagnostics on the same region / keep root diagnostic where safe).

---

## 8. Important database, configuration, and integration constraints

1. **Preserve ChromaDB `code_errors` and all existing records.**  
   Previously established count: 243. Verify the live count before and after implementation when reachable.  
   Do not modify, delete, recreate, clear, or reseed the collection. No `clearCollection()`, deleteCollection, destructive reseed, or collection recreate for this work.  
   Backend must continue using `CHROMA_HOST=localhost` and `CHROMA_PORT=8001` unless live inspection proves a different working configuration.

2. **Do not invent a new vector DB or embedding provider** in this phase. Keep Chroma + default embedding function.

3. **Keep Groq as the active generator** unless a later approved change says otherwise.

4. **Backend URL remains local** (`127.0.0.1:3000`) unless configuration work is separately approved.

5. **Do not redesign branding/UI system.** Reuse existing logo/loader/icon media and current professional panel styling vocabulary.

6. **Do not modify application source until implementation is approved.**  
   Creating/updating this master context document is explicitly allowed as planning output.

7. **Full source remains the code context unit** for batch generation (already true in current requests).

8. **Supported language lists must stay aligned** between extension and `backend/config/config.js`.

9. **Avoid storing translated batch output into Chroma by default.** Protect retrieval quality of the existing knowledge base.

10. **Compiled extension output** (`extension/out`) must be rebuilt after TypeScript changes for runtime verification.

---

## 9. Complete testing requirements

### Functional

1. Single diagnostic error → one explanation card, one fix, one Remember.
2. Multiple diagnostic errors → all explanation cards appear automatically in vertical order without clicking rows.
3. Table remains visible/summary-only; clicking rows must not be required and must not gate content.
4. Consolidated fix unlocks only after 15 seconds and shows one corrected full file.
5. Remember appears once.
6. Language switch regenerates explanations + fix + Remember together.
7. Failed language regenerate restores previous language and previous content safely.
8. DAP runtime exception path still works and is labeled runtime.
9. Speculative regex noise no longer floods the panel.
10. Duplicate/cascade compiler findings are reduced.

### Integration

11. Backend `/health` OK.
12. `/explain-all` validation rejects bad language/body.
13. Chroma down → generation still succeeds via AI fallback path.
14. Chroma up → retrieval may enrich context without destroying collection.
15. Confirm collection count remains 243 before and after smoke tests.

### Regression

16. Java/Python/C/C++ still accepted.
17. Unsupported languages still rejected.
18. Empty/unsupported editor still handled gracefully.
19. Existing branding/layout still recognizable.
20. Old `/explain` remains functional if kept for compatibility.
21. No accidental dependency on cleared DB state.

### Verification commands / checks

- Extension: `npm run compile`, load Extension Development Host, run explain command
- Backend: `npm start`, hit `/health` and `/explain-all`
- Chroma: count records before/after (`getCount()`), ensure unchanged
- Manual language regeneration and countdown timing checks

---

## 10. Definition of completion

This phase is complete only when all of the following are true:

1. `CODE_EQUALIZE_MASTER_CONTEXT.md` exists and matches implemented behavior.
2. Extension sends one batch request for a file’s detected errors.
3. Backend `/explain-all` returns all explanations, one consolidated fix, and one Remember.
4. Webview displays all explanations vertically with no selection requirement.
5. Exactly one fix section exists and is gated by the 15-second countdown.
6. Exactly one Remember section exists.
7. Language changes regenerate all explanations, the consolidated fix, and Remember.
8. Error classification distinguishes diagnostic, runtime, and potential (if potential remains).
9. Speculative regex detections and obvious cascade duplicates are removed or substantially reduced.
10. Existing branding/look is preserved.
11. ChromaDB collection still contains the preserved records (243) with no wipe.
12. Manual test plan above has been executed for the critical paths.
13. No unresolved contract mismatch remains between extension `apiService` and backend response shape.

---

## 11. Finalized implementation architecture summary

```
extractError / runtime observer
  → classify + dedupe errors
  → POST /explain-all { code, language, targetLanguage, errors[] }
       → chroma search per error (optional context)
       → one Groq batch generation
       → { explanations[], fix, remember, source }
  → panelView renders:
       Detected Errors table (summary)
       vertical explanation sections (all)
       one countdown-locked consolidated fix
       one Remember section
  → language change repeats /explain-all and replaces all content
```

### Exact files expected to change during implementation

**Extension**

- `extension/src/errorExtractor.ts`
- `extension/src/extension.ts`
- `extension/src/apiService.ts`
- `extension/src/panelView.ts`
- `extension/src/runtimeErrorService.ts` (only if classification/UX contract needs alignment)
- `extension/package.json` (optional context-menu contribution; only if approved as in-scope)

**Backend**

- `backend/server.js` (mount/register if route split requires it)
- `backend/routes/explain.js` and/or new `backend/routes/explainAll.js`
- `backend/services/ragService.js`
- `backend/services/aiService.js`
- `backend/utils/promptBuilder.js`
- `backend/config/config.js` (batch limits / cleanup of unused values only if needed)

**Docs**

- `CODE_EQUALIZE_MASTER_CONTEXT.md` (this file; update after implementation if behavior drifts)
- Optionally align `ARCHITECTURE.md` later; not required to ship the feature

**Must not change for this feature**

- Chroma data directories / collection contents
- Seed wipe behavior
- Brand media assets’ design identity (`extension/media/*` may remain referenced as-is)

---

## 12. Implementation order (for the approved build phase)

1. Backend contracts: prompt + parser + `ragService.processAllErrors` + `POST /explain-all`
2. Extension API client: `sendExplainAll` types and call
3. Extension extraction/classification cleanup and stable error IDs
4. Extension orchestration: replace N× `/explain` with one batch call; language regenerate uses batch
5. Webview: vertical explanations, single fix countdown, single Remember; remove selection-gated content
6. Compile, manual end-to-end tests, Chroma count verification
7. Update this master context if any approved deviation occurs

---

## 13. Potential regressions and test focus

| Risk | Mitigation / test |
|---|---|
| Large multi-error responses truncated | Raise token limit; test with 5+ errors; validate parser failure messaging |
| Model omits an error explanation | Require one explanation per input id; fail or mark missing explicitly |
| Consolidated fix alters unrelated code | Prompt for minimal corrections; manually compare before/after |
| Language regenerate loses content on failure | Keep previous panel data until success; verify stale-language bug fixed |
| Chroma writes pollute DB | Default: no batch store; verify count remains 243 |
| Runtime path breaks | Debug Java/Python exception smoke test |
| UI redesign drift | Side-by-side check against current branding/spacing/section titles |
| Old single-error callers break | Keep `/explain` working if retained |

---

**End of master context.**  
Implementation of application source changes requires explicit approval after this plan is accepted.
