export interface LegendItem {
  key: string;
  swatchClass: string;
  label: string;
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3.5 gap-y-2.5 px-4 pb-4.5 pt-3">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span aria-hidden className={`size-3.5 border border-line ${item.swatchClass}`} />
          <span className="text-xs text-[#605d5d]">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
