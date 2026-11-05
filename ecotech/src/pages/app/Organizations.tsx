import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Building2, CalendarDays, CheckCircle2, Download, FileBadge2, GraduationCap, ImagePlus, Leaf, Pencil, Plus, Target, Users, X } from 'lucide-react';
import { Badge, Button, EmptyState, LinkButton, MetricCard, Modal, PageHeader, useToast } from '../../components/ui';
import { useStore } from '../../services/store';
import { downloadText, todayISO } from '../../utils';
import type { Campaign, CampaignInput, Organization } from '../../types';

export interface OrganizationPageProps {
  kind: 'empresa' | 'escola';
}

type OrganizationForm = Omit<Organization, 'id' | 'userId'>;
type CampaignForm = { title: string; description: string; goal: string; endDate: string; active: boolean; category: Campaign['category'] };

const emptyCampaign = (kind: OrganizationPageProps['kind']): CampaignForm => ({
  title: '',
  description: '',
  goal: '100',
  endDate: '',
  active: true,
  category: kind === 'empresa' ? 'Empresa' : 'Escola',
});

const fallbackClasses = [
  { name: 'Turma A', kg: 42, participants: 18 },
  { name: 'Turma B', kg: 31, participants: 15 },
  { name: 'Turma C', kg: 24, participants: 12 },
];

const csvCell = (value: string | number | boolean) => `"${String(value).replaceAll('"', '""')}"`;

function formatKg(value: number) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
}

function DemoAccessGuard({ kind }: OrganizationPageProps) {
  const navigate = useNavigate();
  const { demoLogin } = useStore();
  const { notify } = useToast();
  const label = kind === 'empresa' ? 'empresa' : 'escola';
  const activate = () => {
    demoLogin(kind);
    notify(`Cenário demonstrativo de ${label} ativado.`, 'info');
    navigate('/app', { replace: true });
  };
  return (
    <main className="container page-stack">
      <section className="panel max-w-2xl"><Badge tone="orange">Acesso restrito</Badge><h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Este painel é para uma {label}.</h1><p className="mt-3 leading-7 text-slate-600">Seu usuário atual não tem o tipo institucional correspondente. Ative o cenário demonstrativo apropriado para explorar o painel, sem alterar privilégios silenciosamente.</p><div className="form-actions mt-6"><Button onClick={activate}>Abrir demo de {label}</Button><LinkButton to="/app" variant="ghost">Voltar ao app</LinkButton></div></section>
    </main>
  );
}

function OrganizationForm({ value, kind, onChange, onSave }: { value: OrganizationForm; kind: OrganizationPageProps['kind']; onChange: (patch: Partial<OrganizationForm>) => void; onSave: () => void }) {
  const { notify } = useToast();
  const handleLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      notify('O avatar deve ter até 1,5 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange({ logo: typeof reader.result === 'string' ? reader.result : undefined });
    reader.readAsDataURL(file);
  };
  return (
    <section className="panel">
      <div className="panel-header"><div><p className="eyebrow">Cadastro institucional</p><h2 className="section-title">Dados da organização</h2></div><Badge tone="muted">Salvo localmente</Badge></div>
      <div className="form-grid sm:grid-cols-2">
        <label className="field sm:col-span-2"><span className="field-label">Nome</span><input className="input" value={value.name} onChange={(event) => onChange({ name: event.target.value })} placeholder={kind === 'empresa' ? 'Nome da empresa' : 'Nome da escola'} /></label>
        <label className="field"><span className="field-label">{kind === 'empresa' ? 'CNPJ' : 'Registro institucional'}</span><input className="input" value={value.document} onChange={(event) => onChange({ document: event.target.value })} placeholder={kind === 'empresa' ? '00.000.000/0000-00' : 'Código demonstrativo'} /></label>
        <label className="field"><span className="field-label">E-mail</span><input className="input" type="email" value={value.email} onChange={(event) => onChange({ email: event.target.value })} placeholder="contato@organizacao.org" /></label>
        <label className="field"><span className="field-label">Telefone</span><input className="input" value={value.phone} onChange={(event) => onChange({ phone: event.target.value })} placeholder="(00) 00000-0000" /></label>
        <label className="field"><span className="field-label">Responsável</span><input className="input" value={value.responsible} onChange={(event) => onChange({ responsible: event.target.value })} placeholder="Nome da pessoa responsável" /></label>
        <label className="field sm:col-span-2"><span className="field-label">Endereço</span><input className="input" value={value.address} onChange={(event) => onChange({ address: event.target.value })} placeholder="Rua, número, cidade e estado" /></label>
        <label className="field sm:col-span-2"><span className="field-label">Logo ou avatar (opcional)</span><span className="flex flex-wrap items-center gap-3"><input className="input flex-1" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} /><ImagePlus size={18} className="text-slate-400" /></span><span className="small">Arquivo local de até 1,5 MB; não é enviado para um servidor.</span></label>
      </div>
      <div className="form-actions mt-5"><Button onClick={onSave}>Salvar cadastro</Button></div>
    </section>
  );
}

function CampaignEditor({ kind, value, onChange, onSave, onClose }: { kind: OrganizationPageProps['kind']; value: CampaignForm; onChange: (patch: Partial<CampaignForm>) => void; onSave: () => void; onClose: () => void }) {
  return (
    <Modal open title={value.title ? 'Editar campanha' : 'Nova campanha'} onClose={onClose}>
      <div className="form-grid sm:grid-cols-2">
        <label className="field sm:col-span-2"><span className="field-label">Título</span><input className="input" value={value.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="Ex.: Semana do reuso tecnológico" /></label>
        <label className="field sm:col-span-2"><span className="field-label">Descrição</span><textarea className="textarea" rows={3} value={value.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Explique o desafio de educação e descarte." /></label>
        <label className="field"><span className="field-label">Meta em kg</span><input className="input" type="number" min="1" value={value.goal} onChange={(event) => onChange({ goal: event.target.value })} /></label>
        <label className="field"><span className="field-label">Data final</span><input className="input" type="date" min={todayISO()} value={value.endDate} onChange={(event) => onChange({ endDate: event.target.value })} /></label>
        <label className="field"><span className="field-label">Categoria</span><select className="select" value={value.category} onChange={(event) => onChange({ category: event.target.value as Campaign['category'] })}><option value={kind === 'empresa' ? 'Empresa' : 'Escola'}>{kind === 'empresa' ? 'Empresa' : 'Escola'}</option><option value="Comunidade">Comunidade</option></select></label>
        <label className="inline-flex items-center gap-2 self-end pb-2 text-sm text-slate-700"><input type="checkbox" className="accent-[#e96925]" checked={value.active} onChange={(event) => onChange({ active: event.target.checked })} /> Campanha ativa</label>
      </div>
      <div className="form-actions mt-6"><Button onClick={onSave}>Salvar campanha</Button><Button variant="ghost" onClick={onClose}>Cancelar</Button></div>
    </Modal>
  );
}

export function OrganizationPage({ kind }: OrganizationPageProps) {
  const { state, user, saveOrganization, saveCampaign, closeCampaign, issueCertificate } = useStore();
  const { notify } = useToast();
  const organization = useMemo(() => state.organizations.find((item) => item.userId === user?.id && item.type === kind), [kind, state.organizations, user?.id]);
  const [organizationForm, setOrganizationForm] = useState<OrganizationForm>({ type: kind, name: '', document: '', email: user?.email ?? '', phone: '', address: '', responsible: user?.name ?? '', logo: undefined, classes: [] });
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(() => emptyCampaign(kind));
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campaignOpen, setCampaignOpen] = useState(false);

  useEffect(() => {
    if (organization) {
      setOrganizationForm({ type: organization.type, name: organization.name, document: organization.document, email: organization.email, phone: organization.phone, address: organization.address, responsible: organization.responsible, logo: organization.logo, classes: organization.classes });
    }
  }, [organization]);

  if (!user || (user.role !== 'admin' && user.type !== kind)) return <DemoAccessGuard kind={kind} />;

  const ownCampaigns = state.campaigns.filter((campaign) => campaign.ownerId === user.id || (!!organization?.name && campaign.organization === organization.name));
  const ownedRecordIds = new Set(state.appointments.filter((appointment) => appointment.userId === user.id).map((appointment) => appointment.id));
  const ownRecords = state.records.filter((record) => record.validated && (record.userId === user.id || ownedRecordIds.has(record.appointmentId)));
  const fallbackRecords = state.records.filter((record) => record.validated).slice(0, 8);
  const visibleRecords = ownRecords.length ? ownRecords : fallbackRecords;
  const isDemoSample = ownRecords.length === 0 && fallbackRecords.length > 0;
  const kilograms = visibleRecords.reduce((total, record) => total + record.weight, 0);
  const devices = visibleRecords.reduce((total, record) => total + record.quantity, 0);
  const participants = new Set(ownCampaigns.flatMap((campaign) => campaign.participants)).size;
  const classes = organization?.classes?.length ? organization.classes : fallbackClasses;
  const classTotal = classes.reduce((sum, item) => sum + item.kg, 0);
  const orgName = organizationForm.name || (kind === 'empresa' ? 'Minha empresa' : 'Minha escola');
  const title = kind === 'empresa' ? 'Painel da empresa' : 'Painel da escola';
  const categoryLabel = kind === 'empresa' ? 'empresa' : 'escola';

  const updateOrganization = (patch: Partial<OrganizationForm>) => setOrganizationForm((current) => ({ ...current, ...patch }));
  const saveOrg = () => {
    if (!organizationForm.name.trim() || !organizationForm.email.trim() || !organizationForm.responsible.trim()) {
      notify('Preencha nome, e-mail e responsável.', 'error');
      return;
    }
    const result = saveOrganization(organizationForm);
    notify(result.ok ? 'Cadastro institucional salvo.' : (result.error ?? 'Não foi possível salvar o cadastro.'), result.ok ? 'success' : 'error');
  };
  const openNewCampaign = () => {
    setEditingCampaign(null);
    setCampaignForm(emptyCampaign(kind));
    setCampaignOpen(true);
  };
  const openEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({ title: campaign.title, description: campaign.description, goal: String(campaign.goal), endDate: campaign.endDate, active: campaign.active, category: campaign.category });
    setCampaignOpen(true);
  };
  const saveCampaignForm = () => {
    const goal = Number(campaignForm.goal);
    if (!campaignForm.title.trim() || !campaignForm.description.trim() || !Number.isFinite(goal) || goal <= 0 || !campaignForm.endDate || campaignForm.endDate <= todayISO()) {
      notify('Informe título, descrição, uma meta positiva e uma data futura.', 'error');
      return;
    }
    const input: CampaignInput = { title: campaignForm.title.trim(), description: campaignForm.description.trim(), organization: orgName, goal, endDate: campaignForm.endDate, active: campaignForm.active, category: campaignForm.category };
    const result = saveCampaign(input, editingCampaign?.id);
    notify(result.ok ? 'Campanha salva.' : (result.error ?? 'Não foi possível salvar a campanha.'), result.ok ? 'success' : 'error');
    if (result.ok) setCampaignOpen(false);
  };
  const closeOwnCampaign = (campaign: Campaign) => {
    if (!window.confirm(`Encerrar a campanha “${campaign.title}”?`)) return;
    const result = closeCampaign(campaign.id);
    notify(result.ok ? 'Campanha encerrada.' : (result.error ?? 'Não foi possível encerrar a campanha.'), result.ok ? 'success' : 'error');
  };
  const exportReport = () => {
    const rows = [
      ['Indicador', 'Valor'],
      ['Organização', orgName],
      ['Tipo', categoryLabel],
      ['Resíduos validados (kg)', kilograms],
      ['Dispositivos contabilizados', devices],
      ['Campanhas', ownCampaigns.length],
      ['Participantes', participants],
      ['Amostra demonstrativa', isDemoSample ? 'sim' : 'não'],
    ];
    visibleRecords.forEach((record) => rows.push(['Registro', `${record.date} — ${record.equipment} — ${record.weight} kg — ${record.destination}`]));
    downloadText(`relatorio-${kind}-${todayISO()}.csv`, rows.map((row) => row.map(csvCell).join(';')).join('\n'), 'text/csv;charset=utf-8');
    notify('Relatório CSV demonstrativo baixado.', 'success');
  };
  const generateCertificate = () => {
    if (kind !== 'escola') return;
    const campaign = ownCampaigns.find((item) => item.active) ?? ownCampaigns[0];
    const result = issueCertificate(orgName, campaign?.id);
    if (!result.ok && user.type !== 'escola') {
      notify(result.error ?? 'Não foi possível emitir o certificado.', 'error');
      return;
    }
    const code = `ECO-DEMO-${todayISO().replaceAll('-', '')}-${(result.id ?? 'ESCOLA').slice(-5).toUpperCase()}`;
    const text = `CERTIFICADO DEMONSTRATIVO\n\nOrganização: ${orgName}\nCódigo: ${code}\nData: ${todayISO()}\n\nEste documento é uma demonstração de interface. Não possui assinatura legal, certificação oficial ou validade jurídica.`;
    downloadText(`certificado-demonstrativo-${todayISO()}.txt`, text, 'text/plain;charset=utf-8');
    notify(result.ok ? 'Certificado demonstrativo gerado.' : 'Certificado demonstrativo baixado localmente; a emissão oficial permanece bloqueada.', result.ok ? 'success' : 'info');
  };

  return (
    <main className="container page-stack">
      <PageHeader title={title} description={`Acompanhe resíduos, campanhas e metas da sua ${categoryLabel}.`} action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={exportReport}><Download size={16} /> Exportar CSV</Button>{kind === 'escola' && <Button onClick={generateCertificate}><FileBadge2 size={16} /> Certificado demonstrativo</Button>}</div>} />
      <div className="alert"><Leaf size={17} /><span>Ambiente demonstrativo local: indicadores e documentos abaixo não representam certificação, coleta ou parceria real.</span></div>
      <div className="stat-grid">
        <MetricCard label="Resíduos validados" value={formatKg(kilograms)} detail={isDemoSample ? 'amostra demonstrativa' : 'registros da organização'} icon={Leaf} />
        <MetricCard label="Dispositivos" value={devices.toLocaleString('pt-BR')} detail="equipamentos contabilizados" icon={BarChart3} />
        <MetricCard label="Campanhas" value={ownCampaigns.length} detail={`${ownCampaigns.filter((item) => item.active).length} ativas`} icon={Target} />
        <MetricCard label="Participantes" value={participants || '—'} detail="participação agregada" icon={Users} />
      </div>
      <OrganizationForm value={organizationForm} kind={kind} onChange={updateOrganization} onSave={saveOrg} />
      <div className="two-column">
        <section className="panel"><div className="panel-header"><div><p className="eyebrow">Acompanhamento</p><h2 className="section-title">Impacto e metas</h2></div><Badge tone="green">Dados validados</Badge></div><div className="space-y-5"><div><div className="mb-2 flex justify-between text-sm"><span>Meta da amostra</span><strong>{formatKg(classTotal)}</strong></div><div className="progress"><span style={{ width: `${Math.min(100, classTotal ? (kilograms / classTotal) * 100 : 0)}%` }} /></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-[#fbf9f5] p-4"><p className="small">Impacto ambiental</p><p className="mt-1 text-2xl font-semibold">{visibleRecords.reduce((sum, record) => sum + record.co2, 0).toLocaleString('pt-BR')} kg</p><p className="small">CO₂e estimado no store</p></div><div className="rounded-xl bg-[#fbf9f5] p-4"><p className="small">Registros</p><p className="mt-1 text-2xl font-semibold">{visibleRecords.length}</p><p className="small">sem nomes de estudantes</p></div></div></div></section>
        <section className="panel"><div className="panel-header"><div><p className="eyebrow">{kind === 'escola' ? 'Turmas' : 'Histórico'}</p><h2 className="section-title">{kind === 'escola' ? 'Comparativo agregado' : 'Registros recentes'}</h2></div><Users size={19} className="text-[#c75013]" /></div>{kind === 'escola' ? <div className="space-y-3">{classes.map((item) => <div key={item.name}><div className="mb-1 flex justify-between text-sm"><span>{item.name}</span><strong>{formatKg(item.kg)}</strong></div><div className="progress"><span style={{ width: `${Math.min(100, (item.kg / Math.max(...classes.map((entry) => entry.kg), 1)) * 100)}%` }} /></div><p className="small mt-1">{item.participants} participantes agregados</p></div>)}</div> : <div className="space-y-3">{visibleRecords.slice(0, 4).map((record) => <div key={record.id} className="row"><div><strong>{record.equipment}</strong><p className="small">{record.date} · {record.destination}</p></div><Badge tone="green">{formatKg(record.weight)}</Badge></div>)}{!visibleRecords.length && <EmptyState title="Ainda sem registros" description="Registros validados aparecerão aqui." />}</div>}</section>
      </div>
      <section className="panel"><div className="panel-header"><div><p className="eyebrow">Engajamento</p><h2 className="section-title">Campanhas</h2></div><Button onClick={openNewCampaign}><Plus size={16} /> Criar campanha</Button></div>{ownCampaigns.length ? <div className="grid gap-3 lg:grid-cols-2">{ownCampaigns.map((campaign) => <article key={campaign.id} className="rounded-2xl border border-slate-200 p-5"><div className="flex items-start justify-between gap-3"><div><Badge tone={campaign.active ? 'green' : 'muted'}>{campaign.active ? 'Ativa' : 'Encerrada'}</Badge><h3 className="mt-3 text-lg font-semibold">{campaign.title}</h3></div><span className="small">até {campaign.endDate}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{campaign.description}</p><div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600"><span><Target size={15} className="mr-1 inline text-[#c75013]" /> meta {formatKg(campaign.goal)}</span><span><Users size={15} className="mr-1 inline text-[#c75013]" /> {campaign.participants.length} participantes</span></div><div className="form-actions mt-5">{campaign.active && <Button variant="secondary" onClick={() => openEditCampaign(campaign)}><Pencil size={15} /> Editar</Button>}{campaign.active && <Button variant="ghost" onClick={() => closeOwnCampaign(campaign)}><X size={15} /> Encerrar</Button>}</div></article>)}</div> : <EmptyState title="Nenhuma campanha criada" description="Crie uma campanha para mobilizar sua comunidade." action={<Button onClick={openNewCampaign}><Plus size={16} /> Criar primeira campanha</Button>} />}</section>
      {campaignOpen && <CampaignEditor kind={kind} value={campaignForm} onChange={(patch) => setCampaignForm((current) => ({ ...current, ...patch }))} onSave={saveCampaignForm} onClose={() => setCampaignOpen(false)} />}
    </main>
  );
}

export default OrganizationPage;
