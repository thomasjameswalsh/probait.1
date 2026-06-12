type validatePostcodeDistrictReturnType =
    | {
    ok: true;
    value: string;
}
    | {
    ok: false;
    error: string;
};

const POSTCODE_DISTRICT_PATTERN =
    /^[A-Z]{1,2}([0-9]{1,2}|[0-9][A-Z])$/;

const EMPTY_POSTCODE_ERROR: validatePostcodeDistrictReturnType = {
    ok: false as const,
    error: "Please enter a postcode.",
};

const INVALID_POSTCODE_ERROR: validatePostcodeDistrictReturnType = {
    ok: false as const,
    error: "Invalid postcode district format.",
};

export function normalisePostcodeDistrict(input: string): string {
    return input
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
}

export function isValidPostcodeDistrict(input: string): boolean {
    return POSTCODE_DISTRICT_PATTERN.test(input);
}

export function validatePostcodeDistrict(input: string): validatePostcodeDistrictReturnType
{
    if ( ! input.trim() ) {
        return EMPTY_POSTCODE_ERROR;
    }

    const district_norm = normalisePostcodeDistrict(input);
    if ( ! district_norm || ! isValidPostcodeDistrict(district_norm) ) {
        return INVALID_POSTCODE_ERROR;
    }

    return { ok: true, value: district_norm };
}
