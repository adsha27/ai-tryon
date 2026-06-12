import { pollTryOn } from "./vton";

export class TryOnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TryOnError";
  }
}

// Polls a try-on job until completion or failure.
// Throws TryOnError on failure or timeout.
export async function waitForTryOn(
  jobId: string,
  onProgress?: (elapsed: number) => void,
): Promise<string> {
  const start = Date.now();
  const MAX_WAIT_MS = 120_000;
  const POLL_INTERVAL_MS = 2_000;

  while (Date.now() - start < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const job = await pollTryOn(jobId);
    const elapsed = Math.floor((Date.now() - start) / 1000);
    onProgress?.(elapsed);

    if (job.status === "completed") {
      const url = job.output?.[0];
      if (!url) throw new TryOnError("Job completed but no output URL");
      return url;
    }

    if (job.status === "failed") {
      throw new TryOnError(job.error ?? "Try-on failed with no error message");
    }
  }

  throw new TryOnError("Timed out after 2 minutes");
}
