import { loadEnvConfig } from "@next/env";
import fs from "fs/promises";
import path from "path";
import { Client } from "pg";

loadEnvConfig(process.cwd());

const QUERY_POPULATE_POSTCODE_DISTRICTS =
    `
    INSERT INTO postcode_districts (district_norm, feature, geom)
    VALUES (
        $1,
        $2::jsonb,
        ST_SetSRID(
            ST_MULTI(
                ST_GeomFromGeoJSON(
                    ($2::jsonb -> 'geometry')::text
                )
            ),
            4326
        )
    );
    `;

const connectionString = process.env.DATABASE_URL_UNPOOLED;

if ( ! connectionString ) {
    throw new Error("DATABASE_URL_UNPOOLED is missing.");
}

const client = new Client({
  connectionString,
});

function normalisedDistrict(input: string): string {
    return String(input).trim().toUpperCase().replace(/\s+/g, "");
}

async function main(): Promise<void> {
    await client.connect();
    try {
        await client.query("BEGIN");

        const filePath = path.join(
            process.cwd(),
            "db",
            "data",
            "PostcodeDistrictsPolygons_multi.json"
        );
        const raw = await fs.readFile(filePath, "utf8");
        const data = JSON.parse(raw);

        let inserted = 0;
        let failed = 0;
        for (const feature of data.features) {
            const props = feature.properties ?? {};
            const rawDistrictCode = props.name ?? null;

            if (rawDistrictCode == null || String(rawDistrictCode).trim() === "") {
                console.log(`On insertion ${inserted + failed + 1} no property name found.`);
                failed += 1;
                continue;
            }

            const normDistrictCode = normalisedDistrict(rawDistrictCode);

            await client.query(
                QUERY_POPULATE_POSTCODE_DISTRICTS,
                [normDistrictCode, JSON.stringify(feature)]
            );

            inserted += 1;
        }

        await client.query("COMMIT");

        console.log("Population complete");
        console.log(`Inserted ${inserted} records`);
        console.log(`Failed ${failed} records missing district`);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error("Operation failed");
    console.error(err);
    process.exit(1);
});