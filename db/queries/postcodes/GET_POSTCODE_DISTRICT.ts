export const GET_POSTCODE_QUERY =
    `
    SELECT district_norm, feature
    FROM postcodes
    WHERE district_norm = $1
    LIMIT 1
`;