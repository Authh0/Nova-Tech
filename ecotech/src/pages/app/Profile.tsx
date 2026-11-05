import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Bell, Check, CircleHelp, MapPin, Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useStore } from '../../services/store';
import { Badge, Button, EmptyState, Modal, PageHeader, useToast } from '../../components/ui';
import { formatDate } from '../../utils';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome completo.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  city: z.string().trim().min(2, 'Informe sua cidade.'),
  avatar: z.string().trim().url('Use uma URL válida ou deixe em branco.').or(z.literal('')),
});

type ProfileForm = z.infer<typeof profileSchema>;

const avatarUrl = (value?: string) => value && /^https?:\/\//i.test(value) ? value : '';

export function ProfilePage() {
  const { user, updateProfile } = useStore();
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const form = useForm<ProfileForm>({ resolver: zodResolver(profileSchema), defaultValues: { name: user?.name ?? '', email: user?.email ?? '', city: user?.city ?? '', avatar: avatarUrl(user?.avatar) } });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = form;

  useEffect(() => {
    if (user) reset({ name: user.name, email: user.email, city: user.city, avatar: avatarUrl(user.avatar) });
  }, [user, reset]);

  if (!user) return <section className="page-stack"><EmptyState title="Perfil indisponível" description="Entre para visualizar e editar seus dados." /></section>;

  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const saveProfile = (values: ProfileForm) => {
    const result = updateProfile(values);
    if (result.ok) {
      notify('Perfil atualizado com sucesso.', 'success');
      setEditing(false);
    } else notify(result.error ?? 'Não foi possível atualizar o perfil.', 'error');
  };
  const togglePreference = (field: 'notificationEnabled' | 'publicRanking') => {
    const result = updateProfile({ [field]: !user[field] });
    if (result.ok) notify('Preferência atualizada.', 'success');
    else notify(result.error ?? 'Não foi possível atualizar a preferência.', 'error');
  };
  const addAddress = () => {
    const value = address.trim();
    if (!value) { notify('Informe um endereço antes de adicionar.', 'error'); return; }
    const result = updateProfile({ addresses: [...(user.addresses ?? []), value] });
    if (result.ok) { setAddress(''); notify('Endereço adicionado.', 'success'); } else notify(result.error ?? 'Não foi possível adicionar o endereço.', 'error');
  };
  const removeAddress = (index: number) => {
    const result = updateProfile({ addresses: (user.addresses ?? []).filter((_, addressIndex) => addressIndex !== index) });
    if (result.ok) notify('Endereço removido.', 'success'); else notify(result.error ?? 'Não foi possível remover o endereço.', 'error');
  };

  return (
    <section className="page-stack">
      <PageHeader title="Seu perfil" description="Mantenha seus dados e preferências da EcoTech atualizados." action={<Button variant="secondary" onClick={() => setHelpOpen(true)}><CircleHelp size={16} /> Ajuda</Button>} />
      <div className="profile-layout">
        <article className="panel profile-summary"><div className="profile-avatar">{avatarUrl(user.avatar) ? <img src={avatarUrl(user.avatar)} alt={`Avatar de ${user.name}`} /> : initials}</div><h2>{user.name}</h2><p className="muted">{user.email}</p><Badge tone="orange">{user.type === 'pessoa' ? 'Pessoa física' : user.type}</Badge><dl className="profile-facts"><div><dt>Cidade</dt><dd>{user.city}</dd></div><div><dt>Cadastro</dt><dd>{formatDate(user.createdAt)}</dd></div><div><dt>Conta</dt><dd>Dados demonstrativos locais</dd></div></dl></article>
        <article className="panel"><div className="panel-header"><div><h2>Dados pessoais</h2><p className="muted">Seu tipo de conta e permissões são definidos pelo sistema.</p></div>{!editing && <Button variant="secondary" onClick={() => setEditing(true)}><UserRound size={16} /> Editar perfil</Button>}</div>{editing ? <form className="form-grid" onSubmit={handleSubmit(saveProfile)} noValidate><label className="field"><span className="field-label">Nome</span><input className="input" {...register('name')} />{errors.name && <span className="field-error">{errors.name.message}</span>}</label><label className="field"><span className="field-label">E-mail</span><input className="input" type="email" {...register('email')} />{errors.email && <span className="field-error">{errors.email.message}</span>}</label><label className="field"><span className="field-label">Cidade</span><input className="input" {...register('city')} />{errors.city && <span className="field-error">{errors.city.message}</span>}</label><label className="field"><span className="field-label">Avatar (opcional)</span><input className="input" placeholder="https://…" {...register('avatar')} />{errors.avatar && <span className="field-error">{errors.avatar.message}</span>}</label><div className="form-actions"><Button type="button" variant="ghost" onClick={() => { reset(); setEditing(false); }}>Cancelar</Button><Button type="submit" variant="primary" disabled={isSubmitting}><Check size={16} /> Salvar alterações</Button></div></form> : <div className="data-list"><div className="row"><span className="muted">Nome</span><strong>{user.name}</strong></div><div className="row"><span className="muted">E-mail</span><strong>{user.email}</strong></div><div className="row"><span className="muted">Cidade</span><strong>{user.city}</strong></div><div className="row"><span className="muted">Tipo de conta</span><strong>{user.type === 'pessoa' ? 'Pessoa física' : user.type}</strong></div></div>}</article>
      </div>
      <div className="two-column">
        <article className="panel"><div className="panel-header"><div><h2>Endereços</h2><p className="muted">Use um endereço salvo para agilizar próximos agendamentos.</p></div><MapPin size={20} className="muted" /></div><div className="form-actions address-add"><input className="input" aria-label="Novo endereço salvo" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Rua, número, bairro e cidade" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addAddress(); } }} /><Button variant="secondary" onClick={addAddress}><Plus size={16} /> Adicionar</Button></div>{user.addresses?.length ? <div className="address-list">{user.addresses.map((item, index) => <div className="row" key={`${item}-${index}`}><span className="icon-box"><MapPin size={16} /></span><span>{item}</span><Button variant="ghost" onClick={() => removeAddress(index)} aria-label={`Remover endereço ${index + 1}`}><Trash2 size={16} /></Button></div>)}</div> : <p className="muted small">Nenhum endereço salvo.</p>}</article>
        <article className="panel"><div className="panel-header"><div><h2>Notificações e privacidade</h2><p className="muted">Você decide como a demonstração usa suas preferências.</p></div><ShieldCheck size={20} className="muted" /></div><div className="settings-list"><button type="button" className="setting-row" aria-pressed={user.notificationEnabled !== false} onClick={() => togglePreference('notificationEnabled')}><span className="icon-box"><Bell size={17} /></span><span><strong>Receber notificações</strong><small className="muted">Atualizações de agendamentos, campanhas e metas.</small></span><span className={`toggle ${user.notificationEnabled !== false ? 'is-on' : ''}`} aria-hidden="true"><span /></span></button><button type="button" className="setting-row" aria-pressed={Boolean(user.publicRanking)} onClick={() => togglePreference('publicRanking')}><span className="icon-box"><UsersIcon /></span><span><strong>Aparecer no ranking público</strong><small className="muted">Mostra apenas seu nome e pontos, sem dados de descarte.</small></span><span className={`toggle ${user.publicRanking ? 'is-on' : ''}`} aria-hidden="true"><span /></span></button></div><Button variant="ghost" onClick={() => setPrivacyOpen(true)}>Entender privacidade</Button></article>
      </div>
      <Modal open={helpOpen} title="Ajuda do perfil" onClose={() => setHelpOpen(false)}><div className="modal-copy"><p>Edite nome, e-mail, cidade e avatar opcional. Se você não enviar imagem, a EcoTech usa suas iniciais como avatar.</p><p>Endereços são armazenados localmente nesta demonstração e podem ser adicionados ou removidos a qualquer momento. O tipo de conta não pode ser editado pelo perfil.</p></div></Modal>
      <Modal open={privacyOpen} title="Privacidade e ranking" onClose={() => setPrivacyOpen(false)}><div className="modal-copy"><p>Os dados pessoais exibidos nesta área pertencem à conta ativa. Registros ambientais, agendamentos e resgates são filtrados pelo seu identificador.</p><p>Ao ativar o ranking, somente nome e pontuação podem ser exibidos em uma visão agregada. Estudantes e participantes de campanhas nunca são listados individualmente.</p><p>Esta versão é uma demonstração local: não envia e-mails nem sincroniza dados com um serviço externo.</p></div></Modal>
    </section>
  );
}

function UsersIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3" /><path d="M3 19a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5.8M18 19a5 5 0 0 0-2.5-4.3" /></svg>;
}
