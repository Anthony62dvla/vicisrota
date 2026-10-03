import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";

/** The reference ID for the current request, set by src/proxy.ts. */
export const requestId = async (): Promise<string | null> => {
  const id = (await headers()).get("x-request-id");
  if (id) Sentry.getCurrentScope().setTag("request_id", id);
  return id;
};
