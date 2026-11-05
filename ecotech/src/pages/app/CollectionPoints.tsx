import { useMemo, useState } from 'react';
import {
  Accessibility,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Phone,
  Recycle,
  Search,
  Truck,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { LinkButton, Badge, Button, EmptyState, PageHeader, useToast } from '../../components/ui';
import { useStore } from '../../services/store';
import { formatNumber } from '../../utils';
import type { CollectionPoint } from '../../types';
import CollectionMap from '../../components/CollectionMap';

interface Coordinates {
  lat: number;
  lng: number;
}

type DistanceFilter = 'any' | '5' | '10' | '25';

function haversineKm(from: Coordinates, to: Coordinates) {
  const earthRadius = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointAddress(point: CollectionPoint) {
  return `${point.address}, ${point.district} · ${point.city} · CEP ${point.cep}`;
}

function directionUrl(point: CollectionPoint) {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
}

function PointCard({
  point,
  selected,
  distance,
  onSelect,
}: {
  point: CollectionPoint;
  selected: boolean;
  distance?: number;
  onSelect: () => void;
}) {
  return (
    <article className={`panel ${selected ? 'is-selected' : ''}`} style={{ borderColor: selected ? '#e96925' : undefined }}>
      <div className="panel-header" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{point.name}</h3>
            <Badge tone="orange">Demonstração</Badge>
          </div>
          <p className="muted small" style={{ margin: '6px 0 0' }}>{point.category}</p>
        </div>
        <Badge tone={point.open ? 'green' : 'muted'}>{point.open ? 'Aberto' : 'Fechado'}</Badge>
      </div>
      <div className="small" style={{ display: 'grid', gap: 9 }}>
        <span><MapPin size={15} aria-hidden="true" /> {pointAddress(point)}</span>
        <span><Clock3 size={15} aria-hidden="true" /> {point.hours}</span>
        {distance !== undefined ? <span className="muted">{formatNumber(distance, 1)} km da sua localização</span> : null}
      </div>
      <div className="chip-row" style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {point.materials.slice(0, 4).map((material) => <span className="chip" key={material}>{material}</span>)}
        {point.materials.length > 4 ? <span className="chip">+{point.materials.length - 4}</span> : null}
      </div>
      <div className="form-actions" style={{ marginTop: 16 }}>
        <Button type="button" variant={selected ? 'primary' : 'secondary'} onClick={onSelect}>
          <MapPin size={16} aria-hidden="true" /> {selected ? 'Selecionado no mapa' : 'Ver no mapa'}
        </Button>
        <LinkButton to={`/app/pontos-de-coleta/${point.id}`} variant="ghost">Detalhes</LinkButton>
        <a className="small" href={directionUrl(point)} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Navigation size={15} aria-hidden="true" /> Como chegar
        </a>
      </div>
    </article>
  );
}

export function CollectionPointsPage() {
  const { state } = useStore();
  const { notify } = useToast();
  const points = state.points ?? [];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [material, setMaterial] = useState('all');
  const [availability, setAvailability] = useState<'all' | 'open' | 'closed'>('all');
  const [pickup, setPickup] = useState<'all' | 'yes' | 'no'>('all');
  const [accessible, setAccessible] = useState<'all' | 'yes' | 'no'>('all');
  const [distanceLimit, setDistanceLimit] = useState<DistanceFilter>('any');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>(points[0]?.id);

  const categories = useMemo(() => Array.from(new Set(points.map((point) => point.category))), [points]);
  const materials = useMemo(() => Array.from(new Set(points.flatMap((point) => point.materials))).sort(), [points]);

  const filteredPoints = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return points.filter((point) => {
      const searchable = [point.name, point.district, point.city, point.cep, ...point.materials]
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (category !== 'all' && point.category !== category) return false;
      if (material !== 'all' && !point.materials.includes(material)) return false;
      if (availability === 'open' && !point.open) return false;
      if (availability === 'closed' && point.open) return false;
      if (pickup === 'yes' && !point.pickup) return false;
      if (pickup === 'no' && point.pickup) return false;
      if (accessible === 'yes' && !point.accessible) return false;
      if (accessible === 'no' && point.accessible) return false;
      if (distanceLimit !== 'any' && location && haversineKm(location, point) > Number(distanceLimit)) return false;
      return true;
    });
  }, [accessible, availability, category, distanceLimit, location, material, pickup, points, query]);

  const selectedPoint = filteredPoints.find((point) => point.id === selectedId) ?? filteredPoints[0];

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationMessage('Seu navegador não oferece localização. Distância não será filtrada.');
      return;
    }
    setLocationMessage('Solicitando permissão de localização…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setDistanceLimit('any');
        setLocationMessage('Localização disponível apenas nesta sessão.');
        notify('Localização autorizada. Agora você pode filtrar por distância.', 'success');
      },
      () => setLocationMessage('Não foi possível acessar sua localização. Autorize o navegador para usar o filtro de distância.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  function clearFilters() {
    setQuery('');
    setCategory('all');
    setMaterial('all');
    setAvailability('all');
    setPickup('all');
    setAccessible('all');
    setDistanceLimit('any');
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Encontre o destino certo para seus eletrônicos."
        description="Compare materiais aceitos, horários e acessibilidade antes de escolher o ponto ideal. Os cadastros abaixo são fictícios e servem para demonstração."
        action={<LinkButton to="/app/agendamentos/novo" variant="primary"><Truck size={17} aria-hidden="true" /> Agendar coleta</LinkButton>}
      />

      <section className="panel" aria-label="Busca e filtros de pontos de coleta">
        <div className="filter-row" style={{ alignItems: 'end' }}>
          <label className="field" style={{ flex: '1 1 280px' }}>
            <span className="field-label">Pesquisar ponto, bairro, cidade, CEP ou material</span>
            <span style={{ position: 'relative' }}>
              <Search size={17} aria-hidden="true" style={{ position: 'absolute', left: 12, top: 12, color: '#7a8984' }} />
              <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: Plano Diretor, notebook…" style={{ paddingLeft: 38 }} />
            </span>
          </label>
          <label className="field"><span className="field-label">Estabelecimento</span><select className="select" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Todos</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="field"><span className="field-label">Material aceito</span><select className="select" value={material} onChange={(event) => setMaterial(event.target.value)}><option value="all">Todos</option>{materials.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="field"><span className="field-label">Disponibilidade</span><select className="select" value={availability} onChange={(event) => setAvailability(event.target.value as typeof availability)}><option value="all">Todos</option><option value="open">Abertos agora</option><option value="closed">Fechados agora</option></select></label>
        </div>
        <div className="filter-row" style={{ marginTop: 12, alignItems: 'end' }}>
          <label className="field"><span className="field-label">Atendimento</span><select className="select" value={pickup} onChange={(event) => setPickup(event.target.value as typeof pickup)}><option value="all">Entrega e coleta</option><option value="yes">Aceita coleta</option><option value="no">Somente entrega</option></select></label>
          <label className="field"><span className="field-label">Acessibilidade</span><select className="select" value={accessible} onChange={(event) => setAccessible(event.target.value as typeof accessible)}><option value="all">Todos</option><option value="yes">Acessíveis</option><option value="no">Não informados</option></select></label>
          <label className="field"><span className="field-label">Distância máxima</span><select className="select" value={distanceLimit} disabled={!location} onChange={(event) => setDistanceLimit(event.target.value as DistanceFilter)}><option value="any">Sem limite</option><option value="5">Até 5 km</option><option value="10">Até 10 km</option><option value="25">Até 25 km</option></select></label>
          <Button type="button" variant="secondary" onClick={requestLocation}><LocateFixed size={17} aria-hidden="true" /> Usar minha localização</Button>
          <Button type="button" variant="ghost" onClick={clearFilters}>Limpar filtros</Button>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          {locationMessage || 'O filtro de distância fica desativado até você autorizar a localização.'}
        </p>
      </section>

      <div className="two-column" style={{ gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, .9fr)' }}>
        <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header" style={{ padding: '18px 20px' }}>
            <div><h2 style={{ margin: 0 }}>Pontos próximos</h2><p className="muted small" style={{ margin: '4px 0 0' }}>{filteredPoints.length} resultado(s) · base demonstrativa</p></div>
            <Badge tone="orange">{points.length} fictícios</Badge>
          </div>
          <div style={{ padding: 16, display: 'grid', gap: 12, maxHeight: 650, overflow: 'auto' }}>
            {filteredPoints.length ? filteredPoints.map((point) => (
              <PointCard
                key={point.id}
                point={point}
                selected={selectedPoint?.id === point.id}
                distance={location ? haversineKm(location, point) : undefined}
                onSelect={() => setSelectedId(point.id)}
              />
            )) : <EmptyState title="Nenhum ponto encontrado" description="Tente remover algum filtro ou pesquisar por outro material." action={<Button type="button" variant="secondary" onClick={clearFilters}>Limpar filtros</Button>} />}
          </div>
        </section>

        <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header" style={{ padding: '18px 20px' }}><div><h2 style={{ margin: 0 }}>Mapa de atendimento</h2><p className="muted small" style={{ margin: '4px 0 0' }}>Clique em um marcador para consultar o ponto.</p></div><MapPin size={19} aria-hidden="true" /></div>
          <CollectionMap points={filteredPoints} selectedId={selectedPoint?.id} onSelect={(point) => setSelectedId(point.id)} userLocation={location} height="min(62vh, 620px)" />
        </section>
      </div>
    </div>
  );
}

export function CollectionPointDetailPage() {
  const { state } = useStore();
  const { id } = useParams<{ id: string }>();
  const point = state.points.find((item) => item.id === id);

  if (!point) {
    return <EmptyState title="Ponto de coleta não encontrado" description="O cadastro pode ter sido removido ou não está disponível nesta demonstração." action={<LinkButton to="/app/pontos-de-coleta" variant="primary"><ArrowLeft size={16} /> Voltar aos pontos</LinkButton>} />;
  }

  return (
    <div className="page-stack">
      <LinkButton to="/app/pontos-de-coleta" variant="ghost"><ArrowLeft size={16} aria-hidden="true" /> Voltar para pontos</LinkButton>
      <PageHeader title={point.name} description="Detalhes do atendimento e materiais aceitos. Este registro é fictício e não representa um parceiro real." action={<a href={directionUrl(point)} target="_blank" rel="noreferrer" className="btn btn-secondary"><ExternalLink size={16} aria-hidden="true" /> Abrir rota</a>} />
      <div className="two-column">
        <section className="panel" style={{ padding: 0, overflow: 'hidden' }}><CollectionMap points={[point]} selectedId={point.id} height="420px" /></section>
        <section className="panel">
          <div className="panel-header"><h2 style={{ margin: 0 }}>Informações do ponto</h2><Badge tone={point.open ? 'green' : 'muted'}>{point.open ? 'Aberto agora' : 'Fechado agora'}</Badge></div>
          <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div className="row"><MapPin size={17} aria-hidden="true" /><div><strong>Endereço</strong><span className="muted small">{pointAddress(point)}</span></div></div>
            <div className="row"><Clock3 size={17} aria-hidden="true" /><div><strong>Horários</strong><span className="muted small">{point.hours}</span></div></div>
            <div className="row"><Truck size={17} aria-hidden="true" /><div><strong>Atendimento</strong><span className="muted small">{point.pickup ? 'Entrega e coleta' : 'Somente entrega'}</span></div></div>
            <div className="row"><Accessibility size={17} aria-hidden="true" /><div><strong>Acessibilidade</strong><span className="muted small">{point.accessible ? 'Acessível' : 'Não informado'}</span></div></div>
          </div>
          <div className="alert" style={{ marginTop: 18 }}><Recycle size={17} aria-hidden="true" /><span>{point.instructions}</span></div>
        </section>
      </div>
      <div className="two-column">
        <section className="panel"><div className="panel-header"><h2 style={{ margin: 0 }}>Materiais aceitos</h2><Badge tone="green">{point.materials.length} categorias</Badge></div><div className="chip-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{point.materials.map((item) => <span className="chip" key={item}>{item}</span>)}</div></section>
        <section className="panel"><div className="panel-header"><h2 style={{ margin: 0 }}>Contato demonstrativo</h2><Badge tone="muted">Confirme antes de ir</Badge></div><p className="muted small">Os canais abaixo pertencem ao cadastro fictício da apresentação e não devem ser tratados como contatos reais.</p><div className="small" style={{ display: 'grid', gap: 12 }}><span><Phone size={16} aria-hidden="true" /> {point.phone || 'Telefone não informado na demonstração'}</span><span><ExternalLink size={16} aria-hidden="true" /> {point.email || 'E-mail não informado na demonstração'}</span></div></section>
      </div>
      <section className="success-panel"><CheckCircle2 size={19} aria-hidden="true" /><div><strong>Como chegar com segurança</strong><p className="small" style={{ margin: '5px 0 0' }}>Use a navegação externa pelas coordenadas cadastradas e confirme horário, recebimento e materiais diretamente no local. A EcoTech não inventa contatos nem garante atendimento fora desta demonstração.</p></div></section>
    </div>
  );
}
