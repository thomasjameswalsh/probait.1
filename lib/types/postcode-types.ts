import type { GeojsonFeature } from "@/lib/types/geojson-types";

export type PostcodeRow = {
    district: string;
    district_norm: string;
    feature: GeojsonFeature;
};