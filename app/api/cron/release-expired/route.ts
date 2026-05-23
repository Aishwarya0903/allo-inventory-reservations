import { authorizeCronRequest } from "@/lib/api/cron";
import { jsonData, jsonError } from "@/lib/api/responses";
import { prisma as db } from "@/lib/db/prisma";
import { cleanupExpiredReservations } from "@/lib/domain/reservation-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = authorizeCronRequest(request);

  if (!authorization.ok) {
    return jsonError(
      authorization.status,
      authorization.code,
      authorization.message,
    );
  }

  try {
    const checkedAt = new Date().toISOString();
    const result = await cleanupExpiredReservations(db);

    return jsonData({
      releasedCount: result.releasedCount,
      checkedAt,
    });
  } catch {
    return jsonError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to release expired reservations.",
    );
  }
}
