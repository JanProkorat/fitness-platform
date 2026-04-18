interface ListViewProps<T = unknown> {
  items: T[];
  itemKey: (item: T) => string;
  renderAvatar: (item: T) => React.ReactNode;
  renderInfo: (item: T) => React.ReactNode;
  renderRight?: (item: T) => React.ReactNode;
  renderActions?: (item: T) => React.ReactNode;
  onItemClick?: (item: T) => void;
}

export function ListView<T>({
  items,
  itemKey,
  renderAvatar,
  renderInfo,
  renderRight,
  renderActions,
  onItemClick,
}: ListViewProps<T>) {
  return (
    <div className="border border-border rounded-md overflow-hidden">
      {items.map((item) => (
        <div
          key={itemKey(item)}
          className="group flex items-center gap-3 px-3 py-2 border-b border-border cursor-pointer transition-colors hover:bg-bg-hover"
          onClick={onItemClick ? () => onItemClick(item) : undefined}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0">
            {renderAvatar(item)}
          </div>
          <div className="flex-1 min-w-0">
            {renderInfo(item)}
          </div>
          {renderRight && (
            <div className="flex items-center gap-2.5 shrink-0">
              {renderRight(item)}
            </div>
          )}
          {renderActions && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-100">
              {renderActions(item)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
