import { createHash } from "node:crypto";

import {
  jsonErrorPayload,
  type JsonResponsePayload,
} from "@/lib/api/responses";

const IDEMPOTENCY_HEADER = "idempotency-key";
const IDEMPOTENCY_RESPONSE_TTL_SECONDS = 60 * 15;
const IDEMPOTENCY_LOCK_TTL_SECONDS = 60;

type IdempotencyStoredResponse = JsonResponsePayload;

type IdempotencyStore = {
  delete(key: string): Promise<void>;
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: {
      exSeconds?: number;
      onlyIfAbsent?: boolean;
    },
  ): Promise<"OK" | null>;
};

type IdempotentRequestOptions = {
  execute: () => Promise<JsonResponsePayload>;
  request: Request;
  requestHash?: string;
  routeScope: string;
  store?: IdempotencyStore | null;
};

type UpstashConfig = {
  token: string;
  url: string;
};

export async function runIdempotentJsonRequest({
  execute,
  request,
  requestHash,
  routeScope,
  store = createIdempotencyStoreFromEnv(),
}: IdempotentRequestOptions): Promise<JsonResponsePayload> {
  const idempotencyKey = getIdempotencyKey(request);

  if (!idempotencyKey) {
    return execute();
  }

  if (!store) {
    return jsonErrorPayload(
      503,
      "IDEMPOTENCY_NOT_CONFIGURED",
      "Idempotency storage is not configured on the server.",
    );
  }

  const scopedKey = buildScopedIdempotencyKey(routeScope, idempotencyKey);
  const fingerprintKey = `${scopedKey}:fingerprint`;
  const responseKey = `${scopedKey}:response`;
  const processingKey = `${scopedKey}:processing`;
  const fingerprint = requestHash ?? routeScope;

  const cachedFingerprint = await ensureFingerprint(
    store,
    fingerprintKey,
    fingerprint,
  );

  if (cachedFingerprint !== fingerprint) {
    return jsonErrorPayload(
      422,
      "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST",
      "This Idempotency-Key was already used with a different request.",
    );
  }

  const cachedResponse = await readStoredResponse(store, responseKey);

  if (cachedResponse) {
    return cachedResponse;
  }

  const lockAcquired = await store.set(processingKey, "1", {
    exSeconds: IDEMPOTENCY_LOCK_TTL_SECONDS,
    onlyIfAbsent: true,
  });

  if (lockAcquired !== "OK") {
    const inFlightReplay = await readStoredResponse(store, responseKey);

    if (inFlightReplay) {
      return inFlightReplay;
    }

    return jsonErrorPayload(
      409,
      "IDEMPOTENCY_REQUEST_IN_PROGRESS",
      "A request with this Idempotency-Key is already in progress.",
    );
  }

  try {
    const response = await execute();

    await store.set(responseKey, JSON.stringify(response), {
      exSeconds: IDEMPOTENCY_RESPONSE_TTL_SECONDS,
    });

    return response;
  } finally {
    await store.delete(processingKey).catch(() => undefined);
  }
}

export function createRequestHash(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function createIdempotencyStoreFromEnv(
  env = process.env,
  fetchImplementation: typeof fetch = fetch,
) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return createUpstashIdempotencyStore(
    { url, token },
    fetchImplementation,
  );
}

function getIdempotencyKey(request: Request) {
  const headerValue = request.headers.get(IDEMPOTENCY_HEADER)?.trim();

  return headerValue ? headerValue : null;
}

function buildScopedIdempotencyKey(routeScope: string, idempotencyKey: string) {
  return `idempotency:v1:${routeScope}:${idempotencyKey}`;
}

async function ensureFingerprint(
  store: IdempotencyStore,
  fingerprintKey: string,
  fingerprint: string,
) {
  const wasStored = await store.set(fingerprintKey, fingerprint, {
    exSeconds: IDEMPOTENCY_RESPONSE_TTL_SECONDS,
    onlyIfAbsent: true,
  });

  if (wasStored === "OK") {
    return fingerprint;
  }

  return store.get(fingerprintKey);
}

async function readStoredResponse(
  store: IdempotencyStore,
  responseKey: string,
): Promise<IdempotencyStoredResponse | null> {
  const storedResponse = await store.get(responseKey);

  if (!storedResponse) {
    return null;
  }

  return JSON.parse(storedResponse) as IdempotencyStoredResponse;
}

function createUpstashIdempotencyStore(
  config: UpstashConfig,
  fetchImplementation: typeof fetch,
): IdempotencyStore {
  return {
    async delete(key) {
      await runUpstashCommand(fetchImplementation, config, ["DEL", key]);
    },
    async get(key) {
      return runUpstashCommand<string | null>(fetchImplementation, config, [
        "GET",
        key,
      ]);
    },
    async set(key, value, options) {
      const command = ["SET", key, value];

      if (options?.onlyIfAbsent) {
        command.push("NX");
      }

      if (options?.exSeconds) {
        command.push("EX", String(options.exSeconds));
      }

      return runUpstashCommand<"OK" | null>(
        fetchImplementation,
        config,
        command,
      );
    },
  };
}

async function runUpstashCommand<T>(
  fetchImplementation: typeof fetch,
  { token, url }: UpstashConfig,
  command: string[],
) {
  const response = await fetchImplementation(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  const payload = (await response.json()) as {
    error?: string;
    result?: T;
  };

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? "Upstash idempotency request failed.");
  }

  return payload.result ?? null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right),
  );

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}
