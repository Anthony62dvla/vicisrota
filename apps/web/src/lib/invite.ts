import { createHash, randomBytes } from "node:crypto";

/** How long an invitation link works. */
export const INVITE_DAYS = 7;

export const newInviteToken = () => randomBytes(32).toString("base64url");
export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");
