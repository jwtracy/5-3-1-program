import { db } from "@/db";
import { users } from "@/db/schema";
import type { User } from "@/db/schema";

/**
 * The single app user. Multi-user support was removed; this returns the sole
 * `users` row so existing `user_id`-scoped data and queries keep working.
 */
export async function getCurrentUser(): Promise<User> {
  const user = db.select().from(users).orderBy(users.id).get();
  if (!user) throw new Error("No user found — run the seed.");
  return user;
}
