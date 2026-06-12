// This script evaluates the GEO-JSON data source

// The data was put together carefully and should be clean
// However, there are x invalid geometries due to overlapping boundaries
// PostGIS detects this and must repair in the database for technical correctness

import fs from 'fs/promises';
import path from 'path';

function normalizeDistrict(input: string) {
    return String(input).trim().toUpperCase().replace(/\s+/g, "");
}

function followsDistrictPattern(districtCode: string) {
    return /^[A-Z]{1,2}[0-9]{1,2}[A-Z]?$/.test(districtCode);
}

let seen = new Map<string, { index: number, name: string }>();
let missingName: number[] = [];
let invalidName: { index: number, name: string }[] = [];
let duplicated: {
    firstSeen: {
        index: number,
        name: string
    },
    duplicateIndex: number,
    duplicateName: string
}[] = [];
let missingGeometry: { index: number, name: string }[] = [];
let missingCoordinates: { index: number, name: string}[] = [];

async function main() {
    const filePath = path.join(process.cwd(), "db/data/PostcodeDistrictsPolygons_multi.json");
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw);

    for ( let i = 0; i < data.features.length; i++ ) {
        const feature = data.features[i];

        const props = feature.properties ?? {};
        const rawDistrictCode = props.name;
        if ( rawDistrictCode == null || rawDistrictCode.trim() === "") {
            missingName.push(i);
            continue;
        }

        const normDistrictCode = normalizeDistrict(rawDistrictCode);
        if ( ! followsDistrictPattern(normDistrictCode) ) {
            invalidName.push({index: i, name: rawDistrictCode});
            continue;
        }

        if ( seen.has(normDistrictCode) ) {
            duplicated.push({
                firstSeen: seen.get(normDistrictCode)!,
                duplicateIndex: i,
                duplicateName: rawDistrictCode,
            });
            continue;
        }

        seen.set(normDistrictCode, { index: i, name: rawDistrictCode });

        if ( ! ("geometry" in feature) || feature.geometry == null ) {
            missingGeometry.push({ index: i, name: rawDistrictCode });
            continue;
        }

        if ( ! ("coordinates" in feature.geometry) || feature.geometry.coordinates == null ) {
            missingCoordinates.push({ index: i, name: rawDistrictCode });
        }
    }
}

main().catch((err) => {
    console.error("Operation failed");
    console.error(err);
    process.exit(1);
});


console.log(`Features missing name:\n${missingName}`);
console.log(`Features with invalid name:\n${invalidName}`);
console.log(`Features with missing geometry:\n${missingGeometry}`);
console.log(`Features with missing coordinates:\n${missingCoordinates}`);
console.log(`Features duplicated:\n${duplicated}`);