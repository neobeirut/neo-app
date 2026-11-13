import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Option = { value: string; label: string; disabled: boolean; group: string };
type Props = { children: ReactNode; value: string | number; onValueChange: (value: string) => void; style?: CSSProperties; disabled?: boolean; required?: boolean; 'aria-label': string };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function text(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? text(child.props.children) : String(child)).join('');
}
function optionsFrom(children: ReactNode, group = ''): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; label?: string; disabled?: boolean }>(child)) return [];
    if (child.type === 'option') return [{ value: String(child.props.value ?? text(child.props.children)), label: text(child.props.children), disabled: !!child.props.disabled, group }];
    return optionsFrom(child.props.children, child.type === 'optgroup' ? child.props.label || '' : group);
  });
}

/** A searchable catalog picker; typing never changes the saved selection. */
export default function SearchableSelect({ children, value, onValueChange, style, disabled, required, 'aria-label': label }: Props) {
  const options = useMemo(() => optionsFrom(children), [children]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<CSSProperties>({});
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = options.find(option => option.value === String(value));
  const filtered = options.filter(option => normalize(option.label + ' ' + option.group).includes(normalize(query)));
  const choose = (option: Option) => {
    if (option.disabled || input.current?.matches(':disabled')) return;
    onValueChange(option.value); setOpen(false); setQuery(''); setActive(-1);
  };
  const show = () => {
    if (!input.current || input.current.matches(':disabled')) return;
    const rect = input.current.getBoundingClientRect();
    const above = window.innerHeight - rect.bottom < 240 && rect.top > 240;
    setPosition({ position: 'fixed', left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 320) - 8)), width: Math.min(Math.max(rect.width, 320), window.innerWidth - 16), ...(above ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }), maxHeight: Math.min(320, above ? rect.top - 12 : window.innerHeight - rect.bottom - 12) });
    setQuery(''); setActive(-1); setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => { if (!popup.current?.contains(event.target as Node) && event.target !== input.current) setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', dismiss);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', dismiss, true);
    return () => { document.removeEventListener('mousedown', dismiss); window.removeEventListener('resize', close); window.removeEventListener('scroll', dismiss, true); };
  }, [open]);
  useEffect(() => { if (open && active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, id, open]);
  return <>
    <input ref={input} role="combobox" aria-label={label} aria-expanded={open} aria-controls={open ? id : undefined} aria-autocomplete="list" aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined} aria-required={required} disabled={disabled} autoComplete="off"
      style={{ ...style, minWidth: 0, textOverflow: 'ellipsis' }} value={open ? query : selected?.label || ''} placeholder={open ? 'Type to search…' : 'Search and select…'} title={selected?.label}
      onFocus={show} onClick={() => { if (!open) show(); }} onBlur={() => setOpen(false)}
      onChange={event => { setQuery(event.target.value); setActive(-1); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
        if (event.key === 'Enter') { event.preventDefault(); if (open && active >= 0 && filtered[active]) choose(filtered[active]); else if (!open) show(); return; }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); if (!open) { show(); return; }
          const step = event.key === 'ArrowDown' ? 1 : -1;
          let next = active < 0 ? (step === 1 ? 0 : filtered.length - 1) : active + step;
          while (next >= 0 && next < filtered.length && filtered[next].disabled) next += step;
          if (next >= 0 && next < filtered.length) setActive(next);
        }
      }} />
    {open && createPortal(<div ref={popup} id={id} role="listbox" aria-label={label} style={{ ...position, zIndex: 10000, overflowY: 'auto', background: '#fff', color: '#172033', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 8px 24px #0002', padding: 4 }} onMouseDown={event => event.preventDefault()}>
      {filtered.length === 0 && <div role="status" style={{ padding: 12, color: '#64748b' }}>No matches found.</div>}
      {filtered.map((option, index) => <div key={`${option.value}-${index}`} id={`${id}-${index}`} role="option" aria-selected={option.value === String(value)} aria-disabled={option.disabled} onMouseEnter={() => setActive(index)} onClick={() => choose(option)} style={{ padding: '10px 12px', borderRadius: 4, cursor: option.disabled ? 'not-allowed' : 'pointer', opacity: option.disabled ? 0.45 : 1, background: active === index ? '#e0f2fe' : option.value === String(value) ? '#f0fdf4' : 'transparent', fontSize: 14, whiteSpace: 'normal' }}>
        {option.label}{option.group && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{option.group}</div>}
      </div>)}
    </div>, document.body)}
  </>;
}
