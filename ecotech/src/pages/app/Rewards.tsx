import { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Download,
  Gift,
  History,
  Leaf,
  Medal,
  Recycle,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { Badge, Button, EmptyState, LinkButton, MetricCard, Modal, PageHeader, useToast } from '../../components/ui';
import { useStore } from '../../services/store';
import { downloadText, formatDate, formatNumber } from '../../utils';
import type { Reward } from '../../types';

const levelThresholds = [
  { name: 'Iniciante Verde', min: 0 },
  { name: 'Explorador Sustentável', min: 100 },
  { name: 'Guardião Ambiental', min: 300 },
  { name: 'EcoHero', min: 600 },
  { name: 'Lenda da Sustentabilidade', min: 1000 },
];

const achievementDefinitions = [
  { title: 'Primeiro descarte', description: 'Tenha o primeiro registro ambiental validado.', target: 1, criteria: 'registro' },
  { title: '10 dispositivos', description: 'Destine dez equipamentos com validação.', target: 10, criteria: 'dispositivos' },
  { title: '10 kg destinados', description: 'Alcance dez quilos em registros validados.', target: 10, criteria: 'kg' },
  { title: 'Participação em campanha', description: 'Participe de uma campanha ambiental.', target: 1, criteria: 'campanha' },
  { title: 'Diversidade de materiais', description: 'Destine quatro tipos de equipamento.', target: 4, criteria: 'diversidade' },
];

function levelForPoints(points: number) {
  return [...levelThresholds].reverse().find((level) => points >= level.min)?.name ?? levelThresholds[0].name;
}

function nextLevel(points: number) {
  return levelThresholds.find((level) => level.min > points);
}

function receiptText(reward: Reward, receiptId: string, date: string, userName: string) {
  return [`ECOTECH — COMPROVANTE DE RESGATE`, `Registro demonstrativo: ${receiptId}`, `Beneficiário: ${userName}`, `Recompensa: ${reward.name}`, `Categoria: ${reward.category}`, `Custo: ${reward.cost} EcoPoints`, `Data: ${date}`, '', 'Este comprovante é fictício. A EcoTech não emite cupons ou benefícios reais nesta demonstração.'].join('\n');
}

function pointsForUser(userId: string, records: Array<{ userId: string; validated: boolean; points: number }>) {
  return records.filter((record) => record.userId === userId && record.validated).reduce((sum, record) => sum + record.points, 0);
}

function RankingRow({ position, name, points, level, avatar }: { position: number; name: string; points: number; level: string; avatar?: string }) {
  return <tr><td><span className="icon-box" aria-hidden="true">{position}</span></td><td><div className="row"><span className="avatar" aria-hidden="true">{avatar ?? name.slice(0, 1).toUpperCase()}</span><strong>{name}</strong></div></td><td>{formatNumber(points)} EcoPoints</td><td><Badge tone={position === 1 ? 'orange' : 'muted'}>{level}</Badge></td></tr>;
}

export function RewardsPage() {
  const { state, metrics, user, redeemReward } = useStore();
  const { notify } = useToast();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [redeemed, setRedeemed] = useState<{ reward: Reward; id: string; date: string } | null>(null);

  const validatedRecords = state.records.filter((record) => record.userId === user?.id && record.validated);
  const devices = validatedRecords.reduce((sum, record) => sum + record.quantity, 0);
  const kg = validatedRecords.reduce((sum, record) => sum + record.weight, 0);
  const diversity = new Set(validatedRecords.map((record) => record.equipment)).size;
  const campaignCount = state.campaigns.filter((campaign) => campaign.participants.includes(user?.id ?? '')).length;
  const userPoints = metrics.points;
  const currentLevel = levelForPoints(userPoints);
  const currentLevelMin = levelThresholds.find((level) => level.name === currentLevel)?.min ?? 0;
  const next = nextLevel(userPoints);
  const progress = next ? Math.min(100, Math.round(((userPoints - currentLevelMin) / (next.min - currentLevelMin)) * 100)) : 100;

  const achievementProgress = useMemo(() => achievementDefinitions.map((achievement) => {
    const value = achievement.criteria === 'registro' ? (validatedRecords.length ? 1 : 0) : achievement.criteria === 'dispositivos' ? devices : achievement.criteria === 'kg' ? kg : achievement.criteria === 'campanha' ? campaignCount : diversity;
    return { ...achievement, value: Math.min(achievement.target, value), unlocked: value >= achievement.target };
  }), [campaignCount, devices, diversity, kg, validatedRecords.length]);

  const categories = Array.from(new Set(state.rewards.map((reward) => reward.category))).sort();
  const rewards = state.rewards.filter((reward) => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    return (category === 'all' || reward.category === category) && (!normalized || `${reward.name} ${reward.description}`.toLocaleLowerCase('pt-BR').includes(normalized));
  });

  const individualRanking = useMemo(() => state.users.filter((candidate) => candidate.id === user?.id || candidate.publicRanking).map((candidate) => ({ user: candidate, points: candidate.id === user?.id ? userPoints : pointsForUser(candidate.id, state.records) })).sort((a, b) => b.points - a.points), [state.records, state.users, user?.id, userPoints]);
  const institutionalRanking = useMemo(() => state.organizations.map((organization) => ({ organization, owner: state.users.find((candidate) => candidate.id === organization.userId), points: pointsForUser(organization.userId, state.records) })).filter((item) => item.owner?.publicRanking || item.owner?.id === user?.id).sort((a, b) => b.points - a.points), [state.organizations, state.records, state.users, user?.id]);

  function confirmRedemption() {
    if (!selectedReward) return;
    if (!selectedReward.available) { notify('Esta recompensa está indisponível no momento.', 'error'); return; }
    if (userPoints < selectedReward.cost) { notify('Seu saldo ainda não é suficiente para este resgate.', 'error'); return; }
    const result = redeemReward(selectedReward.id);
    if (!result.ok || !result.id) { notify(result.error ?? 'Não foi possível registrar o resgate.', 'error'); return; }
    const date = new Date().toISOString();
    setRedeemed({ reward: selectedReward, id: result.id, date });
    setSelectedReward(null);
    notify('Resgate registrado. O comprovante é demonstrativo.', 'success');
  }

  function downloadReceipt() {
    if (!redeemed) return;
    downloadText(`ecotech-resgate-${redeemed.id}.txt`, receiptText(redeemed.reward, redeemed.id, formatDate(redeemed.date), user?.name ?? 'Usuário'), 'text/plain;charset=utf-8');
  }

  if (!user) return <EmptyState title="Entre para consultar seus EcoPoints" description="Saldo, resgates e ranking são informações vinculadas ao usuário." action={<LinkButton to="/login" variant="primary">Entrar</LinkButton>} />;

  return <div className="page-stack">
    <PageHeader title="EcoPoints" description="Reconhecimento por destinações validadas. Nenhum ponto é concedido no momento do agendamento; recompensas e cupons desta tela são fictícios." />
    <section className="stat-grid"><MetricCard label="Saldo disponível" value={`${formatNumber(userPoints)} pts`} detail="após validações administrativas" icon={Sparkles} /><MetricCard label="Nível atual" value={currentLevel} detail={`${next ? `${formatNumber(next.min - userPoints)} pts até ${next.name}` : 'nível máximo demonstrativo'}`} icon={Award} /><MetricCard label="Equipamentos validados" value={formatNumber(devices)} detail={`${formatNumber(kg, 1)} kg registrados`} icon={Recycle} /><MetricCard label="Conquistas" value={`${achievementProgress.filter((achievement) => achievement.unlocked).length}/${achievementProgress.length}`} detail="progresso da jornada" icon={Trophy} /></section>
    <section className="two-column"><div className="panel"><div className="panel-header"><div><h2 style={{ margin: 0 }}>Próxima meta</h2><p className="muted small">{next ? `Chegue a ${formatNumber(next.min)} pontos para subir de nível.` : 'Você alcançou a última faixa.'}</p></div><Leaf size={20} aria-hidden="true" /></div><div className="progress" aria-label={`${progress}% da próxima meta`}><span style={{ width: `${progress}%` }} /></div><div className="panel-header" style={{ marginTop: 10 }}><span className="muted small">{formatNumber(userPoints)} pts</span><strong>{next ? `${formatNumber(next.min)} pts` : '100%'}</strong></div></div><div className="panel"><div className="panel-header"><div><h2 style={{ margin: 0 }}>Transparência</h2><p className="muted small">Como sua pontuação é formada</p></div><ShieldCheck size={20} aria-hidden="true" /></div><p className="small muted" style={{ marginBottom: 0 }}>Somente registros ambientais marcados como validados por um administrador entram no saldo. Estimativas de impacto não são medições científicas oficiais.</p></div></section>
    <section className="panel"><div className="panel-header"><div><h2 style={{ margin: 0 }}>Conquistas</h2><p className="muted small">Metas derivadas do seu histórico validado.</p></div><Medal size={20} aria-hidden="true" /></div><div className="cards-grid">{achievementProgress.map((achievement) => <article className="panel" key={achievement.title} style={{ background: achievement.unlocked ? '#f5fbf6' : '#fbfcfa' }}><div className="panel-header"><div><h3 style={{ margin: 0 }}>{achievement.title}</h3><p className="muted small" style={{ margin: '5px 0 0' }}>{achievement.description}</p></div>{achievement.unlocked ? <CheckCircle2 color="#16803c" size={21} aria-label="Desbloqueada" /> : <span className="muted small">{achievement.value}/{achievement.target}</span>}</div><div className="progress"><span style={{ width: `${Math.min(100, (achievement.value / achievement.target) * 100)}%` }} /></div></article>)}</div></section>
    <section className="panel"><div className="panel-header"><div><h2 style={{ margin: 0 }}>Recompensas demonstrativas</h2><p className="muted small">Itens de catálogo para apresentação; não são cupons reais.</p></div><Gift size={20} aria-hidden="true" /></div><div className="filter-row" style={{ alignItems: 'end', marginBottom: 16 }}><label className="field" style={{ flex: '1 1 260px' }}><span className="field-label">Buscar recompensa</span><span style={{ position: 'relative' }}><Search size={16} style={{ position: 'absolute', top: 12, left: 12 }} aria-hidden="true" /><input className="input" style={{ paddingLeft: 36 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou descrição" /></span></label><label className="field"><span className="field-label">Categoria</span><select className="select" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Todas</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>{rewards.length ? <div className="cards-grid">{rewards.map((reward) => <article className="panel" key={reward.id}><div className="panel-header"><div><Badge tone="orange">{reward.category}</Badge><h3 style={{ margin: '10px 0 0' }}>{reward.name}</h3></div><Gift size={23} aria-hidden="true" /></div><p className="muted small">{reward.description}</p><div className="panel-header" style={{ marginTop: 15 }}><strong>{formatNumber(reward.cost)} pts</strong><Badge tone={reward.available ? 'green' : 'muted'}>{reward.available ? 'Disponível' : 'Indisponível'}</Badge></div><Button type="button" variant="primary" onClick={() => setSelectedReward(reward)} disabled={!reward.available || userPoints < reward.cost} style={{ width: '100%', marginTop: 14 }}>{userPoints < reward.cost ? 'Saldo insuficiente' : 'Resgatar recompensa'}</Button></article>)}</div> : <EmptyState title="Nenhuma recompensa nessa categoria" description="Escolha outra categoria ou limpe a busca." />}</section>
    <section className="panel"><div className="panel-header"><div><h2 style={{ margin: 0 }}>Histórico de resgates</h2><p className="muted small">Registros vinculados somente ao seu usuário.</p></div><History size={20} aria-hidden="true" /></div>{state.redemptions.filter((redemption) => redemption.userId === user.id).length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Recompensa</th><th>Data</th><th>Custo</th><th>Comprovante</th></tr></thead><tbody>{state.redemptions.filter((redemption) => redemption.userId === user.id).map((redemption) => <tr key={redemption.id}><td><strong>{redemption.name}</strong></td><td>{formatDate(redemption.date)}</td><td>{formatNumber(redemption.cost)} pts</td><td><span className="muted small">{redemption.receipt}</span></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum resgate ainda" description="Quando você resgatar um item, o comprovante aparecerá aqui." />}</section>
    <section className="two-column"><div className="panel"><div className="panel-header"><div><h2 style={{ margin: 0 }}>Ranking individual</h2><p className="muted small">Só aparecem usuários que autorizaram ranking público, além de você.</p></div><Users size={20} /></div><div className="table-wrap"><table className="data-table"><thead><tr><th>#</th><th>Pessoa</th><th>Pontos</th><th>Nível</th></tr></thead><tbody>{individualRanking.map((entry, index) => <RankingRow key={entry.user.id} position={index + 1} name={entry.user.id === user.id ? `${entry.user.name} (você)` : entry.user.name} points={entry.points} level={levelForPoints(entry.points)} avatar={entry.user.avatar} />)}</tbody></table></div></div><div className="panel"><div className="panel-header"><div><h2 style={{ margin: 0 }}>Ranking institucional</h2><p className="muted small">Empresas e escolas com visibilidade pública habilitada.</p></div><Trophy size={20} /></div>{institutionalRanking.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>#</th><th>Instituição</th><th>Pontos</th><th>Nível</th></tr></thead><tbody>{institutionalRanking.map((entry, index) => <RankingRow key={entry.organization.id} position={index + 1} name={entry.organization.name} points={entry.points} level={levelForPoints(entry.points)} />)}</tbody></table></div> : <EmptyState title="Ranking institucional indisponível" description="Nenhuma instituição com ranking público foi cadastrada nesta demonstração." />}</div></section>
    <Modal open={Boolean(selectedReward)} title="Confirmar resgate" onClose={() => setSelectedReward(null)}>{selectedReward ? <><p>Você está prestes a registrar <strong>{selectedReward.name}</strong> por <strong>{formatNumber(selectedReward.cost)} EcoPoints</strong>.</p><div className="alert"><ShieldCheck size={17} aria-hidden="true" /><span>O saldo só é utilizado depois da sua confirmação. Este benefício é fictício e não gera cupom real.</span></div><div className="form-actions"><Button type="button" variant="ghost" onClick={() => setSelectedReward(null)}>Voltar</Button><Button type="button" variant="primary" onClick={confirmRedemption}>Confirmar resgate</Button></div></> : null}</Modal>
    <Modal open={Boolean(redeemed)} title="Resgate registrado" onClose={() => setRedeemed(null)}>{redeemed ? <><div className="success-panel"><CheckCircle2 size={20} /><div><strong>{redeemed.reward.name}</strong><p className="small" style={{ margin: '4px 0 0' }}>Comprovante {redeemed.id}</p></div></div><p className="muted small">Guarde o arquivo apenas como registro desta apresentação. Nenhum cupom ou benefício real foi emitido.</p><div className="form-actions"><Button type="button" variant="primary" onClick={downloadReceipt}><Download size={16} /> Baixar comprovante TXT</Button><Button type="button" variant="ghost" onClick={() => setRedeemed(null)}>Fechar</Button></div></> : null}</Modal>
  </div>;
}
