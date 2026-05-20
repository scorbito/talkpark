type SegmentedControlProps = {
  items: string[];
  active?: string;
};

export function SegmentedControl({ items, active = items[0] }: SegmentedControlProps) {
  return (
    <div className="segmented-control">
      {items.map((item) => (
        <button className={item === active ? "segment segment-active" : "segment"} key={item} type="button">
          {item}
        </button>
      ))}
    </div>
  );
}
