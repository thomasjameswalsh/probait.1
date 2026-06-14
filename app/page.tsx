'use client';

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { PostcodeDistrictRow } from "@/lib/types/postcode-types";
import { validatePostcodeDistrict } from "@/lib/utils/postcode-format";

const PostcodeMap = dynamic(
    () => import('@/components/map/postcode-map'),
    { ssr: false }
);

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
    neighbourRows: PostcodeDistrictRow[]
): PostcodeDistrictRow[] {
    const existingDistricts = new Set<string>([
        ...selectedRows.map((row) => row.district_norm),
        ...neighbourRows.map((row) => row.district_norm),
    ]);

    return target.filter((row) => {
        return !existingDistricts.has(row.district_norm);
    });
}


/***********************************/


export default function HomePage() {
    const [input, setInput] = useState("");
    const [postcodesData, setPostcodesData] = useState<PostcodeDistrictRow[]>([]);
    const [neighboursData, setNeighboursData] = useState<PostcodeDistrictRow[]>([]);
    const [errorMessage, setErrorMessage] = useState<string>("");

    const postcodesDataRef = useRef<PostcodeDistrictRow[]>([]);
    const neighboursDataRef = useRef<PostcodeDistrictRow[]>([]);
    const isUpdatingMapRef = useRef(false);

    useEffect(() => {
        postcodesDataRef.current = postcodesData;
    }, [postcodesData]);

    useEffect(() => {
        neighboursDataRef.current = neighboursData;
    }, [neighboursData]);


    function commitMapData(nextMapData: NextMapData): void {
        postcodesDataRef.current = nextMapData.nextPostcodesData;
        neighboursDataRef.current = nextMapData.nextNeighboursData;

        setPostcodesData(nextMapData.nextPostcodesData);
        setNeighboursData(nextMapData.nextNeighboursData);
    }


    async function fetchPostcodeDistrictRow(
        district_norm: string
    ): Promise<PostcodeDistrictRow | null> {
        const response = await fetch(
            `/api/postcode?district=${encodeURIComponent(district_norm)}`
        );

        if (!response.ok) {
            const errorBody = await response.json();
            const errorMessage = errorBody?.error;

            if (response.status >= 500) {
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

            if (response.status === 404) {
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

        if (!response.ok) {
            const errorBody = await response.json();
            const errorMessage = errorBody?.error;

            if (response.status >= 500) {
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


    async function fetchAndMergeNeighbourDistricts(
        district_norm: string,
        selectedRows: PostcodeDistrictRow[],
        neighbourRows: PostcodeDistrictRow[]
    ): Promise<PostcodeDistrictRow[]> {
        const districtNeighbourRows = await fetchNeighbourRows(district_norm);

        if (!districtNeighbourRows) {
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
        if (hasDistrict(selectedRows, neighbour.district_norm)) {
            console.error("promote neighbour called with a selected district:", {
                district_norm: neighbour.district_norm,
            });

            return {
                nextPostcodesData: selectedRows,
                nextNeighboursData: neighbourRows,
            };
        }

        if (!hasDistrict(neighbourRows, neighbour.district_norm)) {
            console.error("promote neighbour called with district not in neighbour list:", {
                district_norm: neighbour.district_norm,
                selectedRows: selectedRows.map((row) => row.district_norm),
                neighbourRows: neighbourRows.map((row) => row.district_norm),
            });

            return {
                nextPostcodesData: selectedRows,
                nextNeighboursData: neighbourRows,
            };
        }

        let nextNeighboursData: PostcodeDistrictRow[] = removeDistrict(
            neighbour.district_norm,
            neighbourRows
        );

        const nextPostcodesData: PostcodeDistrictRow[] = [
            neighbour,
            ...selectedRows
        ];

        nextNeighboursData = await fetchAndMergeNeighbourDistricts(
            neighbour.district_norm,
            nextPostcodesData,
            nextNeighboursData
        );

        return {
            nextPostcodesData,
            nextNeighboursData,
        };
    }


    async function addNewPostcodeToMap(
        district_norm: string,
        selectedRows: PostcodeDistrictRow[],
        neighbourRows: PostcodeDistrictRow[]
    ): Promise<NextMapData> {
        const postcodeResponseData = await fetchPostcodeDistrictRow(district_norm);

        if (!postcodeResponseData) {
            return {
                nextPostcodesData: selectedRows,
                nextNeighboursData: neighbourRows
            };
        }

        const nextPostcodesData: PostcodeDistrictRow[] = [
            ...selectedRows,
            postcodeResponseData
        ];

        const nextNeighboursData = await fetchAndMergeNeighbourDistricts(
            district_norm,
            nextPostcodesData,
            neighbourRows
        );

        return {
            nextPostcodesData,
            nextNeighboursData
        };
    }


    async function handleMapNeighbourClick(
        neighbour: PostcodeDistrictRow
    ): Promise<void> {
        if (isUpdatingMapRef.current) {
            return;
        }

        isUpdatingMapRef.current = true;

        try {
            const result: NextMapData = await promoteNeighbourToSelected(
                neighbour,
                postcodesDataRef.current,
                neighboursDataRef.current
            );

            commitMapData(result);
        } finally {
            isUpdatingMapRef.current = false;
        }
    }


    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (isUpdatingMapRef.current) {
            return;
        }

        isUpdatingMapRef.current = true;

        try {
            setErrorMessage("");

            const validationResult = validatePostcodeDistrict(input);

            if (!validationResult.ok) {
                setErrorMessage(validationResult.error);
                return;
            }

            const district_norm = validationResult.value;
            setInput(district_norm);

            const currentPostcodesData = postcodesDataRef.current;
            const currentNeighboursData = neighboursDataRef.current;

            const inSelected = findDistrict(currentPostcodesData, district_norm);

            if (inSelected) {
                setErrorMessage("District already added to list.");
                return;
            }

            let result: NextMapData;

            const findInNeighbours = findDistrict(currentNeighboursData, district_norm);

            if (findInNeighbours) {
                result = await promoteNeighbourToSelected(
                    findInNeighbours,
                    currentPostcodesData,
                    currentNeighboursData
                );
            } else {
                result = await addNewPostcodeToMap(
                    district_norm,
                    currentPostcodesData,
                    currentNeighboursData
                );
            }

            setInput("");
            commitMapData(result);
        } finally {
            isUpdatingMapRef.current = false;
        }
    }


    return (
        <div className="p-6">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold">Thomas' Postcode Districts Map</h1>
                <p className="text-sm text-muted-foreground">
                    Select postcode districts
                </p>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle>List Postcode Districts</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <Field orientation="horizontal">
                                <Input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="e.g. CM21"
                                    maxLength={12}
                                />
                                <Button type="submit">Add</Button>
                            </Field>
                        </form>

                        {errorMessage && (
                            <p className="text-sm text-red-600 mt-1">
                                {errorMessage}
                            </p>
                        )}

                        <Separator />

                        <div className="flex flex-wrap gap-2">
                            {postcodesData.map((postcodeData) => (
                                <div
                                    key={postcodeData.district_norm}
                                    className="flex items-center justify-between gap-2 min-w-[100px] rounded-md border px-3 py-1"
                                >
                                    <div className="min-w-[40px]">
                                        <span>{postcodeData.district_norm}</span>
                                    </div>

                                    <Separator orientation="vertical" />

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            const updatedPostcodesData = postcodesData.filter(
                                                (p: PostcodeDistrictRow) => {
                                                    return p.district_norm !== postcodeData.district_norm;
                                                }
                                            );

                                            const nextMapData: NextMapData = {
                                                nextPostcodesData: updatedPostcodesData,
                                                nextNeighboursData: neighboursData,
                                            };

                                            commitMapData(nextMapData);
                                        }}
                                        className="h-5 w-5 hover:bg-red-500 hover:text-white transition"
                                    >
                                        ✕
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="h-[75vh] min-h-[700px] w-full">
                    <PostcodeMap
                        postcodesData={postcodesData}
                        neighboursData={neighboursData}
                        onNeighbourClick={handleMapNeighbourClick}
                    />
                </div>
            </div>
        </div>
    );
}