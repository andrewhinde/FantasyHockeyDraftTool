function ColumnPicker({ columns, visible, onChange }) {
  return (
    <details className="column-picker">
      <summary>Columns</summary>
      <div className="column-picker-menu">
        {columns.map((col) => {
          const checked = visible.has(col.key);
          const locked = col.key === 'name';
          return (
            <label key={col.key} className="checkbox">
              <input
                type="checkbox"
                checked={checked}
                disabled={locked}
                onChange={(e) => onChange(col.key, e.target.checked)}
              />
              {col.label}
            </label>
          );
        })}
      </div>
    </details>
  );
}

export default ColumnPicker;