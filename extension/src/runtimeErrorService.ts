import * as vscode from 'vscode';

export type RuntimeError = {
  error: string;
  message?: string;
  file?: string;
  line?: number;
  code: string;
  language: 'Java' | 'Python';
};

type DapMessage = { type?: string; event?: string; body?: Record<string, unknown> };
type StackFrame = { line?: number; source?: { path?: string; name?: string } };

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function exceptionName(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  return value.trim().split(/[.\s:]/).filter(Boolean).pop();
}

function languageFor(session: vscode.DebugSession, file?: string): RuntimeError['language'] | undefined {
  const id = `${session.type} ${file ?? ''}`.toLowerCase();
  if (id.includes('java') || (file && file.endsWith('.java'))) {
    return 'Java';
  }
  if (id.includes('python') || id.includes('debugpy') || (file && file.endsWith('.py'))) {
    return 'Python';
  }
  return undefined;
}

async function sourceFor(path?: string): Promise<string> {
  if (!path) {
    return '';
  }
  try {
    const uri = vscode.Uri.file(path);
    const open = vscode.workspace.textDocuments.find(document => document.uri.toString() === uri.toString());
    const document = open ?? await vscode.workspace.openTextDocument(uri);
    return document.getText();
  } catch {
    return '';
  }
}

/** Observes existing DAP sessions without starting or controlling them. */
export function registerRuntimeErrorObserver(
  context: vscode.ExtensionContext,
  onRuntimeError: (error: RuntimeError) => void | Promise<void>
): void {
  console.log('[Code Equalize] Runtime error observer registered');
  const seenBySession = new Map<string, Set<string>>();

  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession(async session => {
      console.log('[Code Equalize] Debug session started:', session.type, session.name);
      seenBySession.set(session.id, new Set());

      // Automatically enable "uncaught exceptions" breakpoint so the debugger
      // stops on exceptions and the DAP tracker can intercept them.
      // We silently ignore failures (the user may have already configured this,
      // or the debug adapter may not support it).
      try {
        await session.customRequest('setExceptionBreakpoints', {
          filters: ['uncaught'],
        });
        console.log('[Code Equalize] Exception breakpoints set (uncaught) for session:', session.id);
      } catch (e) {
        // Not fatal – some adapters don't support this or the user handles it.
        console.log('[Code Equalize] setExceptionBreakpoints not supported or already set:', e);
      }
    }),
    vscode.debug.onDidTerminateDebugSession(session => seenBySession.delete(session.id)),
    vscode.debug.registerDebugAdapterTrackerFactory('*', {
      createDebugAdapterTracker(session) {
        console.log('[Code Equalize] DAP tracker attached:', session.type, session.name);
        return {
          onDidSendMessage(message: DapMessage) {
            if (message.type !== 'event') {
              return;
            }
            const body = message.body;
            if (message.event === 'stopped' || message.event === 'continued') {
              console.log('[Code Equalize] DAP event:', {
                event: message.event,
                reason: body?.reason,
                sessionType: session.type
              });
            }
            if (message.event === 'continued') {
              seenBySession.get(session.id)?.clear();
              return;
            }
            if (message.event === 'stopped') {
              console.log('[Code Equalize] DAP stopped event reason:', body?.reason);
            }
            if (message.event !== 'stopped' || body?.reason !== 'exception') {
              return;
            }
            console.log('[Code Equalize] Runtime exception event detected');
            const threadId = body.threadId;
            if (typeof threadId !== 'number') {
              console.log('[Code Equalize] Exception stop missing threadId; skipping');
              return;
            }

            void (async () => {
              try {
                console.log('[Code Equalize] Requesting exceptionInfo');
                const exceptionRequest = Promise.resolve(session.customRequest('exceptionInfo', { threadId }))
                  .catch((error: unknown) => {
                    console.error('[Code Equalize] exceptionInfo request failed:', error);
                    throw error;
                  });
                console.log('[Code Equalize] Requesting stackTrace');
                const stackRequest = Promise.resolve(session.customRequest('stackTrace', { threadId, startFrame: 0, levels: 1 }))
                  .catch((error: unknown) => {
                    console.error('[Code Equalize] stackTrace request failed:', error);
                    throw error;
                  });
                const [exceptionResponse, stackResponse] = await Promise.all([exceptionRequest, stackRequest]);
                const exception = record(exceptionResponse);
                const details = record(exception?.details);
                const frames = record(stackResponse)?.stackFrames;
                const frame = Array.isArray(frames) ? record(frames[0]) as StackFrame | undefined : undefined;
                const source = record(frame?.source);
                const file = typeof source?.path === 'string' ? source.path : undefined;
                const language = languageFor(session, file);
                if (!language) {
                  console.log('[Code Equalize] Unsupported debug session for runtime explain', {
                    sessionType: session.type,
                    hasFile: Boolean(file)
                  });
                  return;
                }

                const description = typeof exception?.description === 'string' ? exception.description : undefined;
                const error = exceptionName(exception?.exceptionId) ?? exceptionName(description?.split('\n')[0]);
                if (!error) {
                  console.log('[Code Equalize] Could not derive exception name from exceptionInfo');
                  return;
                }
                const message = typeof details?.message === 'string'
                  ? details.message
                  : description && description !== error ? description : undefined;
                const line = typeof frame?.line === 'number' ? frame.line : undefined;
                const identity = [error, file ?? '', line ?? '', message ?? ''].join('|');
                const seen = seenBySession.get(session.id) ?? new Set<string>();
                seenBySession.set(session.id, seen);
                if (seen.has(identity)) {
                  return;
                }
                seen.add(identity);
                const code = await sourceFor(file);
                console.log('[Code Equalize] Sending runtime error to explanation pipeline', {
                  language,
                  hasLocation: Boolean(file && line)
                });
                try {
                  await onRuntimeError({ error, message, file, line, code, language });
                } catch (callbackError) {
                  console.error('[Code Equalize] Runtime error callback failed:', callbackError);
                }
              } catch (error) {
                console.error('[Code Equalize] Could not inspect the runtime exception:', error);
              }
            })();
          }
        };
      }
    })
  );
}