import { pool } from '@/lib/db/db';
import { NextRequest, NextResponse } from 'next/server';

import type { PostcodeDistrictRow } from "@/lib/types/postcode-types";
import { validatePostcodeDistrict } from "@/lib/utils/postcode-format";

import { GET_POSTCODE_NEIGHBOURS_QUERY } from "@/db/queries/postcodes/GET_POSTCODE_NEIGHBOURS";


export async function GET(request: NextRequest) {
    const district = request.nextUrl.searchParams.get("district");
    const validationResult = validatePostcodeDistrict(district);
    if ( ! validationResult.ok ) {
        return NextResponse.json(
            { error: validationResult.error },
            { status: 400 }
        );
    }

    const normalisedDistrict = validationResult.value;
    try {
        const queryResult = await pool.query<PostcodeDistrictRow>(
            GET_POSTCODE_NEIGHBOURS_QUERY,
            [normalisedDistrict]);

        if ( queryResult.rows.length === 0 ) {
            return NextResponse.json(
                { error: "No neighbouring postcodes found." },
                { status: 404 }
            );
        }

        return NextResponse.json(queryResult.rows);
    } catch (error) {
        console.error("Failed to fetch postcode neighbours:\n", error);

        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}