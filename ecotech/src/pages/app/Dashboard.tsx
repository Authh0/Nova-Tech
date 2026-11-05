import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Award,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Cpu,
  Gauge,
  Leaf,
  MapPin,
  Recycle,
  Scale,
  Sparkles,
  Trophy,
  WalletCards,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '../../services/store';
import {
  Badge,
  Button,
  EmptyState,
  LinkButton,
  MetricCard,
  Modal,
  PageHeader,
  useToast,
} from '../../components/ui';
import { formatDate, formatNumber } from '../../utils';
import type { Achievement, Appointment, AppState, EnvironmentalRecord } from '../../types';

const number = (value: number) => formatNumber(Math.round(value * 100) / 100, 2);

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'pessoa';
}

function monthKey(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

function isFutureAppointment(appointment: Appointment) {
  return new Date(`${appointment.date}T${appointment.time || '23:59'}`).getTime() >= Date.now();
}

function scoreFor(records: EnvironmentalRecord[], participationCount: number) {
  const validated = records.filter((record) => record.validated);
  const kg = validated.reduce((total, record) => total + record.weight, 0);
  const devices = validated.reduce((total, record) => total + record.quantity, 0);
  return Math.min(1000, kg * 4 + devices * 2 + participationCount * 10);
}

function progressForAchievement(achievement: Achievement, kg: number, devices: number, participations: number) {
  const text = `${achievement.title} ${achievement.criteria}`.toLowerCase();
  if (text.includes('10 kg') || text.includes('10kg')) return Math.min(1, kg / 10);
  if (text.includes('10 dispositivo')) return Math.min(1, devices / 10);
  if (text.includes('campanha') || text.includes('particip')) return Math.min(1, participations);
  if (text.includes('primeiro') || text.includes('descarte')) return devices > 0 ? 1 : 0;
  return 0;
}

function appointmentLabel(appointment: Appointment) {
  return appointment.equipment.map((item) => `${item.quantity}× ${item.type}`).join(', ');
}

function evolutionData(state: AppState, userId: string) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      mês: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      kg: 0,
      dispositivos: 0,
    };
  });
  const byKey = new Map(months.map((item) => [item.key, item]));
  state.records
    .filter((record) => record.userId === userId && record.validated)
    .forEach((record) => {
      const item = byKey.get(monthKey(record.date));
      if (item) {
        item.kg += record.weight;
        item.dispositivos += record.quantity;
      }
    });
  return months.map((item) => ({ ...item, kg: Math.round(item.kg * 10) / 10 }));
}

export function DashboardPage() {
  const { state, user, metrics } = useStore();
  const { notify } = useToast();
  const [scoreOpen, setScoreOpen] = useState(false);

  const userId = user?.id ?? '';
  const ownRecords = useMemo(
    () => state.records.filter((record) => record.userId === userId && record.validated),
    [state.records, userId],
  );
  const ownAppointments = useMemo(
    () => state.appointments.filter((appointment) => appointment.userId === userId),
    [state.appointments, userId],
  );
  const ownRedemptions = useMemo(
    () => state.redemptions.filter((redemption) => redemption.userId === userId),
    [state.redemptions, userId],
  );
  const ownParticipations = useMemo(
    () => state.campaigns.filter((campaign) => campaign.participants.includes(userId)),
    [state.campaigns, userId],
  );
  const ownKg = ownRecords.reduce((total, record) => total + record.weight, 0);
  const ownDevices = ownRecords.reduce((total, record) => total + record.quantity, 0);
  const score = scoreFor(ownRecords, ownParticipations.length);
  const nextAppointment = useMemo(
    () =>
      ownAppointments
        .filter((appointment) => appointment.status !== 'Cancelado' && isFutureAppointment(appointment))
        .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0],
    [ownAppointments],
  );
  const evolution = useMemo(() => evolutionData(state, userId), [state, userId]);
  const categories = useMemo(() => {
    const byCategory = new Map<string, number>();
    ownRecords.forEach((record) => byCategory.set(record.equipment, (byCategory.get(record.equipment) ?? 0) + record.weight));
    return Array.from(byCategory, ([categoria, kg]) => ({ categoria, kg: Math.round(kg * 10) / 10 })).slice(0, 6);
  }, [ownRecords]);
  const activities = useMemo(() => {
    const items = [
      ...ownAppointments.map((appointment) => ({
        date: appointment.createdAt,
        title: `Agendamento ${appointment.protocol}`,
        detail: appointmentLabel(appointment),
        icon: CalendarClock,
        tone: appointment.status === 'Cancelado' ? 'red' : 'orange',
      })),
      ...ownRecords.map((record) => ({
        date: record.date,
        title: 'Descarte validado',
        detail: `${record.quantity} dispositivo(s) · ${number(record.weight)} kg`,
        icon: Recycle,
        tone: 'green',
      })),
      ...ownRedemptions.map((redemption) => ({
        date: redemption.date,
        title: 'Recompensa resgatada',
        detail: `${redemption.name} · ${formatNumber(redemption.cost)} EcoPoints`,
        icon: WalletCards,
        tone: 'muted',
      })),
      ...ownParticipations.map((campaign) => ({
        date: campaign.endDate,
        title: 'Participação em campanha',
        detail: campaign.title,
        icon: Trophy,
        tone: 'orange',
      })),
    ];
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [ownAppointments, ownRecords, ownRedemptions, ownParticipations]);
  const goal = 10;
  const goalProgress = Math.min(100, (ownKg / goal) * 100);
  const achievements = state.achievements.slice(0, 4);

  if (!user) {
    return (
      <section className="page-stack">
        <EmptyState title="Entre para acompanhar seu impacto" description="A demonstração precisa de um usuário ativo para mostrar métricas pessoais." action={<LinkButton to="/login" variant="primary">Entrar</LinkButton>} />
      </section>
    );
  }

  return (
    <section className="page-stack">
      <PageHeader
        title={`Olá, ${firstName(user.name)}! Vamos gerar impacto hoje?`}
        description="Acompanhe sua jornada sustentável com dados derivados de descartes validados."
        action={<LinkButton to="/app/pontos-de-coleta" variant="secondary"><MapPin size={16} /> Encontrar ponto</LinkButton>}
      />

      <div className="alert" role="note">
        <Sparkles size={18} /> <span>Esta é uma demonstração com dados locais. Indicadores ambientais são estimativas educativas, não medições científicas oficiais.</span>
        <button className="muted small" type="button" onClick={() => setScoreOpen(true)}>Como funciona o EcoScore?</button>
      </div>

      <div className="stat-grid">
        <MetricCard label="Resíduos destinados" value={`${number(ownKg)} kg`} detail="descartes validados" icon={Scale} />
        <MetricCard label="Dispositivos" value={formatNumber(ownDevices)} detail="unidades validadas" icon={Cpu} />
        <MetricCard label="EcoPoints" value={formatNumber(metrics.points)} detail="saldo disponível" icon={WalletCards} />
        <MetricCard label="Impacto estimado" value={`${number(ownKg * 1.5)} kg`} detail="CO₂e demonstrativo · fator 1,5" icon={Leaf} />
      </div>

      <div className="two-column">
        <article className="panel">
          <div className="panel-header"><div><h2>Evolução da sua jornada</h2><p className="muted">Peso e dispositivos em descartes validados.</p></div><Badge tone="green">6 meses</Badge></div>
          <div className="chart-box"><ResponsiveContainer width="100%" height={280}><AreaChart data={evolution} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}><defs><linearGradient id="dashboardKg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e96925" stopOpacity={0.3} /><stop offset="100%" stopColor="#e96925" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9e5df" /><XAxis dataKey="mês" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} width={36} /><Tooltip formatter={(value, name) => [name === 'kg' ? `${value} kg` : value, name === 'kg' ? 'Peso' : 'Dispositivos']} /><Area type="monotone" dataKey="kg" stroke="#e96925" strokeWidth={2.5} fill="url(#dashboardKg)" /><Area type="monotone" dataKey="dispositivos" stroke="#245c49" strokeWidth={2} fill="none" /></AreaChart></ResponsiveContainer></div>
        </article>
        <article className="panel">
          <div className="panel-header"><div><h2>Materiais destinados</h2><p className="muted">Peso por categoria registrada.</p></div><Recycle size={20} className="muted" /></div>
          {categories.length ? <div className="chart-box"><ResponsiveContainer width="100%" height={280}><BarChart data={categories} layout="vertical" margin={{ top: 4, right: 16, left: 14, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e9e5df" /><XAxis type="number" tickLine={false} axisLine={false} /><YAxis type="category" dataKey="categoria" width={90} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [`${value} kg`, 'Peso']} /><Bar dataKey="kg" fill="#245c49" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="Ainda não há categorias" description="Quando um descarte for validado, a distribuição aparecerá aqui." />}
        </article>
      </div>

      <div className="two-column">
        <article className="panel">
          <div className="panel-header"><div><h2>Atividade recente</h2><p className="muted">Agendamentos, validações, resgates e campanhas.</p></div><Activity size={20} className="muted" /></div>
          {activities.length ? <div className="activity-list">{activities.map((item) => { const Icon = item.icon; return <div className="row" key={`${item.title}-${item.date}`}><span className="icon-box"><Icon size={17} /></span><div><strong>{item.title}</strong><p className="muted small">{item.detail}</p></div><time className="muted small" dateTime={item.date}>{formatDate(item.date)}</time></div>; })}</div> : <EmptyState title="Sua atividade começa aqui" description="Agende uma entrega ou participe de uma campanha para criar seu primeiro registro." action={<LinkButton to="/app/agendamentos/novo" variant="primary">Agendar descarte</LinkButton>} />}
        </article>
        <article className="panel">
          <div className="panel-header"><div><h2>Próximo agendamento</h2><p className="muted">Um compromisso real da sua conta.</p></div><Link to="/app/agendamentos" className="muted small">Ver todos <ChevronRight size={14} /></Link></div>
          {nextAppointment ? <div className="appointment-card"><div className="appointment-date"><CalendarClock size={19} /><strong>{formatDate(nextAppointment.date)}</strong><span>{nextAppointment.time}</span></div><div><strong>{nextAppointment.protocol}</strong><p className="muted small">{appointmentLabel(nextAppointment)}</p><Badge tone={nextAppointment.status === 'Concluído' ? 'green' : 'orange'}>{nextAppointment.status}</Badge></div></div> : <EmptyState title="Nenhum agendamento próximo" description="Escolha um ponto e combine o melhor horário para sua entrega." action={<LinkButton to="/app/agendamentos/novo" variant="primary">Agendar agora</LinkButton>} />}
        </article>
      </div>

      <div className="two-column">
        <article className="panel goal-panel"><div className="panel-header"><div><h2>Próxima meta</h2><p className="muted">Complete 10 kg validados para avançar na jornada.</p></div><Gauge size={20} className="muted" /></div><div className="progress"><span style={{ width: `${goalProgress}%` }} /></div><div className="goal-meta"><strong>{number(ownKg)} de {goal} kg</strong><span>{Math.round(goalProgress)}%</span></div><p className="small muted">Próxima conquista: Primeiro ciclo de impacto validado.</p></article>
        <article className="panel"><div className="panel-header"><div><h2>Conquistas</h2><p className="muted">Reconheça cada passo sustentável.</p></div><Award size={20} className="muted" /></div><div className="achievement-list">{achievements.length ? achievements.map((achievement) => { const progress = progressForAchievement(achievement, ownKg, ownDevices, ownParticipations.length); return <div className="achievement" key={achievement.id}><span className={`achievement-icon ${progress >= 1 ? 'is-complete' : ''}`}><Trophy size={16} /></span><div><strong>{achievement.title}</strong><p className="muted small">{achievement.description}</p><div className="progress progress-small"><span style={{ width: `${progress * 100}%` }} /></div></div><span className="small muted">{progress >= 1 ? 'Concluída' : `${Math.round(progress * 100)}%`}</span></div>; }) : <p className="muted">As conquistas serão liberadas conforme você participa.</p>}</div></article>
      </div>

      <div className="panel cta-panel"><div><span className="eyebrow">Próximo passo</span><h2>Escolha como continuar gerando impacto.</h2><p className="muted">Encontre um destino adequado ou agende sua entrega em poucos minutos.</p></div><div className="form-actions"><LinkButton to="/app/pontos-de-coleta" variant="secondary"><MapPin size={16} /> Explorar pontos</LinkButton><LinkButton to="/app/agendamentos/novo" variant="primary"><CalendarClock size={16} /> Agendar descarte</LinkButton></div></div>

      <Modal open={scoreOpen} title="Critérios do EcoScore" onClose={() => setScoreOpen(false)}>
        <div className="modal-copy"><p>O EcoScore é um indicador de participação sustentável calculado somente com contribuições demonstrativas validadas.</p><div className="score-formula"><strong>EcoScore = (4 × kg) + (2 × dispositivos) + (10 × participações)</strong><span>O resultado é limitado a 1.000 pontos.</span></div><ul><li><strong>kg:</strong> peso de registros ambientais validados na sua conta;</li><li><strong>dispositivos:</strong> quantidade validada nos mesmos registros;</li><li><strong>participações:</strong> campanhas em que você entrou, contabilizadas uma vez cada.</li></ul><p className="small muted">No seu perfil: {number(ownKg)} kg, {formatNumber(ownDevices)} dispositivos e {formatNumber(ownParticipations.length)} participação(ões) = <strong>{formatNumber(score)} pontos de EcoScore</strong>.</p></div>
      </Modal>
    </section>
  );
}
