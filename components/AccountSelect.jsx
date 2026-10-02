import { KINDS } from "@/lib/defaults";

export default function AccountSelect({ accounts, value, onChange, allowBlank, ...rest }) {
  const known = accounts.some((a) => a.name === value);
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)} {...rest}>
      {allowBlank && <option value="">（選択）</option>}
      {value && !known && <option value={value}>{value}（未登録）</option>}
      {KINDS.map((k) => {
        const list = accounts.filter((a) => a.kind === k);
        if (!list.length) return null;
        return <optgroup key={k} label={k}>{list.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}</optgroup>;
      })}
    </select>
  );
}

export function TaxSelect({ taxes, value, onChange, ...rest }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)} {...rest}>
      {value && !taxes.includes(value) && <option value={value}>{value}</option>}
      {taxes.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}
