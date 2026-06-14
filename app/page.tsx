'use client';

import { useState } from "react";
import dynamic from "next/dynamic";

import { PostcodeDistrictRow } from "@/lib/types/postcode-types";
import { GeojsonFeature } from "@/lib/types/geojson-types";

import { validatePostcodeDistrict } from "@/lib/utils/postcode-format";

const PostcodeMap = dynamic(
    () => import('@/components/map/postcode-map'),
    { ssr: false }
);

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import {validateTurboNextConfig} from "next/dist/lib/turbopack-warning";


/************************************/


type NextMapData = {
    nextPostcodesData: PostcodeDistrictRow[];
    nextNeighboursData: PostcodeDistrictRow[];
};


/************************************/


function hasDistrict(
    rows: PostcodeDistrictRow[],
    district: string
): boolean {
    return rows.some((row) => row.district_norm === district);
}


function findDistrict(
    rows: PostcodeDistrictRow[],
    district: string
): PostcodeDistrictRow | undefined {
    return rows.find((row) => row.district_norm === district);
}


function removeDistrict(
    district: string,
    rows: PostcodeDistrictRow[]
): PostcodeDistrictRow[] {
    return rows.filter((row) => row.district_norm !== district);
}


function filterDuplicatePostcodes(
    target: PostcodeDistrictRow[],
    selectedRows: PostcodeDistrictRow[],
    neighbourRows: PostcodeDistrictRow[]) {
    const existingDistricts = new Set<string>([
        ...selectedRows.map((row) => row.district_norm),
        ...neighbourRows.map((row) => row.district_norm),
    ]);

    return target.filter((row) => {
        return ! existingDistricts.has(row.district_norm);
    });
}


/***********************************/


export default function HomePage() {
    const [input, setInput] = useState("");
    const [postcodesData, setPostcodesData] = useState<PostcodeDistrictRow[]>([]);
    const [neighboursData, setNeighboursData] = useState<PostcodeDistrictRow[]>([]);
    const [errorMessage, setErrorMessage] = useState<string>("");

    async function fetchPostcodeDistrictRow(
        district_norm: string
    ): Promise<PostcodeDistrictRow | null> {
        const response = await fetch(
            `/api/postcode?district=${encodeURIComponent(district_norm)}`
        );

        if ( ! response.ok ) {
            const errorBody = await response.json()
            const errorMessage = errorBody?.error;

            if ( response.status >= 500 ) {
                console.error("Fetch postcode server error:", {
                    status: response.status,
                    message: errorMessage
                });
            } else {
                console.warn("Fetch postcode issue:", {
                    status: response.status,
                    message: errorMessage
                });
            }
            if ( response.status === 404 ) {
                setErrorMessage("Postcode not found.");
            } else {
                setErrorMessage(`${errorMessage ?? "Something went wrong."} (${response.status})`);
            }

            return null;
        }

        return await response.json() as PostcodeDistrictRow;
    }


    async function fetchAndMergeNeighbourDistricts(
        district_norm: string,
        selectedRows: PostcodeDistrictRow[],
        neighbourRows: PostcodeDistrictRow[]
    ): Promise<PostcodeDistrictRow[]> {
        const districtNeighbourRows = await fetchNeighbourRows(district_norm);

        if ( ! districtNeighbourRows ) {
            return neighbourRows;
        }

        const filteredNeighbourRows = filterDuplicatePostcodes(
            districtNeighbourRows,
            selectedRows,
            neighbourRows
        );

        return [
            ...neighbourRows,
            ...filteredNeighbourRows
        ];
    }


    async function promoteNeighbourToSelected(
        neighbour: PostcodeDistrictRow,
        selectedRows: PostcodeDistrictRow[],
        neighbourRows: PostcodeDistrictRow[]
    ): Promise<NextMapData> {
        let nextNeighboursData: PostcodeDistrictRow[]
            = removeDistrict(neighbour.district_norm, neighbourRows)

        const nextPostcodesData: PostcodeDistrictRow[] = [neighbour, ...selectedRows];
        nextNeighboursData =
            await fetchAndMergeNeighbourDistricts(
                neighbour.district_norm,
                nextPostcodesData,
                nextNeighboursData);

        const result: NextMapData = { nextPostcodesData, nextNeighboursData };
        return result;
    }

    async function handleMapNeighbourClick(
        neighbour: PostcodeDistrictRow
    ): Promise<void> {
        const result: NextMapData =
            await promoteNeighbourToSelected(
                neighbour,
                postcodesData,
                neighboursData
            );

        setPostcodesData(result.nextPostcodesData);
        setNeighboursData(result.nextNeighboursData);
    }


    async function fetchNeighbourRows(
        district_norm: string
    ): Promise<PostcodeDistrictRow[] | null> {
        const response = await fetch(
            `/api/neighbours?district=${encodeURIComponent(district_norm)}`
        );

        if ( ! response.ok ) {
            const errorBody = await response.json()
            const errorMessage = errorBody?.error;

            if ( response.status >= 500 ) {
                console.error("Fetch neighbours server error:", {
                    status: response.status,
                    message: errorMessage
                });
            } else {
                console.warn("Fetch neighbours issue:", {
                    status: response.status,
                    message: errorMessage
                });
            }

            setErrorMessage(
                `${errorMessage ?? "Something went wrong."} (status code ${response.status})`
            );

            return null;
        }

        return await response.json() as PostcodeDistrictRow[];
    }

    async function addNewPostcodeToMap(
        district_norm: string,
        selectedRows: PostcodeDistrictRow[],
        neighbourRows: PostcodeDistrictRow[]
    ): Promise<NextMapData> {
        const postcodeResponseData = await fetchPostcodeDistrictRow(district_norm);
        if ( ! postcodeResponseData ) {
            return { nextPostcodesData: selectedRows, nextNeighboursData: neighbourRows};
        }
        const nextPostcodesData = [...neighbourRows, postcodeResponseData];

        const neighboursResponseData = await fetchNeighbourRows(district_norm);
        if ( ! neighboursResponseData ) {
            return { nextPostcodesData: nextPostcodesData, nextNeighboursData: neighbourRows };
        }
        const nextNeighboursData = [...neighboursResponseData, ...neighbourRows];

        return { nextPostcodesData: nextPostcodesData, nextNeighboursData: nextNeighboursData };
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setErrorMessage("");

        const validationResult = validatePostcodeDistrict(input);
        if ( ! validationResult.ok ) {
            setErrorMessage(validationResult.error);
            return;
        }

        const normalised = validationResult.value;
        setInput(normalised);

        const inSelected = postcodesData.some((row) => row.district_norm === normalised);
        if ( inSelected ) {
            setErrorMessage("District already added to list.");
            return;
        }

        let nextPostcodesData: PostcodeDistrictRow[] = postcodesData;
        let nextNeighboursData: PostcodeDistrictRow[] = neighboursData;

        const findInNeighbours = neighboursData.find((row) => row.district_norm === normalised);
        if ( findInNeighbours ) {
            const result: NextMapData = await promoteNeighbourToSelected(
                findInNeighbours,
                nextPostcodesData,
                nextNeighboursData);

            nextPostcodesData = result.nextPostcodesData;
            nextNeighboursData = result.nextNeighboursData;
        } else {
            const result: NextMapData = await addNewPostcodeToMap(
                normalised,
                nextPostcodesData,
                nextNeighboursData
            );

            nextPostcodesData = result.nextPostcodesData;
            nextNeighboursData = result.nextNeighboursData;
        }

        setInput("");
        setPostcodesData(nextPostcodesData);
        setNeighboursData(nextNeighboursData);
    }

    return (
        <div className = "p-6">

            <div className = "space-y-1">
                <h1 className = "text-2xl font-bold">Thomas' Postcode Districts Map</h1>
                <p className = "text-sm text-muted-foreground">
                    Select postcode districts
                </p>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
                <Card className = "h-fit">
                    <CardHeader>
                        <CardTitle>List Postcode Districts</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <form onSubmit = {handleSubmit} className = "space-y-3">
                            <Field orientation="horizontal">
                                <Input
                                    value = {input}
                                    onChange = {(e) => setInput(e.target.value)}
                                    placeholder = "e.g. CM21"
                                    maxLength={12}
                                />
                                <Button type = "submit">Add</Button>
                            </Field>
                        </form>

                        {errorMessage && <p className = "text-sm text-red-600 mt-1">{errorMessage}</p>}

                        <Separator />

                        <div className = "flex flex-wrap gap-2">
                            {postcodesData.map((postcodeData, _index) => (
                                <div
                                    key = {postcodeData.district_norm}
                                    className="flex items-center justify-between gap-2 min-w-[100px] rounded-md border px-3 py-1">

                                    <div className = "min-w-[40px]">
                                        <span>{postcodeData.district_norm}</span>
                                    </div>

                                    <Separator orientation="vertical" />

                                    <Button
                                        type="button"
                                        variant = "ghost"
                                        size = "icon"
                                        onClick={() => {
                                            const updatedPostcodesData = postcodesData.filter(
                                                (p: PostcodeDistrictRow) => p.district_norm !== postcodeData.district_norm
                                            );
                                            setPostcodesData(updatedPostcodesData);
                                        }}
                                        className="h-5 w-5 hover:bg-red-500 hover:text-white transition"
                                    >✕</Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <div className = "h-[75vh] min-h-[700px] w-full">
                    <PostcodeMap
                        postcodesData = {postcodesData}
                        neighboursData = {neighboursData}
                    ></PostcodeMap>
                </div>
            </div>
        </div>
    );
}