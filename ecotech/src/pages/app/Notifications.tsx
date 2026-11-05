import { useMemo, useState } from 'react';
import { Bell, CheckCheck, Inbox, MailOpen } from 'lucide-react';
import { useStore } from '../../services/store';
import { Badge, Button, EmptyState, PageHeader, useToast } from '../../components/ui';
import { formatDate } from '../../utils';
import type { Notification as AppNotification } from '../../types';

function notificationTone(kind: string): 'orange' | 'green' | 'muted' | 'red' {
  const value = kind.toLowerCase();
  if (value.includes('erro') || value.includes('cancel')) return 'red';
  if (value.includes('coleta') || value.includes('meta') || value.includes('conquista')) return 'green';
  if (value.includes('recompensa') || value.includes('campanha')) return 'orange';
  return 'muted';
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function NotificationsPage() {
  const { state, user, markNotification } = useStore();
  const { notify } = useToast();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const userId = user?.id ?? '';
  const notifications = useMemo(() => state.notifications.filter((item) => item.userId === userId).sort((a, b) => b.date.localeCompare(a.date)), [state.notifications, userId]);
  const visible = useMemo(() => onlyUnread ? notifications.filter((item) => !item.read) : notifications, [notifications, onlyUnread]);
  const unread = notifications.filter((item) => !item.read).length;

  const markOne = (notification: AppNotification) => {
    if (notification.read) return;
    markNotification(notification.id);
    notify('Notificação marcada como lida.', 'success');
  };
  const markAll = () => {
    if (!unread) return;
    markNotification();
    notify('Todas as notificações foram marcadas como lidas.', 'success');
  };

  if (!user) return <section className="page-stack"><EmptyState title="Entre para ver suas notificações" description="Avisos e atualizações pertencem à conta ativa." /></section>;

  return (
    <section className="page-stack">
      <PageHeader title="Notificações" description="Acompanhe atualizações de agendamentos, campanhas e conquistas." action={<Button variant="secondary" onClick={markAll} disabled={!unread}><CheckCheck size={16} /> Marcar todas como lidas</Button>} />
      <div className="notification-toolbar"><button type="button" className={`chip ${onlyUnread ? 'is-active' : ''}`} onClick={() => setOnlyUnread((current) => !current)}><MailOpen size={15} /> {onlyUnread ? 'Mostrando não lidas' : `Todas (${notifications.length})`}</button><Badge tone={unread ? 'orange' : 'green'}>{unread ? `${unread} não lida(s)` : 'Tudo em dia'}</Badge></div>
      {visible.length ? <div className="notification-list">{visible.map((notification) => <article className={`panel notification-card ${notification.read ? 'is-read' : 'is-unread'}`} key={notification.id}><span className="icon-box"><Bell size={18} /></span><div className="notification-content"><div className="notification-heading"><h2>{notification.title}</h2><Badge tone={notificationTone(notification.kind)}>{notification.read ? 'Lida' : 'Nova'}</Badge></div><p>{notification.message}</p><time className="muted small" dateTime={notification.date}>{dateTime(notification.date)} · {formatDate(notification.date)}</time></div>{!notification.read && <Button variant="ghost" onClick={() => markOne(notification)}>Marcar como lida</Button>}</article>)}</div> : <EmptyState title={onlyUnread ? 'Nenhuma notificação não lida' : 'Sua caixa está vazia'} description={onlyUnread ? 'Você já conferiu todas as atualizações da sua conta.' : 'Quando houver uma atualização de agendamento, campanha ou conquista, ela aparecerá aqui.'} action={onlyUnread ? <Button variant="secondary" onClick={() => setOnlyUnread(false)}><Inbox size={16} /> Ver todas</Button> : undefined} />}
    </section>
  );
}
