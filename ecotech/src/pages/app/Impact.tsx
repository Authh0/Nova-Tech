import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, CheckCircle2, Download, FileText, Leaf, Recycle, Scale, Target, Users } from 'lucide-react';
import { useStore } from '../../services/store';
import { Badge, Button, EmptyState, MetricCard, Modal, PageHeader, useToast } from '../../components/ui';
import { downloadText, formatDate, formatNumber, todayISO } from '../../utils';
import type { EnvironmentalRecord } from '../../types';

type Range = 7 | 30 | 90 | 365;

const CO2_FACTOR_DEMO = 1.5;
const number = (value: number) => formatNumber(Math.round(value * 100) / 100, 2);

function shiftDate(date: string, days: number) {
  const value = new Date(`${date.slice(0, 10)}T12:00:00`);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function inRange(date: string, range: Range) {
  const end = todayISO();
  const start = shiftDate(end, -(range - 1));
  const value = date.slice(0, 10);
  return value >= start && value <= end;
}

function dayLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function chartData(records: EnvironmentalRecord[], range: Range) {
  const points = Math.min(range, range <= 30 ? 7 : range <= 90 ? 10 : 12);
  const now = new Date(`${todayISO()}T12:00:00`);
  const buckets = Array.from({ length: points }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (points - 1 - index) * Math.ceil(range / points));
    return { date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, período: dayLabel(date), kg: 0, dispositivos: 0 };
  });
  records.forEach((record) => {
    const index = buckets.findIndex((bucket, bucketIndex) => {
      const next = buckets[bucketIndex + 1];
      return record.date >= bucket.date && (!next || record.date < next.date);
    });
    if (index >= 0) {
      buckets[index].kg += record.weight;
      buckets[index].dispositivos += record.quantity;
    }
  });
  return buckets.map((bucket) => ({ ...bucket, kg: Math.round(bucket.kg * 10) / 10 }));
}

export function ImpactPage() {
  const { state, user, metrics } = useStore();
  const { notify } = useToast();
  const [range, setRange] = useState<Range>(30);
  const [transparencyOpen, setTransparencyOpen] = useState(false);
  const userId = user?.id ?? '';
  const records = useMemo(() => state.records.filter((record) => record.userId === userId && record.validated), [state.records, userId]);
  const filteredRecords = useMemo(() => records.filter((record) => inRange(record.date, range)), [records, range]);
  const previousRecords = useMemo(() => {
    const currentStart = shiftDate(todayISO(), -(range - 1));
    const previousEnd = shiftDate(currentStart, -1);
    const previousStart = shiftDate(previousEnd, -(range - 1));
    return records.filter((record) => record.date.slice(0, 10) >= previousStart && record.date.slice(0, 10) <= previousEnd);
  }, [records, range]);
  const totalKg = filteredRecords.reduce((total, record) => total + record.weight, 0);
  const devices = filteredRecords.reduce((total, record) => total + record.quantity, 0);
  const previousKg = previousRecords.reduce((total, record) => total + record.weight, 0);
  const comparison = previousKg ? ((totalKg - previousKg) / previousKg) * 100 : totalKg ? 100 : 0;
  const campaignCount = state.campaigns.filter((campaign) => campaign.participants.includes(userId) && inRange(campaign.endDate, range)).length;
  const chart = useMemo(() => chartData(filteredRecords, range), [filteredRecords, range]);
  const categories = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredRecords.forEach((record) => grouped.set(record.equipment, (grouped.get(record.equipment) ?? 0) + record.weight));
    return Array.from(grouped, ([categoria, kg]) => ({ categoria, kg: Math.round(kg * 10) / 10 }));
  }, [filteredRecords]);
  const goal = 10;
  const goalProgress = Math.min(100, (totalKg / goal) * 100);

  const exportCsv = () => {
    const rows = [
      ['Data', 'Equipamento', 'Quantidade', 'Peso (kg)', 'Destinação', 'Status'],
      ...filteredRecords.map((record) => [record.date, record.equipment, String(record.quantity), String(record.weight), record.destination, record.validated ? 'Validado' : 'Estimado']),
    ];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(';')).join('\n');
    downloadText(`ecotech-impacto-${range}dias.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
    notify('CSV demonstrativo exportado com sucesso.', 'success');
  };

  if (!user) return <section className="page-stack"><EmptyState title="Entre para visualizar seu impacto" description="As métricas são privadas e vinculadas à conta ativa." /></section>;

  return (
    <section className="page-stack">
      <PageHeader title="Seu impacto vai muito além do descarte" description="Consulte somente registros validados da sua conta e acompanhe sua evolução." action={<Button variant="secondary" onClick={exportCsv}><Download size={16} /> Exportar CSV</Button>} />
      <div className="alert" role="note"><Leaf size={18} /><span>Os dados de CO₂ equivalente nesta demonstração usam fator fixo de 1,5 kg por kg destinado. Trata-se de uma estimativa educativa, não de medição científica ou inventário oficial.</span><Button variant="ghost" onClick={() => setTransparencyOpen(true)}>Ver transparência</Button></div>
      <div className="filter-row" aria-label="Período do impacto">{([7, 30, 90, 365] as Range[]).map((option) => <Button key={option} variant={range === option ? 'primary' : 'ghost'} onClick={() => setRange(option)}>{option === 365 ? '12 meses' : `${option} dias`}</Button>)}</div>
      <div className="cards-grid">
        <MetricCard label="Resíduos no período" value={`${number(totalKg)} kg`} detail={comparison === 0 ? 'sem comparação anterior' : `${comparison > 0 ? '+' : ''}${Math.round(comparison)}% vs. período anterior`} icon={Scale} />
        <MetricCard label="Dispositivos" value={formatNumber(devices)} detail="registros validados" icon={Recycle} />
        <MetricCard label="CO₂e estimado" value={`${number(totalKg * CO2_FACTOR_DEMO)} kg`} detail="fator demonstrativo 1,5" icon={Leaf} />
        <MetricCard label="Participações" value={formatNumber(campaignCount)} detail="campanhas no período" icon={Users} />
      </div>
      <div className="two-column">
        <article className="panel"><div className="panel-header"><div><h2>Evolução no período</h2><p className="muted">O gráfico muda conforme o filtro selecionado.</p></div><CalendarDays size={20} className="muted" /></div><div className="chart-box"><ResponsiveContainer width="100%" height={290}><LineChart data={chart} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9e5df" /><XAxis dataKey="período" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} width={36} /><Tooltip formatter={(value, name) => [name === 'kg' ? `${value} kg` : value, name === 'kg' ? 'Peso' : 'Dispositivos']} /><Legend /><Line type="monotone" dataKey="kg" stroke="#e96925" strokeWidth={2.5} dot={false} name="kg" /><Line type="monotone" dataKey="dispositivos" stroke="#245c49" strokeWidth={2} dot={false} name="dispositivos" /></LineChart></ResponsiveContainer></div></article>
        <article className="panel"><div className="panel-header"><div><h2>Categorias destinadas</h2><p className="muted">Agregado do intervalo escolhido.</p></div><Recycle size={20} className="muted" /></div>{categories.length ? <div className="chart-box"><ResponsiveContainer width="100%" height={290}><BarChart data={categories} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e9e5df" /><XAxis type="number" tickLine={false} axisLine={false} /><YAxis type="category" dataKey="categoria" width={92} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [`${value} kg`, 'Peso']} /><Bar dataKey="kg" fill="#245c49" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="Sem registros neste período" description="Selecione um intervalo maior ou valide um novo descarte." />}</article>
      </div>
      <div className="two-column"><article className="panel goal-panel"><div className="panel-header"><div><h2>Meta do período</h2><p className="muted">Objetivo educativo de 10 kg destinados.</p></div><Target size={20} className="muted" /></div><div className="progress"><span style={{ width: `${goalProgress}%` }} /></div><div className="goal-meta"><strong>{number(totalKg)} de {goal} kg</strong><span>{Math.round(goalProgress)}%</span></div><p className="small muted">Comparação: {previousKg ? `${number(previousKg)} kg no período anterior` : 'ainda sem base anterior'}.</p></article><article className="success-panel"><CheckCircleIcon /><div><strong>Validação antes do impacto</strong><p>Somente registros confirmados por uma operação administrativa entram nos indicadores desta tela. Agendamentos ainda não validados não somam peso, dispositivos ou CO₂e.</p></div></article></div>
      <article className="panel"><div className="panel-header"><div><h2>Histórico de descartes</h2><p className="muted">Registros pessoais do período de {range === 365 ? '12 meses' : `${range} dias`}.</p></div><FileText size={20} className="muted" /></div>{filteredRecords.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Equipamento</th><th>Quantidade</th><th>Peso</th><th>Destinação</th><th>Status</th></tr></thead><tbody>{filteredRecords.sort((a, b) => b.date.localeCompare(a.date)).map((record) => <tr key={record.id}><td>{formatDate(record.date)}</td><td>{record.equipment}</td><td>{formatNumber(record.quantity)}</td><td>{number(record.weight)} kg</td><td>{record.destination}</td><td><Badge tone="green">Validado</Badge></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum descarte no período" description="O histórico aparecerá quando houver um registro validado dentro do filtro escolhido." />}</article>
      <Modal open={transparencyOpen} title="Transparência dos indicadores" onClose={() => setTransparencyOpen(false)}><div className="modal-copy"><p><strong>Validado:</strong> registro administrativo confirmado, usado nos gráficos, metas e histórico.</p><p><strong>Estimado:</strong> CO₂e calculado apenas para fins de demonstração com o fator fixo de 1,5 kg por kg destinado.</p><p><strong>Demonstrativo:</strong> os dados locais ajudam a apresentar a experiência da EcoTech, mas não substituem pesagem certificada, análise de ciclo de vida ou inventário ambiental.</p></div></Modal>
    </section>
  );
}

function CheckCircleIcon() {
  return <span className="success-icon"><CheckCircle2 size={20} /></span>;
}
