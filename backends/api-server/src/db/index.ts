import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "./schema.js";

const DB_DIR = process.env.DB_DIR ?? path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "api-server.sqlite");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
export { sqlite };
