type FilterChipsProps = {
  items: string[];
  active?: string;
};

export function FilterChips({ items, active = items[0] }: FilterChipsProps) {
  return (
    <div className="filter-chips">
      {items.map((item) => (
        <button className={item === active ? "chip chip-active" : "chip"} key={item} type="button">
          {item}
        </button>
      ))}
    </div>
  );
}
