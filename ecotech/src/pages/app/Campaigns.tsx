import { useMemo, useState } from 'react';
import { BookOpen, CalendarDays, Check, ChevronRight, CircleHelp, LockKeyhole, Users } from 'lucide-react';
import { useStore } from '../../services/store';
import { Badge, Button, EmptyState, Modal, PageHeader, useToast } from '../../components/ui';
import { formatDate, formatNumber, todayISO } from '../../utils';
import type { Campaign } from '../../types';

type CategoryFilter = 'Todas' | Campaign['category'];
type StatusFilter = 'Todas' | 'Ativas' | 'Encerradas';

const guides = [
  { name: 'Smartphones', preparation: 'Faça backup e remova chip e cartão de memória.', care: 'Mantenha a bateria sem sinais de estufamento.', risk: 'Não perfure nem pressione a bateria.', where: 'Ponto que aceite pequenos eletrônicos.' },
  { name: 'Notebooks', preparation: 'Apague dados, saia das contas e remova acessórios.', care: 'Transporte fechado e protegido de umidade.', risk: 'Não abra o equipamento em casa.', where: 'Ponto de coleta de informática.' },
  { name: 'Computadores', preparation: 'Desconecte cabos e limpe apenas a parte externa.', care: 'Embale monitor e gabinete separadamente.', risk: 'Não desmonte fontes ou placas.', where: 'EcoPoint com recebimento de informática.' },
  { name: 'Tablets', preparation: 'Faça backup e restaure o aparelho quando possível.', care: 'Evite calor, água e impactos.', risk: 'Baterias de lítio não devem ser desmontadas.', where: 'Ponto de pequenos eletrônicos.' },
  { name: 'Monitores', preparation: 'Remova cabos e não tente retirar a tela.', care: 'Leve na posição vertical, com proteção.', risk: 'Telas quebradas e componentes internos podem ferir.', where: 'Ponto que informe recebimento de monitores.' },
  { name: 'Cabos', preparation: 'Separe cabos de energia, dados e carregadores.', care: 'Organize sem forçar conectores.', risk: 'Não queime ou descasque o revestimento.', where: 'Ponto com triagem de acessórios.' },
  { name: 'Carregadores', preparation: 'Separe o carregador do equipamento e retire sujeiras.', care: 'Não use carregador danificado para testar.', risk: 'Não corte fios nem abra a fonte.', where: 'Ponto de eletrônicos e acessórios.' },
  { name: 'Teclados', preparation: 'Remova pilhas, se houver, e faça limpeza externa.', care: 'Proteja contra umidade.', risk: 'Não descarte pilhas junto com o teclado.', where: 'Ponto de periféricos.' },
  { name: 'Mouses', preparation: 'Retire pilhas e organize receptor ou cabo.', care: 'Não molhe durante a preparação.', risk: 'Separe pilhas e baterias para fluxo próprio.', where: 'Ponto de periféricos ou eletrônicos.' },
  { name: 'Impressoras', preparation: 'Retire papel e cartuchos conforme orientação do fabricante.', care: 'Transporte na posição indicada.', risk: 'Não abra cartuchos ou manipule toner.', where: 'Ponto que aceite equipamentos de impressão.' },
  { name: 'Pilhas', preparation: 'Isole terminais com fita e mantenha unidades separadas.', care: 'Guarde em recipiente seco e não metálico.', risk: 'Nunca misture pilhas com lixo comum ou fogo.', where: 'Coletores específicos de pilhas e baterias.' },
  { name: 'Baterias', preparation: 'Não remova a bateria interna de aparelhos.', care: 'Isole terminais de baterias removíveis.', risk: 'Nunca perfure, desmonte, aqueça ou coloque na água.', where: 'Ponto especializado em baterias; peça orientação.' },
] as const;

export function CampaignsPage() {
  const { state, user, joinCampaign } = useStore();
  const { notify } = useToast();
  const [category, setCategory] = useState<CategoryFilter>('Todas');
  const [status, setStatus] = useState<StatusFilter>('Ativas');
  const [search, setSearch] = useState('');
  const [guide, setGuide] = useState<(typeof guides)[number] | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const campaigns = useMemo(() => state.campaigns.filter((campaign) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${campaign.title} ${campaign.description} ${campaign.organization}`.toLowerCase().includes(query);
    const matchesCategory = category === 'Todas' || campaign.category === category;
    const effectiveActive = campaign.active && campaign.endDate >= todayISO();
    const matchesStatus = status === 'Todas' || (status === 'Ativas' ? effectiveActive : !effectiveActive);
    return matchesSearch && matchesCategory && matchesStatus;
  }), [state.campaigns, search, category, status]);

  const handleJoin = (campaign: Campaign) => {
    if (!user || joiningId) return;
    setJoiningId(campaign.id);
    const result = joinCampaign(campaign.id);
    setJoiningId(null);
    if (result.ok) notify('Você entrou na campanha. Boa participação!', 'success');
    else notify(result.error ?? 'Não foi possível entrar nesta campanha.', 'error');
  };

  return (
    <section className="page-stack">
      <PageHeader title="Campanhas que mobilizam" description="Participe de iniciativas de empresas, escolas e comunidades. O impacto exibido é demonstrativo e agregado." action={<Button variant="secondary" onClick={() => setHelpOpen(true)}><CircleHelp size={16} /> Como funciona</Button>} />
      <div className="alert" role="note"><Users size={18} /><span>Participantes são exibidos apenas como quantidade agregada. A EcoTech não expõe nomes ou dados pessoais de estudantes.</span></div>
      <div className="filter-row"><label className="field filter-field"><span className="field-label">Buscar</span><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, organização ou descrição" /></label><label className="field filter-field"><span className="field-label">Categoria</span><select className="select" value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)}><option>Todas</option><option>Empresa</option><option>Escola</option><option>Comunidade</option></select></label><label className="field filter-field"><span className="field-label">Status</span><select className="select" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option>Todas</option><option>Ativas</option><option>Encerradas</option></select></label></div>
      <div className="filter-summary"><span className="muted small">{formatNumber(campaigns.length)} campanha(s) encontrada(s)</span><button type="button" className="muted small" onClick={() => { setSearch(''); setCategory('Todas'); setStatus('Ativas'); }}>Limpar filtros</button></div>
      {campaigns.length ? <div className="campaign-grid">{campaigns.map((campaign) => { const active = campaign.active && campaign.endDate >= todayISO(); const joined = !!user && campaign.participants.includes(user.id); const progress = campaign.goal > 0 ? Math.min(100, (campaign.kg / campaign.goal) * 100) : 0; return <article className="panel campaign-card" key={campaign.id}><div className="campaign-top"><Badge tone={active ? 'green' : 'muted'}>{active ? 'Ativa' : 'Encerrada'}</Badge><Badge tone="orange">{campaign.category}</Badge></div><h2>{campaign.title}</h2><p className="muted">{campaign.description}</p><p className="small muted">Organização: {campaign.organization}</p><div className="campaign-stat"><span><strong>{formatNumber(campaign.kg)} kg</strong><small className="muted"> de {formatNumber(campaign.goal)} kg · demo</small></span><span><strong>{formatNumber(campaign.participants.length)}</strong><small className="muted"> participantes</small></span></div><div className="progress"><span style={{ width: `${progress}%` }} /></div><div className="campaign-footer"><span className="small muted"><CalendarDays size={14} /> Até {formatDate(campaign.endDate)}</span>{joined ? <Badge tone="green"><Check size={14} /> Você participa</Badge> : active ? <Button variant="primary" onClick={() => handleJoin(campaign)} disabled={!user || joiningId === campaign.id}>{joiningId === campaign.id ? 'Entrando…' : 'Participar'}</Button> : <Badge tone="muted">Encerrada</Badge>}</div></article>; })}</div> : <EmptyState title="Nenhuma campanha encontrada" description="Tente buscar outro termo ou alterar os filtros de categoria e status." />}
      <article className="panel guide-panel"><div className="panel-header"><div><span className="eyebrow">Inteligência de descarte</span><h2>Prepare seu equipamento antes de entregar</h2><p className="muted">Escolha um tipo para receber orientações objetivas de preparação, privacidade e segurança.</p></div><BookOpen size={22} className="muted" /></div><div className="guide-grid">{guides.map((item) => <button type="button" className="guide-chip" key={item.name} onClick={() => setGuide(item)}><span>{item.name}</span><ChevronRight size={15} /></button>)}</div></article>
      <Modal open={!!guide} title={guide ? `Guia: ${guide.name}` : 'Guia educativo'} onClose={() => setGuide(null)}>{guide && <div className="modal-copy"><p><strong>Preparação:</strong> {guide.preparation}</p><p><strong>Privacidade e cuidado:</strong> {guide.care}</p><p><strong>Risco:</strong> {guide.risk}</p><p><strong>Onde descartar:</strong> {guide.where}</p><div className="alert"><LockKeyhole size={17} /><span>Apague dados pessoais quando possível. Nunca desmonte baterias, fontes ou equipamentos; procure o ponto de coleta para orientação.</span></div></div>}</Modal>
      <Modal open={helpOpen} title="Como funcionam as campanhas" onClose={() => setHelpOpen(false)}><div className="modal-copy"><p>Campanhas conectam organizações e comunidade em torno de um objetivo ambiental. Ao participar, sua conta entra uma única vez na lista agregada de participantes.</p><p>Os quilogramas e metas exibidos são dados de demonstração da campanha e não equivalem a pesagem certificada. A validação ambiental definitiva acontece nos registros administrativos.</p><p>Você pode filtrar por categoria, status e texto. Depois de entrar, a ação é registrada pela store e o botão não cria participação duplicada.</p></div></Modal>
    </section>
  );
}
