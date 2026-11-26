"use client";

import { Pagination } from "flowbite-react";

interface TablePaginationFooterProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  className?: string;
}

export default function TablePaginationFooter({
  currentPage,
  pageSize,
  totalCount,
  onPageChange,
  isLoading = false,
  className = "",
}: TablePaginationFooterProps) {
  const safeTotalCount = Math.max(0, Math.floor(totalCount));
  const safePageSize = Math.max(1, Math.floor(pageSize));

  if (safeTotalCount === 0) return null;

  const totalPages = Math.ceil(safeTotalCount / safePageSize);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const firstItem = (safeCurrentPage - 1) * safePageSize + 1;
  const lastItem = Math.min(safeCurrentPage * safePageSize, safeTotalCount);

  return (
    <div
      className={`flex flex-col items-center justify-between gap-4 sm:flex-row ${
        isLoading ? "pointer-events-none opacity-50" : ""
      } ${className}`}
    >
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Showing <span className="font-semibold text-gray-900 dark:text-white">{firstItem}</span> to{" "}
        <span className="font-semibold text-gray-900 dark:text-white">{lastItem}</span> of{" "}
        <span className="font-semibold text-gray-900 dark:text-white">{safeTotalCount}</span> entries
      </span>

      {totalPages > 1 && (
        <Pagination
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          showIcons
        />
      )}
    </div>
  );
}