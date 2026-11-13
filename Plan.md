# CODE EQUALIZE
# Master Implementation, Repair & Verification Plan

**Project:** Code Equalize — VS Code Extension  
**Repository:** `F:\CODE-EQUALIZE`  
**Extension:** `F:\CODE-EQUALIZE\extension`  
**Backend:** `F:\CODE-EQUALIZE\backend`  
**Purpose:** Complete project audit, coordinated implementation, integration, and final verification.

---

# 1. PROJECT OBJECTIVE

Code Equalize is a VS Code extension designed to help programmers understand and correct errors in their source code.

The extension should:

1. Detect meaningful programming errors in the currently active source file.
2. Identify the actual underlying mistakes rather than simply displaying compiler diagnostics.
3. Detect potential runtime problems through whole-source AI analysis, even when the user has not executed the program.
4. Explain every identified issue in a beginner-friendly manner.
5. Generate one complete corrected version of the source file.
6. Explain what was corrected.
7. Summarise the important lessons the programmer should remember.

The ultimate goal is to make Code Equalize a reliable programming-error explanation and correction assistant.

**IMPORTANT:** This is an existing project. The task is to inspect, diagnose, repair, and integrate the existing implementation. It is NOT an instruction to rebuild the entire project from scratch.

Claude Code must understand the existing implementation before making changes.

---

# 2. NON-NEGOTIABLE IMPLEMENTATION RULES

These rules must be followed throughout the entire task.

### 2.1 Inspect before editing

Before modifying anything:

- Inspect the complete repository structure.
- Inspect the extension and backend independently.
- Read the existing implementation files.
- Understand how the extension communicates with the backend.
- Understand the complete request-response lifecycle.
- Inspect the existing webview and panel architecture.
- Inspect existing tests and package scripts.
- Inspect the current Git status and existing modifications.

Do not assume that historical descriptions of the project perfectly match the current code. Verify everything against the actual repository.

### 2.2 Preserve existing architecture

Do not unnecessarily replace:

- TypeScript.
- VS Code Extension API.
- Node.js.
- Express.
- Groq.
- ChromaDB.
- The existing RAG architecture.
- Existing API endpoints.
- Existing request sequencing and session protections.
- Existing clipboard functionality.
- Existing debugger integration.

Preserve working features unless a demonstrated defect requires changing them.

### 2.3 Avoid random patching

The project has already undergone multiple implementation and testing rounds.

The purpose of this task is to prevent another endless cycle of small speculative modifications.

Claude Code should:

1. Inspect the entire project.
2. Identify root causes.
3. Understand how the affected components interact.
4. Develop a coordinated implementation plan.
5. Implement related corrections together.
6. Test the complete workflow.
7. Perform one final review.

Aim for one comprehensive implementation pass. A second pass is acceptable only for focused issues discovered during verification.

Do not repeatedly modify individual files without understanding the wider impact.

### 2.4 Protect existing data and secrets

**CRITICAL: ChromaDB DATA MUST BE PRESERVED.**

- Existing collection name: `code_errors`.
- Last known record count: 249.
- Never clear the collection.
- Never delete the collection.
- Never recreate or reseed the collection.
- Never overwrite existing records as a shortcut.
- Do not execute destructive database operations.

Also:

- Never request or expose `.env` secrets.
- Never commit API keys.
- Do not unnecessarily log full source code or sensitive configuration.
- Do not silently execute arbitrary user programs.

### 2.5 Do not modify original source files automatically

The user wants a corrected source-code display and a Copy button.

Do not introduce automatic application of AI-generated corrections to the original file.

The user will decide whether to copy the corrected code.

---

# 3. EXISTING PROJECT ARCHITECTURE

Preserve the existing architecture and verify its actual implementation.

## 3.1 Extension

The project uses:

- TypeScript.
- VS Code Extension API.
- Webview-based interface.
- Diagnostic collection and error extraction.
- Existing runtime/debug adapter integration.
- Existing API communication service.
- Existing panel messaging and session validation.

The current interface already contains:

- Code Equalize logo.
- Tagline/motto.
- Language selector.
- Detected errors table.
- Explanation section.
- Fix countdown.
- Corrected source-code display.
- Remember section.
- Copy interactions.
- Footer and copyright.

These existing elements should be preserved.

## 3.2 Backend

The backend uses:

- Node.js.
- Express.
- Groq AI.
- ChromaDB.
- Retrieval-Augmented Generation (RAG).

Existing configuration has included:

| Setting | Existing value |
|---|---|
| Backend port | 3000 |
| ChromaDB host port | 8001 |
| ChromaDB container port | 8000 |
| Collection | `code_errors` |
| Similarity threshold | 0.85 |
| Top-K results | 3 |
| Groq model | `openai/gpt-oss-120b` |

Verify these values against the current repository before changing anything.

## 3.3 Existing API endpoints

Preserve:

- `GET /health`
- `POST /explain`
- `POST /explain/all`

The batch endpoint is `/explain/all`.

Do not invent or substitute `/explain-all`.

## 3.4 Important backend files to inspect

Verify the current usage and responsibility of:

- `backend/server.js`
- `backend/config/config.js`
- `backend/routes/explain.js`
- `backend/routes/explainAll.js`, if present
- `backend/services/chromaService.js`
- `backend/services/embeddingService.js`, if present
- `backend/services/ragService.js`
- `backend/services/aiService.js`
- `backend/utils/promptBuilder.js`

Do not delete apparently unused files without first checking their references and intended purpose.

---

# 4. COMPLETE USER WORKFLOW

The intended workflow is:

1. User opens a source file in VS Code.
2. User manually invokes Code Equalize.
3. Code Equalize analyses only the currently active file.
4. The extension collects the actual editor diagnostics and complete source code.
5. Groq analyses the complete source to identify additional meaningful problems and potential runtime risks.
6. ChromaDB provides relevant supporting knowledge.
7. Groq generates one coordinated batch response.
8. The panel displays the detected errors in ascending line-number order.
9. The panel displays a unified WHY THIS HAPPENED section.
10. A 15-second animated countdown begins.
11. The corrected source code becomes available when the countdown finishes or the user chooses early reveal.
12. The panel displays WHAT WAS FIXED.
13. The panel displays one consolidated REMEMBER section.
14. The user can copy the corrected code.
15. The user can switch explanation languages or re-analyse the file.
16. Each analysed file retains its own panel and state.

The experience should be straightforward, reliable, and beginner-friendly.

---

# 5. MANUAL INVOCATION AND ACTIVE-FILE ANALYSIS

The user must be able to initiate analysis manually.

Provide both invocation methods:

### Command Palette

`Code Equalize: Explain in My Language`

### Editor right-click menu

`Explain with Code Equalize`

A configurable keyboard shortcut is welcome if it can be added without conflicts.

Do not introduce forced automatic popups.

Do not analyse every open editor or every workspace file.

## Active-file requirements

- Analyse only the currently active file.
- Use the latest in-memory document content, including unsaved edits.
- Identify the programming language from the active document.
- Do not accidentally reuse source code from another file.
- Handle no-active-editor cases gracefully.
- Handle unsupported file types gracefully.
- Handle untitled documents appropriately.

The active file must always be the source of truth for the current analysis.

---

# 6. MULTIPLE PANELS AND FILE-SPECIFIC STATE

This is an important requirement.

The current implementation must support separate panels for separate analysed files.

For example:

1. User analyses `Test.c`.
2. A Code Equalize panel opens for `Test.c`.
3. User analyses `Test.cpp`.
4. A separate panel opens for `Test.cpp`.
5. The original `Test.c` panel remains intact.

The second file must not overwrite the first file's panel.

## Panel reuse

If the user opens an already analysed file again:

- Reuse its existing Code Equalize panel.
- Focus that panel where appropriate.
- Do not create duplicate panels for the same file.
- If the user re-analyses the file, refresh its existing results.

## File identity

Use a stable document URI/path as the panel identity.

Do not identify files using only their filename because different folders may contain files with identical names.

## Independent state

Each file must maintain its own:

- Filename.
- Detected issues.
- Explanation results.
- Selected explanation language.
- Corrected source.
- WHAT WAS FIXED content.
- REMEMBER content.
- Loading state.
- Error state.
- Request identity.

Responses belonging to an older request must never overwrite a newer analysis.

---

# 7. ERROR DETECTION AND ERROR TABLE

The error table is a central part of Code Equalize.

The table must contain exactly four columns:

| # | Line | Error Type | Description |
|---|---|---|---|
| 1 | 5 | Syntax Error | Explains why this error occurs. |
| 2 | 12 | Division by Zero | Explains why this error occurs. |
| 3 | 18 | Undefined Variable | Explains why this error occurs. |

### Column requirements

**1. #**

Sequential numbering:

1, 2, 3, 4...

**2. Line**

The actual source-code line number.

Never invent or inaccurately shift line numbers.

**3. Error Type**

Display the actual, understandable type of issue.

Examples:

- Syntax Error.
- Undefined Variable.
- Null Pointer Exception.
- Array Index Out of Bounds.
- Division by Zero.
- Missing Parenthesis.
- Type Error.
- Invalid Operation.

Use language-appropriate terminology.

**4. Description**

A short, clear description explaining why the error occurs.

### No Severity column

Do not add:

- Critical.
- High.
- Medium.
- Low.
- Warning severity badges.

The table must remain exactly four columns.

### Sorting

Sort issues in ascending line-number order.

For multiple distinct issues on the same line, use a deterministic ordering.

---

# 8. ROOT-CAUSE DETECTION AND DUPLICATE DIAGNOSTICS

The system must identify actual underlying mistakes rather than blindly displaying every diagnostic emitted by a compiler or language server.

Some syntax errors generate several cascading diagnostics.

For example, a missing quote or parenthesis may cause the parser to report additional errors on subsequent lines.

Claude Code must improve the grouping and deduplication logic.

Requirements:

- Inspect diagnostic messages.
- Inspect diagnostic ranges.
- Inspect surrounding source code.
- Identify diagnostics caused by the same underlying mistake.
- Group genuine cascading diagnostics.
- Avoid duplicate error rows.
- Preserve separate, independent mistakes.
- Do not suppress genuine errors merely because they occur close together.

For example, if a Python function contains both an indentation problem and an unterminated string/parenthesis, the system should identify the distinct underlying problems rather than hiding one of them.

**Important:** Do not simply reduce the number of displayed errors. The goal is accurate root-cause identification, not hiding errors.

## Meaningful warnings

Include warnings that represent genuine correctness problems.

Examples:

- Undefined or misspelled variable.
- Potentially unsafe operation.
- A likely null dereference.
- An invalid operation.

Exclude general code-quality suggestions such as:

- Unused variables.
- Cosmetic formatting.
- Generic style recommendations.
- Unnecessary code-quality observations.

Code Equalize should focus on actual programming problems, not become a general-purpose linter.

---

# 9. WHOLE-SOURCE ANALYSIS AND RUNTIME-ERROR DETECTION

This is one of the most important requirements.

**Code Equalize must be capable of analysing a source file without the user executing it.**

The user should not have to start a debugger or run the program just to receive useful analysis.

## Whole-source Groq analysis

Send the complete source file to Groq.

The request should contain:

- Complete source code.
- Programming language.
- Relevant file information.
- Actual editor diagnostics.
- Error IDs.
- Relevant line numbers and diagnostic messages.
- Selected explanation language.
- Relevant ChromaDB context.

Do not send only a small extracted error snippet when the complete source is available.

## Potential runtime issues

Groq must analyse the complete source and identify meaningful potential runtime problems that can be inferred from the code.

Examples:

- Division by zero.
- Null dereferencing.
- Array/list index out of bounds.
- Invalid assumptions about input.
- Unsafe operations.
- Other language-specific runtime risks.

The analysis must work even when the file has no compiler diagnostics.

If syntax errors and potential runtime risks coexist, Groq should analyse the complete source and report both where supported by the evidence.

## Important technical distinction

There is a difference between an actual observed runtime error and a potential runtime issue inferred from source code.

Groq can reason about possible runtime failures without executing the program. However, it cannot guarantee that a particular failure occurred for every possible input or execution path.

Therefore:

- Source-inferred issues must be described as potential runtime issues or possible runtime risks.
- Actual observed runtime failures must be based on real runtime evidence.
- Do not claim that an exception actually occurred merely because the AI predicts it could occur.
- Explain uncertainty when the result depends on inputs or execution paths.

### Language-specific correctness

Use accurate language-specific explanations.

Examples:

- Python division by zero raises `ZeroDivisionError`.
- Java integer division by zero raises `ArithmeticException`.
- Java floating-point division behaves differently and may produce Infinity or NaN.
- C/C++ integer division by zero is undefined behaviour, not a guaranteed exception.
- Java null dereferencing commonly causes `NullPointerException`.
- C/C++ null-pointer misuse is not a Java-style exception and may cause undefined behaviour or a crash.
- Python out-of-range list access raises `IndexError`.
- Java array out-of-range access raises `ArrayIndexOutOfBoundsException`.
- C/C++ out-of-bounds access is undefined behaviour.

Do not use Java terminology for C/C++ or Python errors.

## Existing debugger integration

Preserve the existing DAP/debugger integration.

It should provide additional actual runtime evidence when a debug session is available.

However, debugger integration must not be the only mechanism for identifying runtime-related problems.

Do not implement invasive interception of arbitrary terminal processes. Optional terminal integration is outside the required scope unless a reliable implementation already exists.

---

# 10. GROQ AND CHROMADB INTEGRATION

Preserve the existing Groq and ChromaDB architecture.

## One coordinated batch request

If a file contains five errors, the system should generate:

- Five individual explanations.
- One consolidated corrected source file.
- One WHAT WAS FIXED section.
- One REMEMBER section.

This should be handled as one coordinated batch operation.

Preserve the existing `POST /explain/all` endpoint and its ID-based response mapping.

Do not unnecessarily create separate AI requests for every individual issue.

## Groq input requirements

Groq should receive:

1. Complete source code.
2. Programming language.
3. Actual editor diagnostics.
4. Stable error IDs.
5. Line numbers and diagnostic context.
6. Relevant ChromaDB retrieval context.
7. Selected explanation language.

## ChromaDB's role

ChromaDB is supporting knowledge.

It must not replace Groq's understanding of the actual source code.

Requirements:

- Retrieve relevant records.
- Verify retrieved information against the actual source.
- Avoid irrelevant retrieval contamination.
- Do not blindly accept retrieved corrections.
- Let Groq independently reason about the current source.
- Preserve the existing collection and its records.
- Preserve existing embeddings and RAG design.
- Do not clear or recreate the collection.
- Continue safe, error-specific storage behaviour where implemented.
- Do not store an entire consolidated file correction as an isolated reusable error record.

If ChromaDB retrieval fails or returns irrelevant context, the system should still use the available source and diagnostics where the existing architecture supports safe fallback.

## Structured response integrity

Preserve and strengthen the existing response parser.

Ensure:

- Every issue has one corresponding explanation.
- Stable IDs are authoritative.
- Missing IDs are handled safely.
- Duplicate IDs are rejected or handled safely.
- Unknown IDs cannot be attached to the wrong error.
- Missing explanations are detected.
- Unexpected issue counts are detected.
- Incomplete responses are not presented as successful complete results.
- Corrected code is separated from explanatory prose.
- Markdown code fences are removed before code display and copying.

Never attach the wrong explanation to an error row.

---

# 11. WHY THIS HAPPENED

The interface must contain one unified section titled:

**WHY THIS HAPPENED**

For each identified issue:

1. Show the error number.
2. Show the corresponding line.
3. Show the error type.
4. Provide one beginner-friendly explanatory paragraph.

Each paragraph should generally be approximately 3–5 short sentences.

The explanation should combine:

- What happened.
- Why it happened.
- Why the programming language behaves that way.
- What the programmer should understand.
- How to prevent the same mistake.

Use simple analogies where helpful.

For example, for division by zero, an explanation could compare dividing a pizza among zero people with an operation that has no meaningful result.

Do not create multiple mini-subsections for every error.

Do not make explanations unnecessarily long.

Do not provide generic textbook explanations unrelated to the actual code.

The explanation must be:

- Accurate.
- Beginner-friendly.
- Concise.
- Specific to the actual source.
- Consistent with the selected human language.

---

# 12. LANGUAGE SUPPORT AND LANGUAGE SWITCHING

Preserve the existing 11 supported explanation languages:

1. English.
2. Hindi.
3. Bengali.
4. Marathi.
5. Telugu.
6. Tamil.
7. Gujarati.
8. Urdu.
9. Kannada.
10. Odia.
11. Malayalam.

The existing language selector must remain available in the panel.

## Language behaviour

When the user changes the selected language:

- All generated explanations must use the newly selected language.
- WHAT WAS FIXED must use the selected language.
- REMEMBER must use the selected language.
- Programming code must remain valid source code.
- Programming keywords and identifiers must not be translated.
- The panel must not remain stuck in loading.
- A previous language response must not overwrite a newer selection.

## Language persistence

If the user selects Hindi for `main.py`, that preference must remain selected when they reopen or re-analyse `main.py`.

Language preferences must be maintained independently for each file panel.

Do not unexpectedly reset a file's language preference.

Handle rapid language changes and stale requests correctly.

---

# 13. HOW TO FIX IT — COUNTDOWN AND CORRECTED CODE

The next unified section must be titled:

**HOW TO FIX IT**

## 13.1 Fifteen-second countdown

Preserve the existing 15-second animated circular countdown.

Requirements:

- Start at 15 seconds.
- Count down to zero.
- Preserve the circular animation.
- Preserve the smooth red-to-yellow-to-green visual transition.
- Encourage the user to read WHY THIS HAPPENED before viewing the correction.
- Start the countdown after a fresh valid analysis response is ready.

### Early reveal

The user must be able to reveal the correction immediately.

Do not force them to wait for the complete 15 seconds.

### Re-analysis

When a file is re-analysed:

- Refresh its results.
- Restart the countdown.
- Associate the countdown with the new analysis.
- Do not allow an old timer to reveal an outdated correction.

Clean up timers when the panel is disposed or the analysis is replaced.

## 13.2 Complete corrected source file

After the countdown finishes or the user chooses early reveal, display one complete corrected version of the original source file.

This is extremely important.

The correction must address all safely fixable identified issues, not simply the first syntax error.

For example, if the source contains:

- A missing closing parenthesis.
- A division-by-zero problem.

The correction should address both when a safe correction is possible.

Requirements:

- Preserve the original program's intended functionality.
- Preserve the original logic wherever possible.
- Use correct indentation.
- Use correct formatting.
- Use language-appropriate syntax highlighting.
- Display the complete corrected file.
- Do not show markdown code fences in the actual code display.
- Do not insert explanatory prose into the source code unnecessarily.
- Do not make arbitrary changes to values or algorithms.

If the correct solution depends on unknown requirements, do not guess.

Instead, explain why a safe automatic correction cannot be guaranteed.

A correction must not be presented as complete if it leaves an identified issue unresolved.

## 13.3 Copy button

Provide a clear Copy button.

The Copy button must:

- Copy the entire corrected source file.
- Copy only the source code.
- Exclude markdown fences.
- Exclude surrounding explanations.
- Use the existing clipboard mechanism.
- Preserve existing request/session validation.
- Provide accurate success or failure feedback.

**Do not implement an Apply-to-file feature.**

The user explicitly wants Copy only.

---

# 14. WHAT WAS FIXED

After the corrected source code, display a concise section titled:

**WHAT WAS FIXED**

This should explain the meaningful corrections made to the source.

For example:

- Corrected the missing closing parenthesis.
- Added a guard against division by zero.
- Corrected the undefined variable reference.

If a correction changes program behaviour, explain that change.

Do not claim an issue was fixed unless the corrected code actually addresses it.

Keep this section short, clear, and in the selected explanation language.

---

# 15. REMEMBER SECTION

Display one consolidated section titled:

**REMEMBER**

This section should summarise the important programming lessons from all relevant errors in the active file.

Requirements:

- Cover the important lessons from all identified issues.
- Do not omit an important problem.
- Focus on reusable programming knowledge.
- Explain how to avoid similar mistakes in the future.
- Keep the content concise and beginner-friendly.
- Use the selected explanation language.
- Avoid generic filler and unrelated advice.

It should feel like a short learning summary of the complete analysis.

---

# 16. VISUAL DESIGN AND PANEL EXPERIENCE

**The current panel design is already nice. Do not redesign it unnecessarily.**

The goal is to improve the existing design where necessary while preserving its overall appearance and identity.

## 16.1 Theme support

This is a required feature.

The panel must follow the active VS Code theme.

- If the user uses a dark VS Code theme, Code Equalize must appear dark.
- If the user uses a light VS Code theme, Code Equalize must appear light.

Use VS Code theme variables/tokens and supported webview theme classes where possible.

Ensure that:

- Text remains readable.
- Tables remain readable.
- Borders remain visible.
- Buttons and controls remain clear.
- Code blocks remain readable.
- Status colours work in both themes.
- Backgrounds adapt correctly.
- Theme changes are reflected while the panel is open where supported.

Do not hard-code a dark-only design.

## 16.2 Branding

Preserve the existing:

- Code Equalize logo.
- Tagline/motto.
- Branding.
- Existing identity.
- Footer.
- Copyright information.

Do not replace the logo or invent a different brand.

## 16.3 Typography

Use a clean, readable UI font.

Use a monospaced font for source code.

System fallbacks should be available so the panel remains usable without external font access.

Improve spacing, typography, and visual hierarchy only where necessary.

## 16.4 Error table

The exact table structure is:

`# | Line | Error Type | Description`

No Severity column.

## 16.5 Responsive design

Ensure the panel works at different webview sizes.

Avoid:

- Unnecessary horizontal overflow.
- Text clipping.
- Broken layouts.
- Overlapping buttons.
- Excessive whitespace.
- Layout jumps when results update.

Long source lines may use appropriate horizontal scrolling within the code area.

Preserve accessible labels and sensible keyboard focus behaviour.

---

# 17. REQUEST HANDLING AND STATE MANAGEMENT

Audit the complete communication lifecycle:

VS Code command → active editor → diagnostics → API service → backend → RAG → ChromaDB → Groq → response parser → webview → language switching → countdown → clipboard.

Ensure:

- Stable request IDs.
- Correct panel identity.
- Correct session validation.
- Stale responses are rejected.
- Old requests cannot overwrite newer results.
- Rapid re-analysis does not mix results.
- Panel disposal is handled.
- Timers are cleaned up.
- Language switching is handled.
- Loading states always terminate.
- Errors are communicated clearly.
- Controls become usable again after success or failure.
- Duplicate event listeners are avoided.
- Webview messages are validated.
- Nonce and CSP protections are preserved.

Handle:

- Backend unavailable.
- Network errors.
- ChromaDB unavailable.
- Groq API errors.
- Timeouts.
- Invalid JSON.
- Malformed AI output.
- Missing explanations.
- Incomplete corrections.

Do not leave the interface displaying an infinite loading state.

Do not display partial or mismatched data as a successful complete analysis.

---

# 18. RUNTIME DEBUGGER INTEGRATION

Preserve the existing DAP/debugger functionality.

Inspect:

- Debug-session creation.
- Debug-session termination.
- Duplicate runtime event suppression.
- Stale asynchronous inspection.
- Source-line validation.
- Empty or unavailable source handling.
- Continued, stopped, and terminated session behaviour.

Do not regress existing safeguards.

Remember:

- Whole-source Groq analysis identifies potential runtime problems without execution.
- DAP integration supplies additional actual runtime evidence when a debugger is running.

These two sources of information must be distinguished.

---

# 19. SUPPORTED PROGRAMMING LANGUAGES

Preserve the existing intended programming-language support:

- Java.
- Python.
- C.
- C++.

Verify the entire analysis workflow for each language.

Requirements:

- Identify language from the active document.
- Use current in-memory source code.
- Preserve accurate line numbers.
- Ensure comment/string cleaning does not shift line positions.
- Avoid treating text inside comments or strings as executable code in heuristic detection.
- Do not let fallback heuristics override reliable compiler diagnostics.
- Preserve sensible extraction limits and deduplication behaviour.
- Handle unsupported file types gracefully.

Verify the existing `MAX_EXTRACTED_ERRORS` implementation before changing it.

---

# 20. SAFE CORRECTION VALIDATION

Validate the corrected source where possible without executing arbitrary programs.

Possible checks:

- Python syntax/compile validation without executing the program.
- Existing Java compiler checks, if configured.
- Existing C/C++ compiler checks, if configured.

Do not introduce a heavyweight toolchain requirement.

A successful syntax check does not prove that runtime logic is correct.

Report validation accurately:

- Syntax checked successfully.
- Syntax validation failed.
- Validation unavailable.
- Runtime behaviour not executed/verified.

Do not claim that a correction has been runtime-tested if it has only passed a syntax check.

---

# 21. COMPLETE TESTING AND VERIFICATION PLAN

Automated tests alone are not sufficient.

Claude Code must verify the entire product.

## 21.1 Build and repository checks

Run the existing scripts for:

- Extension compilation.
- Extension linting.
- Backend testing.
- Backend validation.
- Formatting/diff checks.

Verify imports, API registration, package scripts, and configuration.

Run:

`git diff --check`

Do not change dependencies or lockfiles without a demonstrated reason.

## 21.2 Extension workflow tests

Verify:

1. Command Palette command works.
2. Right-click command works.
3. Only the active file is analysed.
4. Unsaved changes are included.
5. Unsupported files are handled.
6. Separate files receive separate panels.
7. Reopening a file reuses its panel.
8. Re-analysis refreshes the existing panel.
9. Old responses cannot overwrite new results.
10. Panel disposal cleans up timers and state.

## 21.3 Error detection tests

Test representative cases in Java, Python, C, and C++:

- Syntax error.
- Undefined variable.
- Misspelled variable.
- Missing indentation.
- Missing quote.
- Missing parenthesis.
- Multiple independent errors.
- Cascading diagnostics.
- Meaningful warning.
- Cosmetic warning.
- Division by zero.
- Null dereference.
- Out-of-range indexing.
- No errors.
- Multiple issues on one line.
- Missing or invalid line information.

Verify that root-cause grouping works without hiding distinct mistakes.

## 21.4 Runtime analysis tests

Verify:

- Runtime-risk analysis works without running the program.
- A source file with no compiler diagnostics can still produce useful runtime-risk findings.
- Syntax errors and potential runtime risks can coexist.
- Inferred risks are labelled as potential.
- Actual debugger-observed failures are distinguished.
- No debug session is required for whole-source analysis.

## 21.5 Backend tests

Verify:

- `GET /health`.
- `POST /explain`.
- `POST /explain/all`.
- Multiple-error batch generation.
- Correct error-ID mapping.
- Different response ordering.
- Missing IDs.
- Duplicate IDs.
- Unknown IDs.
- Missing explanations.
- Malformed AI responses.
- Invalid request payloads.
- ChromaDB retrieval failures.
- Groq failures.
- Timeout handling.
- Complete correction output.
- Remember generation.
- Safe storage behaviour.

Confirm the existing ChromaDB collection remains intact.

## 21.6 Language tests

Test all 11 supported languages where practical.

Verify:

- Explanations use the selected language.
- WHAT WAS FIXED uses the selected language.
- REMEMBER uses the selected language.
- Source code remains valid and untranslated.
- Switching language does not get stuck loading.
- Per-file language preference persists.
- Re-analysis does not unexpectedly reset language.

## 21.7 UI tests

Verify:

- Dark theme.
- Light theme.
- Exact four-column table.
- No Severity column.
- Logo preserved.
- Tagline preserved.
- Footer preserved.
- Correct typography.
- Readable descriptions.
- Correct code formatting.
- Correct syntax highlighting.
- No visible markdown fences.
- Copy button copies only source code.
- Countdown runs from 15 to 0.
- Early reveal works.
- Re-analysis restarts the countdown.
- Old timers cannot reveal outdated corrections.
- WHAT WAS FIXED is accurate.
- REMEMBER covers the relevant lessons.

## 21.8 Real VS Code Extension Development Host

This is essential.

Launch the actual VS Code Extension Development Host and test the user-facing experience.

Verify:

- Python analysis.
- Java analysis.
- C analysis.
- C++ analysis.
- Command Palette invocation.
- Right-click invocation.
- Multiple file panels.
- Panel reuse.
- Language switching.
- Dark and light themes.
- Countdown.
- Early reveal.
- Copy interaction.
- Multiple errors in one file.
- Syntax and potential runtime issues together.
- Re-analysis after editing.
- Backend unavailable and recovery.

Do not claim this verification was completed if the actual Extension Development Host was not launched.

---

# 22. ACCEPTANCE CRITERIA

The implementation is complete only when these requirements are satisfied.

- [ ] Existing architecture is preserved.
- [ ] Existing working features are preserved.
- [ ] Manual active-file analysis works.
- [ ] Command Palette invocation works.
- [ ] Right-click invocation works.
- [ ] Each file has its own panel.
- [ ] Reopening a file reuses its panel.
- [ ] Re-analysis refreshes the existing panel.
- [ ] Language preference persists per file.
- [ ] Complete source code is analysed by Groq.
- [ ] Potential runtime issues are identified without execution.
- [ ] Potential runtime risks are distinguished from actual observed failures.
- [ ] Duplicate cascading diagnostics are grouped.
- [ ] Independent root causes are retained.
- [ ] Error table has exactly four columns.
- [ ] No Severity column exists.
- [ ] Explanations are accurate and beginner-friendly.
- [ ] Batch generation produces all required sections.
- [ ] Corrected source addresses all safely fixable issues.
- [ ] Original program functionality is preserved where possible.
- [ ] Fifteen-second countdown works.
- [ ] Early reveal works.
- [ ] Countdown restarts on re-analysis.
- [ ] Copy button works.
- [ ] No Apply-to-file feature is added.
- [ ] WHAT WAS FIXED is accurate.
- [ ] REMEMBER covers all important lessons.
- [ ] Dark VS Code theme is supported.
- [ ] Light VS Code theme is supported.
- [ ] Logo, tagline, and branding remain.
- [ ] Footer and copyright remain.
- [ ] ChromaDB collection and records are preserved.
- [ ] Existing Groq model and endpoints are preserved.
- [ ] No secrets are exposed.
- [ ] No arbitrary user code is silently executed.
- [ ] Build and test results are reported truthfully.
- [ ] Final changes contain no unrelated modifications.

---

# 23. REQUIRED FINAL REPORT

After implementation, Claude Code must provide a detailed but concise report.

### 1. Root causes identified

Explain the actual reasons for the defects.

Group them into:

- Extension.
- Webview/UI.
- Backend/AI.
- Data flow and state management.

### 2. Files changed

List every modified file and explain why it was changed.

### 3. Features repaired

Map completed changes to the requirements in this document.

### 4. Tests performed

List exact commands and their outcomes.

Separate:

- Passed.
- Failed.
- Skipped.
- Not performed.

### 5. Manual verification

State whether the actual VS Code Extension Development Host was launched.

List the workflows tested.

### 6. Known limitations

Clearly state any remaining limitations, particularly:

- Static runtime inference.
- Compiler availability.
- Unverified runtime behaviour.
- Unsupported scenarios.

### 7. Data safety

Explicitly confirm:

- ChromaDB was not cleared.
- The collection was not recreated.
- Existing records were preserved.
- No environment secrets were exposed.

### 8. Final diff review

Confirm that:

- No unrelated modifications remain.
- No unnecessary dependencies were added.
- No temporary debugging code remains.
- Existing working functionality was preserved.

Do not claim the project is fully complete simply because TypeScript compilation succeeds.

---

# 24. RECOMMENDED IMPLEMENTATION ORDER

Follow this sequence to avoid repeated speculative patches.

## PHASE 1 — COMPLETE REPOSITORY AUDIT

Inspect the complete repository and current Git status.

Trace the entire request lifecycle:

Command invocation → active editor → diagnostics → source collection → extension API → backend route → RAG → ChromaDB → Groq → response parser → webview → language switching → countdown → clipboard.

Identify the actual root causes of the reported defects.

Before making broad or risky modifications, provide a concise diagnosis and implementation plan.

## PHASE 2 — COORDINATED IMPLEMENTATION

Implement related fixes together.

Prioritise:

1. Correct active-file source collection.
2. Accurate diagnostic/root-cause handling.
3. Full-source AI analysis.
4. Correct batch response generation.
5. Corrected-source completeness and validity.
6. Per-file panel state.
7. Language switching and persistence.
8. Countdown and early reveal.
9. Dark/light theme support.
10. UI and interaction consistency.

Preserve existing architecture and working features.

## PHASE 3 — AUTOMATED VERIFICATION

Run the relevant build, lint, backend, unit, integration, and endpoint tests.

Add focused regression tests for the actual root causes discovered.

Verify the ChromaDB collection remains intact.

## PHASE 4 — REAL VS CODE HOST VERIFICATION

Launch the VS Code Extension Development Host.

Test the actual product workflow across the supported languages, panel behaviour, themes, countdown, language switching, and copying.

## PHASE 5 — FINAL REVIEW

Review the complete Git diff.

Confirm no unrelated modifications or debug code remain.

Produce the final report specified in Section 23.

If a focused second pass is necessary, it must be based on evidence from testing, not guesswork.

---

# FINAL PRODUCT PRINCIPLE

Code Equalize must do more than display compiler messages.

It must understand the actual mistakes in the user's source code, explain why they happen in language a beginner can understand, identify meaningful potential runtime problems, and provide one complete and trustworthy correction whenever it is safe to do so.

**Preserve what already works. Diagnose before changing. Fix the complete workflow. Verify the actual product.**

The goal is a stable, integrated, polished Code Equalize experience — not another cycle of random patches.