import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./index";

// Applies any pending migrations in ./drizzle to the configured database.
migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
