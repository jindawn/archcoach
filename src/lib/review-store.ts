import type { ReviewStore } from "@/core/review/orchestrator";
import {
  initRoleReviews,
  listRoleReviews,
  updateRoleReview,
} from "@/db/repositories/roleReviews";
import { updateSession } from "@/db/repositories/sessions";
import type { ReviewSession, RoleReview } from "@/db/schema";

/** drizzle-backed implementation of the core persistence boundary */
export const reviewStore: ReviewStore = {
  async updateSession(sessionId, patch) {
    await updateSession(sessionId, patch as Partial<ReviewSession>);
  },
  async initRoleReviews(sessionId, roleKeys) {
    await initRoleReviews(sessionId, roleKeys);
  },
  async listRoleReviews(sessionId) {
    return listRoleReviews(sessionId);
  },
  async updateRoleReview(sessionId, roleKey, patch) {
    await updateRoleReview(sessionId, roleKey, patch as Partial<RoleReview>);
  },
};
