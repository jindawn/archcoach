const baseUrl = process.env.ARCHCOACH_URL ?? "http://web:3000";
const secret = process.env.JOB_WORKER_SECRET ?? "";
const intervalMs = Number(process.env.JOB_POLL_INTERVAL_MS ?? 2_000);

async function poll() {
  try {
    await fetch(`${baseUrl}/api/internal/review-jobs/run-next`, {
      method: "POST",
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    });
  } catch (error) {
    console.error("review worker poll failed", error);
  }
  setTimeout(poll, intervalMs);
}

void poll();
