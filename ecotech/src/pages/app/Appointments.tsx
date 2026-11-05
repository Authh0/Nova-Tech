import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  MapPin,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Badge, Button, EmptyState, LinkButton, Modal, PageHeader, useToast } from '../../components/ui';
import { useStore } from '../../services/store';
import { pointAcceptsEquipment } from '../../services/store';
import { formatDate, formatNumber } from '../../utils';
import type { Address, Appointment, AppointmentStatus, Equipment } from '../../types';
import { equipmentTypes } from '../../data/seed';

const statusOptions: Array<AppointmentStatus | 'Todos'> = ['Todos', 'Solicitado', 'Confirmado', 'Em coleta', 'Concluído', 'Cancelado'];
const timeOptions = ['08:00', '10:00', '14:00', '16:00'];
const stepLabels = ['Equipamentos', 'Modalidade', 'Local', 'Data', 'Revisão', 'Confirmação'];

const emptyAddress: Address = { cep: '', street: '', number: '', complement: '', district: '', city: '', state: 'TO' };

function statusTone(status: AppointmentStatus) {
  if (status === 'Concluído') return 'green' as const;
  if (status === 'Cancelado') return 'red' as const;
  if (status === 'Solicitado') return 'orange' as const;
  return 'muted' as const;
}

function tomorrowISO() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function statusLabel(status: AppointmentStatus) {
  return status;
}

function appointmentAddress(appointment: Appointment, pointName?: string) {
  if (appointment.mode === 'entrega') return pointName ? `Entrega em ${pointName}` : 'Entrega em ponto de coleta';
  const address = appointment.address;
  return address ? `${address.street}, ${address.number} · ${address.district} · ${address.city}` : 'Endereço de coleta não informado';
}

function AppointmentCard({ appointment, pointName }: { appointment: Appointment; pointName?: string }) {
  return (
    <article className="panel">
      <div className="panel-header" style={{ alignItems: 'flex-start' }}>
        <div><span className="muted small">Protocolo {appointment.protocol}</span><h3 style={{ margin: '5px 0 0' }}>{formatDate(appointment.date)} · {appointment.time}</h3></div>
        <Badge tone={statusTone(appointment.status)}>{statusLabel(appointment.status)}</Badge>
      </div>
      <div className="small" style={{ display: 'grid', gap: 8 }}>
        <span><PackagePlus size={16} aria-hidden="true" /> {appointment.equipment.reduce((sum, item) => sum + item.quantity, 0)} equipamento(s) em {appointment.mode === 'entrega' ? 'entrega' : 'coleta'}</span>
        <span><MapPin size={16} aria-hidden="true" /> {appointmentAddress(appointment, pointName)}</span>
      </div>
      <div className="form-actions" style={{ marginTop: 16 }}><LinkButton to={`/app/agendamentos/${appointment.id}`} variant="secondary">Acompanhar agendamento</LinkButton></div>
    </article>
  );
}

export function AppointmentsPage() {
  const { state, user } = useStore();
  const appointments = (state.appointments ?? []).filter((appointment) => appointment.userId === user?.id);
  const points = state.points ?? [];
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<AppointmentStatus | 'Todos'>('Todos');

  const filteredAppointments = useMemo(() => appointments.filter((appointment) => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    const matchesQuery = !normalized || `${appointment.protocol} ${appointment.date} ${appointment.time}`.toLocaleLowerCase('pt-BR').includes(normalized);
    return matchesQuery && (status === 'Todos' || appointment.status === status);
  }), [appointments, query, status]);

  if (!user) return <EmptyState title="Entre para consultar seus agendamentos" description="A gestão de protocolos é privada e vinculada ao seu usuário demonstrativo." action={<LinkButton to="/login" variant="primary">Entrar</LinkButton>} />;

  return (
    <div className="page-stack">
      <PageHeader title="Meus agendamentos" description="Acompanhe solicitações, horários e histórico. Pontos só são contabilizados depois da validação administrativa." action={<LinkButton to="/app/agendamentos/novo" variant="primary"><Plus size={17} aria-hidden="true" /> Novo agendamento</LinkButton>} />
      <section className="panel">
        <div className="filter-row" style={{ alignItems: 'end' }}>
          <label className="field" style={{ flex: '1 1 280px' }}><span className="field-label">Buscar protocolo ou data</span><span style={{ position: 'relative' }}><Search size={17} aria-hidden="true" style={{ position: 'absolute', left: 12, top: 12, color: '#7a8984' }} /><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: ECO-2025…" style={{ paddingLeft: 38 }} /></span></label>
          <label className="field"><span className="field-label">Status</span><select className="select" value={status} onChange={(event) => setStatus(event.target.value as AppointmentStatus | 'Todos')}>{statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <div className="stat-grid" style={{ minWidth: 280 }}><div><strong>{appointments.length}</strong><span className="muted small">protocolos</span></div><div><strong>{appointments.filter((item) => item.status === 'Concluído').length}</strong><span className="muted small">concluídos</span></div></div>
        </div>
      </section>
      {filteredAppointments.length ? <div className="cards-grid">{filteredAppointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} pointName={points.find((point) => point.id === appointment.pointId)?.name} />)}</div> : <EmptyState title="Nenhum agendamento encontrado" description="Ajuste os filtros ou crie um novo protocolo para começar." action={<LinkButton to="/app/agendamentos/novo" variant="primary">Criar agendamento</LinkButton>} />}
    </div>
  );
}

interface AppointmentDraft {
  equipment: Equipment[];
  mode: 'entrega' | 'coleta';
  pointId: string;
  address: Address;
  date: string;
  time: string;
}

const initialEquipment = (): Equipment => ({ type: equipmentTypes[0] ?? 'Smartphone', quantity: 1, condition: 'Em uso', notes: '', weight: undefined });

export function NewAppointmentPage() {
  const { state, createAppointment } = useStore();
  const { notify } = useToast();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<AppointmentDraft>({ equipment: [initialEquipment()], mode: 'entrega', pointId: state.points.find((point) => point.open)?.id ?? '', address: { ...emptyAddress }, date: '', time: '' });
  const [createdId, setCreatedId] = useState<string | null>(null);

  const createdAppointment = createdId ? state.appointments.find((appointment) => appointment.id === createdId) : undefined;
  const minDate = tomorrowISO();

  function updateEquipment(index: number, patch: Partial<Equipment>) {
    setDraft((current) => ({ ...current, equipment: current.equipment.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  }

  function updateAddress(patch: Partial<Address>) {
    setDraft((current) => ({ ...current, address: { ...current.address, ...patch } }));
  }

  function validateStep(currentStep: number) {
    if (currentStep === 0) {
      if (!draft.equipment.length || draft.equipment.some((item) => !item.type || item.quantity < 1)) { notify('Adicione ao menos um equipamento com quantidade válida.', 'error'); return false; }
    }
    if (currentStep === 2) {
      if (draft.mode === 'entrega' && !draft.pointId) { notify('Escolha um ponto de coleta para a entrega.', 'error'); return false; }
      if (draft.mode === 'coleta') {
        const required = [draft.address.cep, draft.address.street, draft.address.number, draft.address.district, draft.address.city, draft.address.state];
        if (required.some((value) => !value.trim())) { notify('Preencha CEP, rua, número, bairro, cidade e estado.', 'error'); return false; }
      }
    }
    if (currentStep === 3) {
      if (!draft.date || draft.date < minDate || !draft.time) { notify('Escolha uma data futura e um horário disponível.', 'error'); return false; }
    }
    return true;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(current + 1, stepLabels.length - 2));
  }

  function back() {
    setStep((current) => Math.max(current - 1, 0));
  }

  function submitAppointment() {
    if (!validateStep(0) || !validateStep(2) || !validateStep(3)) return;
    const result = createAppointment({ equipment: draft.equipment, mode: draft.mode, pointId: draft.mode === 'entrega' ? draft.pointId : undefined, address: draft.mode === 'coleta' ? draft.address : undefined, date: draft.date, time: draft.time });
    if (!result.ok || !result.id) { notify(result.error ?? 'Não foi possível criar o agendamento.', 'error'); return; }
    setCreatedId(result.id);
    setStep(5);
    notify('Agendamento criado. Nenhum ponto foi concedido antes da validação.', 'success');
  }

  function resetFlow() {
    setDraft({ equipment: [initialEquipment()], mode: 'entrega', pointId: state.points.find((point) => point.open)?.id ?? '', address: { ...emptyAddress }, date: '', time: '' });
    setCreatedId(null);
    setStep(0);
  }

  if (step === 5) {
    return (
      <div className="page-stack">
        <PageHeader title="Agendamento solicitado" description="Seu protocolo foi registrado para acompanhamento. A validação administrativa acontece depois da destinação." />
        <section className="success-panel" style={{ padding: 28 }}><CheckCircle2 size={28} aria-hidden="true" /><div><h2 style={{ margin: 0 }}>Tudo certo por enquanto</h2><p className="muted" style={{ marginBottom: 0 }}>O pedido está com status <strong>{createdAppointment?.status ?? 'Solicitado'}</strong> e não gera EcoPoints até ser validado.</p></div></section>
        <section className="panel"><div className="panel-header"><div><span className="muted small">Protocolo</span><h2 style={{ margin: '4px 0 0' }}>{createdAppointment?.protocol ?? 'Gerado pelo store'}</h2></div><Badge tone="orange">Solicitado</Badge></div><div className="two-column"><div><strong>Quando</strong><p className="muted">{formatDate(draft.date)} · {draft.time}</p></div><div><strong>Local</strong><p className="muted">{appointmentAddress(createdAppointment ?? ({ mode: draft.mode, address: draft.address } as Appointment), state.points.find((point) => point.id === draft.pointId)?.name)}</p></div></div><div className="row" style={{ marginTop: 18 }}><AlertCircle size={18} aria-hidden="true" /><span className="small">A confirmação de recebimento e a pontuação dependem da conferência do material por um administrador.</span></div><div className="form-actions" style={{ marginTop: 20 }}><LinkButton to={createdId ? `/app/agendamentos/${createdId}` : '/app/agendamentos'} variant="primary">Ver protocolo</LinkButton><Button type="button" variant="secondary" onClick={resetFlow}>Criar outro agendamento</Button></div></section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <LinkButton to="/app/agendamentos" variant="ghost"><ArrowLeft size={16} aria-hidden="true" /> Meus agendamentos</LinkButton>
      <PageHeader title="Novo agendamento" description="Organize a destinação em seis passos. Você pode revisar tudo antes de enviar a solicitação." />
      <ol className="stepper" aria-label="Etapas do agendamento" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8, padding: 0, margin: 0, listStyle: 'none' }}>{stepLabels.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} style={{ opacity: index <= step ? 1 : .48 }}><span className="icon-box" style={{ background: index < step ? '#e8f5ec' : undefined }}>{index < step ? <Check size={16} /> : index + 1}</span><span className="small">{label}</span></li>)}</ol>
      <section className="panel">
        {step === 0 ? <EquipmentStep draft={draft} updateEquipment={updateEquipment} addEquipment={() => setDraft((current) => ({ ...current, equipment: [...current.equipment, initialEquipment()] }))} removeEquipment={(index) => setDraft((current) => ({ ...current, equipment: current.equipment.filter((_, itemIndex) => itemIndex !== index) }))} /> : null}
        {step === 1 ? <ModeStep draft={draft} setMode={(mode) => setDraft((current) => ({ ...current, mode }))} /> : null}
        {step === 2 ? <LocationStep draft={draft} points={state.points} equipment={draft.equipment} updateAddress={updateAddress} setPoint={(pointId) => setDraft((current) => ({ ...current, pointId }))} /> : null}
        {step === 3 ? <DateStep draft={draft} setDraft={setDraft} minDate={minDate} /> : null}
        {step === 4 ? <ReviewStep draft={draft} pointName={state.points.find((point) => point.id === draft.pointId)?.name} /> : null}
        <div className="form-actions" style={{ justifyContent: 'space-between', marginTop: 26, paddingTop: 20, borderTop: '1px solid #e8eeeb' }}><Button type="button" variant="ghost" onClick={back} disabled={step === 0}><ArrowLeft size={16} /> Voltar</Button>{step === 4 ? <Button type="button" variant="primary" onClick={submitAppointment}>Enviar solicitação <ArrowRight size={16} /></Button> : <Button type="button" variant="primary" onClick={next}>Continuar <ArrowRight size={16} /></Button>}</div>
      </section>
    </div>
  );
}

function EquipmentStep({ draft, updateEquipment, addEquipment, removeEquipment }: { draft: AppointmentDraft; updateEquipment: (index: number, patch: Partial<Equipment>) => void; addEquipment: () => void; removeEquipment: (index: number) => void }) {
  return <div><div className="panel-header"><div><h2 style={{ margin: 0 }}>Quais equipamentos você vai destinar?</h2><p className="muted small">Adicione vários itens e informe o estado de cada um.</p></div><Badge tone="orange">{draft.equipment.length} item(ns)</Badge></div><div style={{ display: 'grid', gap: 14 }}>{draft.equipment.map((item, index) => <div className="panel" key={`${index}-${item.type}`} style={{ background: '#fbfcfa' }}><div className="form-grid"><label className="field"><span className="field-label">Tipo de equipamento</span><select className="select" value={item.type} onChange={(event) => updateEquipment(index, { type: event.target.value })}>{equipmentTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label className="field"><span className="field-label">Quantidade</span><input className="input" type="number" min={1} value={item.quantity} onChange={(event) => updateEquipment(index, { quantity: Math.max(1, Number(event.target.value) || 1) })} /></label><label className="field"><span className="field-label">Estado</span><select className="select" value={item.condition} onChange={(event) => updateEquipment(index, { condition: event.target.value })}><option>Em uso</option><option>Com avaria</option><option>Sem funcionamento</option><option>Desmontado</option></select></label><label className="field"><span className="field-label">Peso estimado (kg), opcional</span><input className="input" type="number" min={0} step="0.1" value={item.weight ?? ''} onChange={(event) => updateEquipment(index, { weight: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field" style={{ gridColumn: '1 / -1' }}><span className="field-label">Observação, opcional</span><textarea className="textarea" rows={2} value={item.notes} onChange={(event) => updateEquipment(index, { notes: event.target.value })} placeholder="Ex.: retirar bateria antes da entrega" /></label></div><Button type="button" variant="ghost" onClick={() => removeEquipment(index)} disabled={draft.equipment.length === 1}><Trash2 size={16} /> Remover item</Button></div>)}</div><Button type="button" variant="secondary" onClick={addEquipment} style={{ marginTop: 14 }}><Plus size={16} /> Adicionar equipamento</Button></div>;
}

function ModeStep({ draft, setMode }: { draft: AppointmentDraft; setMode: (mode: 'entrega' | 'coleta') => void }) {
  return <div><div className="panel-header"><div><h2 style={{ margin: 0 }}>Como você quer destinar?</h2><p className="muted small">Escolha entre levar o material ou solicitar retirada no endereço.</p></div></div><div className="cards-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}><button type="button" className="panel" onClick={() => setMode('entrega')} aria-pressed={draft.mode === 'entrega'} style={{ textAlign: 'left', borderColor: draft.mode === 'entrega' ? '#e96925' : undefined, cursor: 'pointer' }}><MapPin size={24} /><h3>Entrega em ponto de coleta</h3><p className="muted small">Você leva os equipamentos até um ponto cadastrado.</p>{draft.mode === 'entrega' ? <Badge tone="orange">Selecionado</Badge> : null}</button><button type="button" className="panel" onClick={() => setMode('coleta')} aria-pressed={draft.mode === 'coleta'} style={{ textAlign: 'left', borderColor: draft.mode === 'coleta' ? '#e96925' : undefined, cursor: 'pointer' }}><Truck size={24} /><h3>Coleta no endereço</h3><p className="muted small">A solicitação será analisada para retirada no endereço informado.</p>{draft.mode === 'coleta' ? <Badge tone="orange">Selecionado</Badge> : null}</button></div></div>;
}

function LocationStep({ draft, points, equipment, updateAddress, setPoint }: { draft: AppointmentDraft; points: Array<{ id: string; name: string; address: string; district: string; city: string; hours: string; materials: string[]; open: boolean; pickup: boolean }>; equipment: Equipment[]; updateAddress: (patch: Partial<Address>) => void; setPoint: (pointId: string) => void }) {
  if (draft.mode === 'entrega') {
    const eligible = points.filter((point) => point.open && pointAcceptsEquipment(point, equipment));
    return <div><div className="panel-header"><div><h2 style={{ margin: 0 }}>Escolha o ponto de entrega</h2><p className="muted small">Exibimos somente pontos abertos que aceitam todos os materiais selecionados. Datas e horários devem coincidir com o atendimento indicado.</p></div></div>{eligible.length ? <div className="cards-grid">{eligible.map((point) => <button type="button" className="panel" key={point.id} onClick={() => setPoint(point.id)} aria-pressed={draft.pointId === point.id} style={{ textAlign: 'left', borderColor: draft.pointId === point.id ? '#e96925' : undefined }}><div className="panel-header"><strong>{point.name}</strong><Badge tone="green">Aberto</Badge></div><span className="muted small" style={{ display: 'block', marginTop: 5 }}>{point.address}, {point.district} · {point.city}</span><span className="muted small" style={{ display: 'block', marginTop: 8 }}>Horário: {point.hours}</span><span className="muted small" style={{ display: 'block', marginTop: 5 }}>Recebe: {point.materials.join(', ')}</span>{draft.pointId === point.id ? <Badge tone="orange">Selecionado</Badge> : null}</button>)}</div> : <EmptyState title="Nenhum ponto recebe todos estes materiais" description="Volte à etapa de equipamentos e escolha itens aceitos em um mesmo local, ou altere a modalidade para solicitar coleta no endereço." />}</div>;
  }
  return <div><div className="panel-header"><div><h2 style={{ margin: 0 }}>Onde devemos coletar?</h2><p className="muted small">Informe um endereço completo para análise da coleta.</p></div></div><div className="form-grid"><label className="field"><span className="field-label">CEP</span><input className="input" value={draft.address.cep} onChange={(event) => updateAddress({ cep: event.target.value })} placeholder="77000-000" /></label><label className="field"><span className="field-label">Rua</span><input className="input" value={draft.address.street} onChange={(event) => updateAddress({ street: event.target.value })} /></label><label className="field"><span className="field-label">Número</span><input className="input" value={draft.address.number} onChange={(event) => updateAddress({ number: event.target.value })} /></label><label className="field"><span className="field-label">Complemento, opcional</span><input className="input" value={draft.address.complement} onChange={(event) => updateAddress({ complement: event.target.value })} /></label><label className="field"><span className="field-label">Bairro</span><input className="input" value={draft.address.district} onChange={(event) => updateAddress({ district: event.target.value })} /></label><label className="field"><span className="field-label">Cidade</span><input className="input" value={draft.address.city} onChange={(event) => updateAddress({ city: event.target.value })} /></label><label className="field"><span className="field-label">Estado</span><input className="input" maxLength={2} value={draft.address.state} onChange={(event) => updateAddress({ state: event.target.value.toUpperCase() })} /></label></div></div>;
}

function DateStep({ draft, setDraft, minDate }: { draft: AppointmentDraft; setDraft: Dispatch<SetStateAction<AppointmentDraft>>; minDate: string }) {
  return <div><div className="panel-header"><div><h2 style={{ margin: 0 }}>Quando deve acontecer?</h2><p className="muted small">Escolha uma data futura. A disponibilidade é demonstrativa.</p></div><CalendarDays size={22} aria-hidden="true" /></div><div className="form-grid"><label className="field"><span className="field-label">Data</span><input className="input" type="date" min={minDate} value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></label><label className="field"><span className="field-label">Horário disponível</span><select className="select" value={draft.time} onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}><option value="">Selecione</option>{timeOptions.map((time) => <option key={time} value={time}>{time}</option>)}</select></label></div><div className="alert" style={{ marginTop: 18 }}><Clock3 size={17} aria-hidden="true" /><span>O horário será confirmado pela equipe. A solicitação não equivale a uma coleta confirmada.</span></div></div>;
}

function ReviewStep({ draft, pointName }: { draft: AppointmentDraft; pointName?: string }) {
  return <div><div className="panel-header"><div><h2 style={{ margin: 0 }}>Revise sua solicitação</h2><p className="muted small">Confira os dados antes de enviar.</p></div></div><div className="two-column"><div><h3>Equipamentos</h3><div style={{ display: 'grid', gap: 8 }}>{draft.equipment.map((item, index) => <div className="row" key={`${item.type}-${index}`}><PackagePlus size={16} aria-hidden="true" /><span>{item.quantity}× {item.type} · {item.condition}{item.weight ? ` · ${formatNumber(item.weight, 1)} kg` : ''}</span></div>)}</div></div><div><h3>Modalidade e local</h3><p className="muted">{draft.mode === 'entrega' ? `Entrega em ${pointName ?? 'ponto selecionado'}` : `Coleta em ${draft.address.street}, ${draft.address.number}, ${draft.address.city}`}</p><h3>Data e horário</h3><p className="muted">{formatDate(draft.date)} · {draft.time}</p></div></div></div>;
}

export function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, user, cancelAppointment } = useStore();
  const { notify } = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const appointment = state.appointments.find((item) => item.id === id && item.userId === user?.id);
  const pointName = appointment?.pointId ? state.points.find((point) => point.id === appointment.pointId)?.name : undefined;

  if (!user) return <EmptyState title="Entre para visualizar este protocolo" action={<LinkButton to="/login" variant="primary">Entrar</LinkButton>} />;
  if (!appointment) return <EmptyState title="Agendamento não encontrado" description="Este protocolo não existe ou não pertence ao usuário conectado." action={<LinkButton to="/app/agendamentos" variant="primary"><ArrowLeft size={16} /> Voltar aos agendamentos</LinkButton>} />;
  const appointmentId = appointment.id;

  function confirmCancel() {
    const result = cancelAppointment(appointmentId);
    if (!result.ok) { notify(result.error ?? 'Não foi possível cancelar o agendamento.', 'error'); return; }
    setCancelOpen(false);
    notify('Agendamento cancelado.', 'success');
  }

  const canCancel = appointment.status !== 'Cancelado' && appointment.status !== 'Concluído';
  return <div className="page-stack"><LinkButton to="/app/agendamentos" variant="ghost"><ArrowLeft size={16} /> Meus agendamentos</LinkButton><PageHeader title={`Protocolo ${appointment.protocol}`} description="Acompanhe o histórico e os detalhes da solicitação." action={canCancel ? <Button type="button" variant="danger" onClick={() => setCancelOpen(true)}><XCircle size={16} /> Cancelar</Button> : undefined} /><section className="panel"><div className="panel-header"><div><span className="muted small">Status atual</span><h2 style={{ margin: '5px 0 0' }}>{appointment.status}</h2></div><Badge tone={statusTone(appointment.status)}>{appointment.status}</Badge></div><div className="stat-grid"><div><strong>{formatDate(appointment.date)}</strong><span className="muted small">data solicitada</span></div><div><strong>{appointment.time}</strong><span className="muted small">horário</span></div><div><strong>{appointment.mode === 'entrega' ? 'Entrega' : 'Coleta'}</strong><span className="muted small">modalidade</span></div><div><strong>{appointment.validated ? 'Validado' : 'Pendente'}</strong><span className="muted small">pontuação</span></div></div></section><div className="two-column"><section className="panel"><div className="panel-header"><h2 style={{ margin: 0 }}>Equipamentos</h2><PackagePlus size={19} /></div><div style={{ display: 'grid', gap: 10 }}>{appointment.equipment.map((item, index) => <div className="row" key={`${item.type}-${index}`}><PackagePlus size={16} aria-hidden="true" /><div><strong>{item.quantity}× {item.type}</strong><span className="muted small">{item.condition}{item.weight ? ` · ${formatNumber(item.weight, 1)} kg estimados` : ''}{item.notes ? ` · ${item.notes}` : ''}</span></div></div>)}</div></section><section className="panel"><div className="panel-header"><h2 style={{ margin: 0 }}>Local</h2><MapPin size={19} /></div><p className="muted">{appointmentAddress(appointment, pointName)}</p>{appointment.address?.complement ? <p className="small">Complemento: {appointment.address.complement}</p> : null}</section></div><section className="panel"><div className="panel-header"><h2 style={{ margin: 0 }}>Histórico</h2><Clock3 size={19} /></div><ol className="timeline" style={{ display: 'grid', gap: 14, padding: 0, listStyle: 'none' }}>{appointment.history.map((event, index) => <li key={`${event.date}-${event.status}-${index}`} className="row"><span className="icon-box" style={{ background: index === appointment.history.length - 1 ? '#fff0e8' : '#e8f5ec' }}>{index === appointment.history.length - 1 ? <Clock3 size={15} /> : <Check size={15} />}</span><div><strong>{event.status}</strong><span className="muted small">{formatDate(event.date)}</span></div></li>)}</ol><p className="muted small" style={{ marginBottom: 0 }}>A validação administrativa é a etapa que libera pontos e registros ambientais definitivos.</p></section><Modal open={cancelOpen} title="Cancelar agendamento?" onClose={() => setCancelOpen(false)}><p>O protocolo <strong>{appointment.protocol}</strong> será marcado como cancelado. Essa ação não agenda uma nova coleta.</p><div className="form-actions"><Button type="button" variant="ghost" onClick={() => setCancelOpen(false)}>Voltar</Button><Button type="button" variant="danger" onClick={confirmCancel}>Confirmar cancelamento</Button></div></Modal></div>;
}
