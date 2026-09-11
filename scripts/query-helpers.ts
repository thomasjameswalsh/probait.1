import type { Client } from "pg";

import type {
    QueryResult,
    QueryResultRow,
} from "pg";


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export function requireOneRow<T extends QueryResultRow>(
    result: QueryResult<T>,
    context: string,
): T {
    const row = result.rows[0];

    if ( ! row || result.rows.length !== 1 ) {
        throw new Error(
            `${context}: expected exactly 1 row, received ${result.rows.length}`,
        );
    }

    return row;
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export function optionalOneRow<T extends QueryResultRow>(
    result: QueryResult<T>,
    context: string,
): T | null {
    if ( result.rows.length > 1 ) {
        throw new Error(
            `${context}: expected at most 1 row, received ${result.rows.length}`,
        );
    }

    return result.rows[0] ?? null;
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


export async function withTransaction<T>(
    client: Client,
    work: (client: Client) => Promise<T>,
): Promise<T> {
    await client.query("BEGIN");

    try {
        const result = await work(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
}


///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\///\\\


