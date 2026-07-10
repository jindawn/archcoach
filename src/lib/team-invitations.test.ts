import { describe, expect, test } from "vitest";
import { createInvitationToken, hashInvitationToken, INVITATION_TTL_MS } from "./team-invitations";
describe("team invitations", () => {
  test("uses an unguessable token and stores only a stable hash", () => { const token = createInvitationToken(); expect(token.length).toBeGreaterThan(30); expect(hashInvitationToken(token)).toHaveLength(64); expect(hashInvitationToken(token)).not.toContain(token); });
  test("expires invitations after seven days", () => { expect(INVITATION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1_000); });
});
