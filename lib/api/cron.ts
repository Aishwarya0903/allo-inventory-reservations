import { timingSafeEqual } from "node:crypto";

type CronAuthorizationResult =
  | { ok: true }
  | {
      ok: false;
      status: 500 | 401;
      code: "CRON_SECRET_MISSING" | "UNAUTHORIZED";
      message: string;
    };

const CRON_AUTHORIZATION_ERROR_MESSAGE = "Cron authorization is required.";

export function authorizeCronRequest(
  request: Request,
  cronSecret = process.env.CRON_SECRET,
): CronAuthorizationResult {
  if (!cronSecret) {
    return {
      ok: false,
      status: 500,
      code: "CRON_SECRET_MISSING",
      message: "CRON_SECRET is not configured on the server.",
    };
  }

  const authorizationHeader = request.headers.get("authorization");

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return unauthorizedCronRequest();
  }

  const suppliedSecret = authorizationHeader.slice("Bearer ".length);

  if (!timingSafeSecretMatch(suppliedSecret, cronSecret)) {
    return unauthorizedCronRequest();
  }

  return { ok: true };
}

function unauthorizedCronRequest(): CronAuthorizationResult {
  return {
    ok: false,
    status: 401,
    code: "UNAUTHORIZED",
    message: CRON_AUTHORIZATION_ERROR_MESSAGE,
  };
}

function timingSafeSecretMatch(suppliedSecret: string, expectedSecret: string) {
  const suppliedBuffer = Buffer.from(suppliedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (suppliedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(suppliedBuffer, expectedBuffer);
}
