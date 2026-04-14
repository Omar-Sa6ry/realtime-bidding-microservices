
export async function waitFor(
  predicate: () => Promise<boolean> | boolean,
  timeoutMs: number = 10000,
  intervalMs: number = 500
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await predicate()) return;
    } catch (e) {
      // Ignore errors in predicate and retry
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}
