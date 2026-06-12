import type { GeojsonFeature } from "@/lib/types/geojson-types";

export type PostcodeDistrictRow = {
    district_norm: string;
    feature: GeojsonFeature;
};