import { describe, expect, it } from "vitest";

import { authorizeCronRequest } from "@/lib/api/cron";

describe("cron authorization helper", () => {
  it("returns a server error when CRON_SECRET is missing", () => {
    const request = new Request("http://localhost:3000/api/cron/release-expired");

    expect(authorizeCronRequest(request, "")).toEqual({
      ok: false,
      status: 500,
      code: "CRON_SECRET_MISSING",
      message: "CRON_SECRET is not configured on the server.",
    });
  });

  it("rejects missing or invalid bearer tokens", () => {
    const missingHeaderRequest = new Request(
      "http://localhost:3000/api/cron/release-expired",
    );
    const invalidHeaderRequest = new Request(
      "http://localhost:3000/api/cron/release-expired",
      {
        headers: {
          Authorization: "Bearer wrong-secret",
        },
      },
    );

    expect(authorizeCronRequest(missingHeaderRequest, "super-secret")).toEqual({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Cron authorization is required.",
    });
    expect(authorizeCronRequest(invalidHeaderRequest, "super-secret")).toEqual({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Cron authorization is required.",
    });
  });

  it("accepts a matching bearer token", () => {
    const request = new Request(
      "http://localhost:3000/api/cron/release-expired",
      {
        headers: {
          Authorization: "Bearer super-secret",
        },
      },
    );

    expect(authorizeCronRequest(request, "super-secret")).toEqual({
      ok: true,
    });
  });
});
