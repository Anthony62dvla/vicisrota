import { requestId } from "./request";

type Level = "info" | "warn" | "error";

/** One JSON line per event, always tagged with the request reference ID. */
export const log = async (level: Level, message: string, data: Record<string, unknown> = {}) => {
  const line = JSON.stringify({ at: new Date().toISOString(), level, message, requestId: await requestId(), ...data });
  if (level === "error") console.error(line);
  else console.log(line);
};
