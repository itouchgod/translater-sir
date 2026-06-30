type EndpointConfig = {
  name: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
};

type EndpointResult = {
  name: string;
  requests: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  statusCounts: Record<number, number>;
};

const baseUrl = (process.env.PERF_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const requestCount = Number.parseInt(process.env.PERF_REQUESTS ?? "100", 10);
const timeoutMs = Number.parseInt(process.env.PERF_TIMEOUT_MS ?? "10000", 10);
const cookie = process.env.PERF_AUTH_COOKIE;
const meetingId = process.env.PERF_MEETING_ID ?? "perf-meeting-id";
const translateBody = process.env.PERF_TRANSLATE_BODY
  ? JSON.parse(process.env.PERF_TRANSLATE_BODY)
  : {
      text: "Hello, this is a performance test sentence.",
      sourceLanguage: "en",
      targetLanguage: "zh",
      meetingId,
    };

const endpoints: EndpointConfig[] = [
  {
    name: "GET /api/meetings",
    method: "GET",
    path: "/api/meetings",
  },
  {
    name: "GET /api/dashboard/stats",
    method: "GET",
    path: "/api/dashboard/stats",
  },
  {
    name: "POST /api/translate",
    method: "POST",
    path: "/api/translate",
    body: translateBody,
  },
];

function percentile(values: number[], rank: number) {
  if (values.length === 0) {
    return 0;
  }

  const index = Math.min(values.length - 1, Math.ceil((rank / 100) * values.length) - 1);
  return values[index];
}

function roundMs(value: number) {
  return Number(value.toFixed(2));
}

async function measure(endpoint: EndpointConfig): Promise<EndpointResult> {
  const durations: number[] = [];
  const statusCounts: Record<number, number> = {};

  for (let index = 0; index < requestCount; index += 1) {
    const headers = new Headers();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    if (cookie) {
      headers.set("cookie", cookie);
    }

    if (endpoint.method === "POST") {
      headers.set("content-type", "application/json");
    }

    const startedAt = performance.now();
    try {
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers,
        signal: controller.signal,
        body: endpoint.method === "POST" ? JSON.stringify(endpoint.body ?? {}) : undefined,
      });
      const latencyMs = performance.now() - startedAt;

      await response.arrayBuffer();
      durations.push(latencyMs);
      statusCounts[response.status] = (statusCounts[response.status] ?? 0) + 1;
    } catch {
      const latencyMs = performance.now() - startedAt;

      durations.push(latencyMs);
      statusCounts[0] = (statusCounts[0] ?? 0) + 1;
    } finally {
      clearTimeout(timeout);
    }
  }

  durations.sort((a, b) => a - b);

  return {
    name: endpoint.name,
    requests: requestCount,
    p50: roundMs(percentile(durations, 50)),
    p95: roundMs(percentile(durations, 95)),
    p99: roundMs(percentile(durations, 99)),
    min: roundMs(durations[0] ?? 0),
    max: roundMs(durations.at(-1) ?? 0),
    statusCounts,
  };
}

async function main() {
  const results: EndpointResult[] = [];

  for (const endpoint of endpoints) {
    results.push(await measure(endpoint));
  }

  console.log(JSON.stringify({ baseUrl, requestCount, timeoutMs, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
