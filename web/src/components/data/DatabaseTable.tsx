import { cn } from '@/lib/cn';

interface Column<T = any> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
  className?: string;
}

interface DatabaseTableProps<T = any> {
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
  addRowLabel = '+ New',
  renderRowActions,
}: DatabaseTableProps<T>) {
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
            <tr key={rowKey(row)} className="group">
              {columns.map((col, colIdx) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-3 py-[7px] text-[13px] text-text border-b border-border align-middle group-hover:bg-bg-hover',
                    colIdx === 0 && 'font-medium cursor-pointer',
                    col.className,
                  )}
                  onClick={colIdx === 0 && onRowClick ? () => onRowClick(row) : undefined}
                >
                  {colIdx === 0 ? (
                    <span className="hover:underline">
                      {col.render ? col.render(row) : String((row as any)[col.key] ?? '')}
                    </span>
                  ) : col.render ? (
                    col.render(row)
                  ) : (
                    String((row as any)[col.key] ?? '')
                  )}
                </td>
              ))}
              {renderRowActions && (
                <td className="px-3 py-[7px] border-b border-border align-middle group-hover:bg-bg-hover">
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
          className="px-3 py-[7px] text-[13px] text-text3 cursor-pointer flex items-center gap-1.5 border-b border-border transition-colors hover:bg-bg-hover hover:text-text"
          onClick={onAddRow}
        >
          {addRowLabel}
        </div>
      )}
    </div>
  );
}
