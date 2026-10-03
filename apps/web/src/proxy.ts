import { NextResponse, type NextRequest } from "next/server";

export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Gives every request a short reference ID. It is passed to server code, logged with errors,
 * returned in the response, and shown on error screens so a user can quote it to support.
 */
export function proxy(request: NextRequest) {
  const incoming = request.headers.get(REQUEST_ID_HEADER);
  // Reuse an ID from a trusted load balancer if present, but never pass through anything odd.
  const requestId = incoming && /^[A-Za-z0-9-]{1,64}$/.test(incoming) ? incoming : crypto.randomUUID().slice(0, 8).toUpperCase();
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
