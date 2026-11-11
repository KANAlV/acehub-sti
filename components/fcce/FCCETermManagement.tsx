"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TextInput,
  Pagination,
  Spinner,
  Card,
} from "flowbite-react";
import { HiSearch, HiX, HiChevronRight } from "react-icons/hi";
import { FaSortUp, FaSortDown } from "react-icons/fa6";

import { fetchAcademicYears, AcademicYearRecord } from "@/app/actions/system";

export default function FCCETermManagement() {
  const router = useRouter();

  const [academicYears, setAcademicYears] = useState<AcademicYearRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [maxRow] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>("ay_sem");
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("DESC");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadAcademicYearsData = useCallback(() => {
    startTransition(async () => {
      setIsLoading(true);
      const res = await fetchAcademicYears(
        debouncedSearch || null,
        sortBy,
        sortDir,
        50,
        1,
      );
      if (res?.success && Array.isArray(res.data)) {
        setAcademicYears(res.data);
      } else {
        setAcademicYears([]);
      }
      setIsLoading(false);
    });
  }, [debouncedSearch, sortBy, sortDir]);

  useEffect(() => {
    loadAcademicYearsData();
  }, [loadAcademicYearsData]);

  const handleSorting = (column: string) => {
    startTransition(() => {
      if (sortBy === column) {
        setSortDir((prev) => (prev === "ASC" ? "DESC" : "ASC"));
      } else {
        setSortBy(column);
        setSortDir("ASC");
      }
      setCurrentPage(1);
    });
  };

  const navigateToDetail = (aySem: string) => {
    router.push(`/fcce/${encodeURIComponent(aySem)}`);
  };

  const paginatedYears = academicYears.slice(
    (currentPage - 1) * maxRow,
    currentPage * maxRow,
  );

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1 text-lg font-bold">
          Academic Terms / Semesters Directory
        </h2>
        <p className="text-gray-500">
          Select an academic year or semester term to view all associated
          student FCCE records.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="relative w-full md:w-64">
          <TextInput
            id="search-ay-sem"
            type="text"
            placeholder="Search academic term..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={HiSearch}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
            >
              <HiX className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <Card className="overflow-x-auto">
        <Table hoverable>
          <TableHead>
            <TableRow>
              <TableHeadCell onClick={() => handleSorting("ay_sem")}>
                <div className="flex cursor-pointer text-blue-500 hover:underline">
                  Academic Year / Semester{" "}
                  {sortBy === "ay_sem" &&
                    (sortDir === "ASC" ? (
                      <FaSortUp className="ml-1" />
                    ) : (
                      <FaSortDown className="ml-1" />
                    ))}
                </div>
              </TableHeadCell>
              <TableHeadCell className="w-16">
                <span className="sr-only">Details</span>
              </TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody className="divide-y">
            {paginatedYears.length > 0 ? (
              paginatedYears.map((item) => (
                <TableRow
                  key={item.ay_sem}
                  className="cursor-pointer bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                  onClick={() => navigateToDetail(item.ay_sem)}
                >
                  <TableCell className="font-mono font-bold text-gray-900 dark:text-white">
                    {item.ay_sem}
                  </TableCell>
                  <TableCell className="text-right">
                    <HiChevronRight className="h-5 w-5 text-gray-400" />
                  </TableCell>
                </TableRow>
              ))
            ) : isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="py-6 text-center text-gray-500 italic"
                >
                  <div className="flex items-center justify-center">
                    <Spinner size="sm" />
                    <span className="ml-3">Loading terms...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="py-6 text-center text-gray-500 italic"
                >
                  No academic terms found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-4 flex justify-center">
        <Pagination
          layout="pagination"
          currentPage={currentPage}
          totalPages={Math.ceil(academicYears.length / maxRow) || 1}
          onPageChange={(p) => setCurrentPage(p)}
          showIcons
        />
      </div>
    </div>
  );
}
