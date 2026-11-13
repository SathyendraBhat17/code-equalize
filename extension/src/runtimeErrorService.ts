
import * as vscode from 'vscode';

export type RuntimeError = {
  error: string;
  message?: string;
  file?: string;
  line?: number;
  code: string;
  language: 'Java' | 'Python' | 'C' | 'C++';
};

type DapMessage = {
  type?: string;
  event?: string;
  body?: Record<string, unknown>;
};

type StackFrame = {
  line?: number;
  source?: {
    path?: string;
    name?: string;
  };
};

type SessionTracking = {
  generation: number;
  completed: Set<string>;
  inProgress: Set<string>;
};

/**
 * Safely converts an unknown value into an object.
 */
function record(
  value: unknown
): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : undefined;
}

/**
 * Extracts a readable exception name from debugger information.
 */
function exceptionName(
  value: unknown
): string | undefined {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    return undefined;
  }

  const firstLine = value.trim().split(/\r?\n/)[0]
    .replace(/^Exception in thread "[^"]+"\s*/, '')
    .trim();
  const qualifiedName = firstLine.match(
    /\b([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:Error|Exception))\b/
  );

  return qualifiedName?.[1]?.split('.').pop() || firstLine;
}

/**
 * Determines the programming language using the source
 * extension first and debugger adapter type as fallback.
 */
function languageFor(
  session: vscode.DebugSession,
  file?: string
): RuntimeError['language'] | undefined {
  const sessionType = session.type.toLowerCase();
  const extension = file?.split('.').pop()?.toLowerCase();

  // Prefer the actual source file extension.
  if (extension === 'java') {
    return 'Java';
  }
  if (extension === 'py') {
    return 'Python';
  }
  if (extension === 'c') {
    return 'C';
  }

  if (
    ['cpp', 'cc', 'cxx', 'c++'].includes(extension ?? '')
  ) {
    return 'C++';
  }

  // Fall back to known debugger adapter types.
  if (
    sessionType.includes('python') ||
    sessionType.includes('debugpy')
  ) {
    return 'Python';
  }

  if (sessionType.includes('java')) {
    return 'Java';
  }

  if (
    sessionType.includes('cppdbg') ||
    sessionType.includes('cppvsdbg') ||
    sessionType.includes('codelldb') ||
    sessionType.includes('lldb')
  ) {
    return 'C++';
  }

  return undefined;
}

/**
 * Reads source code from an open document or the workspace.
 */
async function sourceFor(
  path?: string
): Promise<string> {
  if (!path) {
    return '';
  }

  try {
    const uri = vscode.Uri.file(path);

    const openDocument = vscode.workspace.textDocuments.find(
      document =>
        document.uri.toString() === uri.toString()
    );

    const document =
      openDocument ??
      await vscode.workspace.openTextDocument(uri);

    return document.getText();
  } catch {
    return '';
  }
}

/**
 * Observes existing debugger sessions.
 *
 * Does not start debugging or modify
 * user exception-breakpoint settings.
 */
export function registerRuntimeErrorObserver(
  context: vscode.ExtensionContext,
  onRuntimeError: (
    error: RuntimeError
  ) => void | Promise<void>
): void {
  console.log(
    '[Code Equalize] Runtime error observer registered'
  );

  const trackingBySession =
    new Map<string, SessionTracking>();

  const getTracking = (sessionId: string): SessionTracking => {
    let tracking = trackingBySession.get(sessionId);

    if (!tracking) {
      tracking = {
        generation: 0,
        completed: new Set(),
        inProgress: new Set()
      };
      trackingBySession.set(sessionId, tracking);
    }

    return tracking;
  };

  const isCurrentInspection = (
    sessionId: string,
    tracking: SessionTracking,
    generation: number
  ): boolean =>
    trackingBySession.get(sessionId) === tracking &&
    tracking.generation === generation;

  const inspectStop = async (
    session: vscode.DebugSession,
    body: Record<string, unknown> | undefined,
    reason: 'exception' | 'signal',
    threadId: number,
    tracking: SessionTracking,
    generation: number,
    stopIdentity: string
  ): Promise<void> => {
    let identity: string | undefined;
    let identityRegistered = false;

    try {
      const stackResponse = await session.customRequest(
        'stackTrace',
        {
          threadId,
          startFrame: 0,
          levels: 1
        }
      );

      if (
        !isCurrentInspection(session.id, tracking, generation)
      ) {
        return;
      }

      const frames = record(stackResponse)?.stackFrames;

      const frame = Array.isArray(frames)
        ? record(frames[0]) as StackFrame | undefined
        : undefined;

      const source = record(frame?.source);

      const file =
        typeof source?.path === 'string'
          ? source.path
          : undefined;

      const language = languageFor(session, file);

      if (!language) {
        console.log(
          '[Code Equalize] Unsupported runtime language:',
          { adapterType: session.type }
        );
        return;
      }

      let exception: Record<string, unknown> | undefined;

      if (reason === 'exception') {
        try {
          const response = await session.customRequest(
            'exceptionInfo',
            { threadId }
          );

          if (
            !isCurrentInspection(
              session.id,
              tracking,
              generation
            )
          ) {
            return;
          }

          exception = record(response);
        } catch {
          if (
            !isCurrentInspection(
              session.id,
              tracking,
              generation
            )
          ) {
            return;
          }

          console.log(
            '[Code Equalize] exceptionInfo unavailable.'
          );
        }
      }

      if (
        !isCurrentInspection(session.id, tracking, generation)
      ) {
        return;
      }

      const details = record(exception?.details);

      const description =
        typeof exception?.description === 'string'
          ? exception.description
          : typeof body?.description === 'string'
            ? body.description
            : typeof body?.text === 'string'
              ? body.text
              : undefined;

      const errorName =
        exceptionName(exception?.exceptionId) ??
        exceptionName(description) ??
        (
          reason === 'signal'
            ? 'Runtime signal'
            : 'Runtime exception'
        );

      const errorMessage =
        typeof details?.message === 'string'
          ? details.message
          : description;

      const frameLine = frame?.line;
      const line =
        typeof frameLine === 'number' &&
        Number.isFinite(frameLine) &&
        Number.isInteger(frameLine) &&
        frameLine >= 1
          ? frameLine
          : undefined;

      identity = [
        errorName,
        file ?? '',
        line ?? '',
        errorMessage ?? ''
      ].join('|');

      if (
        tracking.completed.has(identity) ||
        tracking.inProgress.has(identity)
      ) {
        return;
      }

      tracking.inProgress.add(identity);
      identityRegistered = true;

      const code = await sourceFor(file);

      if (
        !isCurrentInspection(session.id, tracking, generation)
      ) {
        return;
      }

      if (!code.trim()) {
        console.log(
          '[Code Equalize] Runtime error source unavailable; skipping forwarding.'
        );
        return;
      }

      if (
        !isCurrentInspection(session.id, tracking, generation)
      ) {
        return;
      }

      console.log(
        '[Code Equalize] Runtime error detected:',
        { language, line }
      );

      await onRuntimeError({
        error: errorName,
        message: errorMessage,
        file,
        line,
        code,
        language
      });

      if (
        isCurrentInspection(session.id, tracking, generation)
      ) {
        tracking.completed.add(identity);
      }
    } catch {
      console.error(
        '[Code Equalize] Could not inspect runtime stop.'
      );
    } finally {
      if (
        isCurrentInspection(session.id, tracking, generation)
      ) {
        tracking.inProgress.delete(stopIdentity);

        if (identityRegistered && identity) {
          tracking.inProgress.delete(identity);
        }
      }
    }
  };

  context.subscriptions.push(

    // Track newly started debug sessions.
    vscode.debug.onDidStartDebugSession(session => {
      console.log(
        '[Code Equalize] Debug session started:',
        session.type
      );

      // Keep the object captured by the adapter tracker. Replacing it here
      // can make every later DAP event look stale if tracker creation ran
      // before this lifecycle event.
      const tracking = getTracking(session.id);
      tracking.generation += 1;
      tracking.completed.clear();
      tracking.inProgress.clear();
    }),

    // Remove session data when debugging ends.
    vscode.debug.onDidTerminateDebugSession(session => {
      trackingBySession.delete(session.id);
    }),

    // Observe Debug Adapter Protocol messages.
    vscode.debug.registerDebugAdapterTrackerFactory('*', {
      createDebugAdapterTracker(session) {
        console.log(
          '[Code Equalize] DAP tracker attached:',
          session.type
        );

        // Ensure session tracking exists.
        const tracking = getTracking(session.id);

        return {
          onDidSendMessage(message: DapMessage) {
            if (
              trackingBySession.get(session.id) !== tracking
            ) {
              return;
            }

            if (message.type !== 'event') {
              return;
            }

            const body = message.body;

            // Clear duplicate tracking when execution resumes.
            if (message.event === 'continued') {
              tracking.generation += 1;
              tracking.completed.clear();
              tracking.inProgress.clear();
              return;
            }

            // Only inspect exception and signal stops.
            if (message.event !== 'stopped') {
              return;
            }

            const reason = body?.reason;

            if (
              reason !== 'exception' &&
              reason !== 'signal'
            ) {
              return;
            }

            const threadId = body?.threadId;

            if (typeof threadId !== 'number') {
              console.log(
                '[Code Equalize] Runtime stop missing threadId'
              );
              return;
            }

            const generation = tracking.generation;
            const stopIdentity = `stop:${threadId}:${reason}`;

            if (tracking.inProgress.has(stopIdentity)) {
              return;
            }

            tracking.inProgress.add(stopIdentity);

            void inspectStop(
              session,
              body,
              reason,
              threadId,
              tracking,
              generation,
              stopIdentity
            );
          }
        };
      }
    })
  );
}
