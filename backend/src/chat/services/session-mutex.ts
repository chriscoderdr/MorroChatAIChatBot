// Simple in-memory mutex for per-session locking (not cluster-safe)
const sessionLocks = new Map<string, Promise<void>>();

export async function withSessionMutex<T>(
  sessionId: string,
  fn: () => Promise<T>,
): Promise<T> {
  let release: () => void;
  const prev = sessionLocks.get(sessionId) || Promise.resolve();
  const next = new Promise<void>((resolve) => (release = resolve));
  sessionLocks.set(
    sessionId,
    prev.then(() => next),
  );
  try {
    await prev;
    return await fn();
  } finally {
    release!();
    // Clean up if no one else is waiting
    if (sessionLocks.get(sessionId) === next) {
      sessionLocks.delete(sessionId);
    }
  }
}
