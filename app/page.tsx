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

        const inList = postcodesData.some((row) => row.district_norm === normalised);
        if ( inList ) {
            setErrorMessage("District already added to list.");
            return;
        }

        let nextPostcodesData: PostcodeDistrictRow[] = postcodesData;
        let nextNeighboursData: PostcodeDistrictRow[] = neighboursData;

        const findInNeighbours = neighboursData.find((row) => row.district_norm === normalised);
        if ( findInNeighbours ) {
            nextNeighboursData = nextNeighboursData.filter((row) => row.district_norm !== normalised);
            nextPostcodesData = [...nextPostcodesData, findInNeighbours];
        } else {
            const postcodeResponseData = await fetchPostcodeDistrictRow(normalised);
            if ( ! postcodeResponseData ) return;

            nextPostcodesData = [...nextPostcodesData, postcodeResponseData];
        }
        setInput("");

        const neighboursResponseData = await fetchNeighbourRows(normalised);
        if ( ! neighboursResponseData ) return;

        const filteredNeighbourRows= filterDuplicatePostcodes(
            neighboursResponseData,
            nextPostcodesData,
            nextNeighboursData);
        nextNeighboursData = [...nextNeighboursData, ...filteredNeighbourRows];

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