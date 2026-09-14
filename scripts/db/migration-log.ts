// Overwrite the file when the runner starts, then append entries as it progresses
// a missing 'FINISH' entry indicates an interrupted run

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inspect } from "node:util";

const LOG_FILE = path.join(process.cwd(), "logs", "migrations", "migrations.log");

function timestamp(): string {
    return new Date().toISOString();
}

export function startMigrationLog(): void {
    mkdirSync(path.dirname(LOG_FILE), { recursive: true });

    writeFileSync(
        LOG_FILE,
        `[${timestamp()}] STARTED migration run\n`,
        "utf8"
    );
}


export function logMigration(message: string, error?: unknown): void {
    const details = error === undefined ? "" : `\n${inspect(error)}`;
    const entry = `[${timestamp()}] ${message} : ${details}`;

    try {
        appendFileSync(LOG_FILE, `${entry}\n`, "utf8");
    } catch ( logError ) {
        console.error("Could not write migration log: ", logError);
    }
}