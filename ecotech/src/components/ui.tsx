import {createContext, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Link} from 'react-router-dom';
import {CheckCircle2, Info, X, AlertCircle, type LucideIcon} from 'lucide-react';
export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({variant = 'primary', size, className = '', ...props}: ButtonHTMLAttributes<HTMLButtonElement> & {variant?: Variant; size?: 'sm' | 'lg' | 'small' | 'large'}) {
  return <button className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} {...props}/>;
}
export function LinkButton({to, variant = 'primary', children, className = ''}: {to: string; variant?: Variant; children: ReactNode; className?: string}) {
  return <Link className={`btn btn-${variant} ${className}`} to={to}>{children}</Link>;
}
export function Badge({children, tone = 'muted'}: {children: ReactNode; tone?: 'orange'|'green'|'muted'|'red'}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function PageHeader({title, description, action}: {title: string; description?: string; action?: ReactNode}) {
  return <div className="page-header"><div><h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action && <div className="page-header-action">{action}</div>}</div>;
}
export function MetricCard({label, value, detail, icon: Icon}: {label: string; value: ReactNode; detail?: ReactNode; icon?: LucideIcon}) {
  return <div className="metric-card">{Icon && <span className="metric-icon"><Icon size={19}/></span>}<span className="metric-label">{label}</span><strong className="metric-value">{value}</strong>{detail && <span className="metric-detail">{detail}</span>}</div>;
}
export function EmptyState({title, description, action}: {title: string; description?: string; action?: ReactNode}) {
  return <div className="empty-state"><span className="empty-icon"><Info size={24}/></span><h3>{title}</h3>{description && <p className="muted">{description}</p>}{action}</div>;
}
export function Modal({open, title, onClose, children}: {open: boolean; title: string; onClose: () => void; children: ReactNode}) {
  const content = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => content.current?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex="0"], a')?.focus(), 30);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab' || !content.current) return;
      const items = [...content.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, a[href], [tabindex="0"]')];
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length-1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {clearTimeout(timer); document.body.style.overflow = originalOverflow; document.removeEventListener('keydown', onKey); previous?.focus();};
  }, [open]);
  if (!open) return null;
  return createPortal(<div className="modal-backdrop" onMouseDown={e => {if (e.target === e.currentTarget) onClose();}}><div ref={content} className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fechar janela"><X size={21}/></button></div><div className="modal-body">{children}</div></div></div>, document.body);
}
interface Toast { id: number; message: string; type: 'success'|'error'|'info' }
const ToastContext = createContext<{notify: (message: string, type?: Toast['type']) => void}>({notify: () => {}});
export function ToastProvider({children}: {children: ReactNode}) {
  const [items, setItems] = useState<Toast[]>([]);
  const id = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  function notify(message: string, type: Toast['type'] = 'success') {
    const next = ++id.current;
    setItems(prev => [...prev.slice(-3), {id:next,message,type}]);
    timers.current.push(setTimeout(() => setItems(prev => prev.filter(x => x.id !== next)), 5000));
  }
  return <ToastContext.Provider value={{notify}}>{children}<div className="toast-stack" aria-live="polite">{items.map(x => <div key={x.id} className={`toast toast-${x.type}`}>{x.type === 'error' ? <AlertCircle size={20}/> : x.type === 'success' ? <CheckCircle2 size={20}/> : <Info size={20}/>}<span>{x.message}</span><button onClick={() => setItems(prev => prev.filter(t => t.id !== x.id))} aria-label="Dispensar aviso"><X size={16}/></button></div>)}</div></ToastContext.Provider>;
}
export function useToast() { return useContext(ToastContext); }
