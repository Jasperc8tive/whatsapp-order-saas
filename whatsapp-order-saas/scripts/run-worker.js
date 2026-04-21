const maxJobs = process.env.WORKER_MAX_JOBS ?? "40";
const baseUrl = (process.env.WORKER_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.WORKER_SECRET;

if (!secret) {
  console.error("Missing WORKER_SECRET environment variable.");
  process.exit(1);
}

async function run() {
  const url = `${baseUrl}/api/jobs/worker?maxJobs=${encodeURIComponent(maxJobs)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-worker-secret": secret,
      "content-type": "application/json",
    },
  });

  const text = await res.text();
  console.log(`[worker] status=${res.status}`);
  console.log(text);

  if (!res.ok) process.exit(1);
}

run().catch((err) => {
  console.error("[worker] execution failed", err);
  process.exit(1);
});
