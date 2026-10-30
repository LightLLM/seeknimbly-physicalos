"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { useSearch, matchesQuery } from "@/components/shell/search-context";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { EmptyState } from "./states";

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
  selectedRowId?: string;
  getRowId?: (row: T) => string;
  initialSorting?: SortingState;
}

export function DataTable<T>({
  data,
  columns,
  pageSize = 10,
  emptyTitle = "No records",
  emptyDescription,
  emptyAction,
  onRowClick,
  selectedRowId,
  getRowId,
  initialSorting = [],
}: DataTableProps<T>) {
  const { query } = useSearch();
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table is not memoizable by the React Compiler
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: query },
    onSortingChange: setSorting,
    globalFilterFn: (row, _columnId, filterValue: string) => matchesQuery(row.original, filterValue),
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-line text-left">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                      className="whitespace-nowrap px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-fg"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? <ArrowUp className="h-3 w-3" /> : sorted === "desc" ? <ArrowDown className="h-3 w-3" /> : null}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  "border-b border-line/60 last:border-0",
                  onRowClick && "cursor-pointer hover:bg-elevated/70",
                  selectedRowId !== undefined && selectedRowId === row.id && "bg-elevated",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2.5 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredCount === 0 ? (
        <EmptyState icon={SearchX} title="No matches" description={`Nothing matches “${query}”. Clear the header search to see all ${data.length} records.`} />
      ) : null}

      {table.getPageCount() > 1 ? (
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-muted">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} · {filteredCount} rows
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" aria-label="Previous page" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" aria-label="Next page" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
