import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

console.log("DATABASE_URL exists: ", !!process.env.DATABASE_URL);
console.log("DATABASE_URL_UNPOOLED exists: ", !!process.env.DATABASE_URL_UNPOOLED);