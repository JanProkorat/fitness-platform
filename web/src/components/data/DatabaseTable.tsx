import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

interface Column<T = Record<string, unknown>> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
  className?: string;
}

interface DatabaseTableProps<T = Record<string, unknown>> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  onAddRow?: () => void;
  addRowLabel?: string;
  renderRowActions?: (row: T) => React.ReactNode;
}

export function DatabaseTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  onAddRow,
  addRowLabel,
  renderRowActions,
}: DatabaseTableProps<T>) {
  const { t } = useTranslation();
  const resolvedAddRowLabel = addRowLabel ?? t('common.addNew');
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left text-xs font-medium text-text3 px-3 py-1.5 border-b border-border whitespace-nowrap cursor-pointer select-none transition-colors duration-100 hover:bg-bg-hover"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
            {renderRowActions && (
              <th className="w-0 border-b border-border" />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn('group', onRowClick && 'cursor-pointer')}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick(row);
                }
              } : undefined}
            >
              {columns.map((col, colIdx) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-3 py-[7px] text-[13px] text-text border-b border-border align-middle group-hover:bg-bg-hover',
                    colIdx === 0 && 'font-medium',
                    col.className,
                  )}
                >
                  {colIdx === 0 ? (
                    <span className="hover:underline">
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </span>
                  ) : col.render ? (
                    col.render(row)
                  ) : (
                    String((row as Record<string, unknown>)[col.key] ?? '')
                  )}
                </td>
              ))}
              {renderRowActions && (
                <td
                  className="px-3 py-[7px] border-b border-border align-middle group-hover:bg-bg-hover"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-100 flex gap-1">
                    {renderRowActions(row)}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {onAddRow && (
        <div
          role="button"
          tabIndex={0}
          className="px-3 py-[7px] text-[13px] text-text3 cursor-pointer flex items-center gap-1.5 border-b border-border transition-colors hover:bg-bg-hover hover:text-text"
          onClick={onAddRow}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onAddRow();
            }
          }}
          aria-label={resolvedAddRowLabel}
        >
          {resolvedAddRowLabel}
        </div>
      )}
    </div>
  );
}
