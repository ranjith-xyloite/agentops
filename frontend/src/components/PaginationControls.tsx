import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  itemLabel = 'entries',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startEntry = totalItems === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1;
  const endEntry = Math.min(validCurrentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (validCurrentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (validCurrentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', validCurrentPage - 1, validCurrentPage, validCurrentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div
      className="pagination-controls-wrapper"
      style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        fontSize: '12.5px',
        color: 'var(--text-secondary)',
      }}
    >
      {/* Left: Rows Per Page Selector & Counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Rows per page:</span>
          <select
            className="input-field"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              width: '75px',
              height: '30px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <span style={{ color: 'var(--text-muted)' }}>
          Showing <strong>{startEntry}</strong>–<strong>{endEntry}</strong> of <strong>{totalItems}</strong> {itemLabel}
        </span>
      </div>

      {/* Right: Page Navigation Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* First Page */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(1)}
          disabled={validCurrentPage <= 1}
          title="First Page"
          style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronsLeft size={14} />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(validCurrentPage - 1)}
          disabled={validCurrentPage <= 1}
          title="Previous Page"
          style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={14} />
        </button>

        {/* Numbered Page Buttons */}
        <div style={{ display: 'flex', gap: 3, margin: '0 4px' }}>
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} style={{ padding: '4px 6px', color: 'var(--text-muted)' }}>
                  ...
                </span>
              );
            }
            const isCurrent = p === validCurrentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(Number(p))}
                className={`btn btn-sm ${isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  minWidth: '28px',
                  height: '28px',
                  padding: '0 6px',
                  fontSize: '11.5px',
                  fontWeight: isCurrent ? 700 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(validCurrentPage + 1)}
          disabled={validCurrentPage >= totalPages}
          title="Next Page"
          style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronRight size={14} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(totalPages)}
          disabled={validCurrentPage >= totalPages}
          title="Last Page"
          style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
};
