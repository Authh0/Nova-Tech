import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { equipmentTypes, seedState } from '../data/seed';
import type {
  ActionResult,
  Address,
  AppState,
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  Campaign,
  CampaignInput,
  CollectionPoint,
  Equipment,
  EnvironmentalRecord,
  Metrics,
  Organization,
  StoreAPI,
  User,
  UserType,
} from '../types';

export const STORAGE_VERSION = 1;
export const STATE_STORAGE_KEY = 'ecotech:state:v1';
export const LOCAL_SESSION_KEY = 'ecotech:session:local:v1';
export const SESSION_SESSION_KEY = 'ecotech:session:session:v1';
export const DEMO_STORAGE_KEYS = [STATE_STORAGE_KEY, LOCAL_SESSION_KEY, SESSION_SESSION_KEY];

const USER_TYPES: UserType[] = ['pessoa', 'empresa', 'escola', 'ponto'];
const APPOINTMENT_STATUSES: AppointmentStatus[] = ['Solicitado', 'Confirmado', 'Em coleta', 'Concluído', 'Cancelado'];
const CAMPAIGN_CATEGORIES: Campaign['category'][] = ['Empresa', 'Escola', 'Comunidade'];
const MAX_APPOINTMENT_HOUR = 18 * 60;
const MIN_APPOINTMENT_HOUR = 8 * 60;

export interface DomainOutcome {
  state: AppState;
  result: ActionResult;
}

const ok = (state: AppState, id?: string): DomainOutcome => ({ state, result: { ok: true, id } });
const fail = (state: AppState, error: string): DomainOutcome => ({ state, result: { ok: false, error } });

function cloneState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState;
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomToken(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID().replaceAll('-', '').slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

function uniqueId(prefix: string, existing: string[]): string {
  let candidate = `${prefix}-${randomToken()}`;
  while (existing.includes(candidate)) candidate = `${prefix}-${randomToken()}`;
  return candidate;
}

function localDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function validUser(state: AppState, userId: string | null | undefined): User | null {
  if (!userId) return null;
  return state.users.find((candidate) => candidate.id === userId) ?? null;
}

function notificationsFor(state: AppState, userId: string, title: string, message: string, kind: 'appointment' | 'validation' | 'reward' | 'campaign', date = nowIso()) {
  if (validUser(state, userId)?.notificationEnabled === false) return state.notifications;
  return [...state.notifications, {
    id: uniqueId('notification', state.notifications.map((notification) => notification.id)),
    userId, title, message, date, read: false, kind,
  }];
}

function isAdmin(state: AppState, userId: string | null | undefined): boolean {
  return validUser(state, userId)?.role === 'admin';
}

function requiredText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isAddressComplete(address: Address | undefined): boolean {
  if (!address) return false;
  const required = [address.cep, address.street, address.number, address.district, address.city, address.state];
  return required.every(requiredText) && /^\d{8}$/.test(address.cep.replace(/\D/g, '')) && address.state.trim().length === 2;
}

function parseDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isFutureAppointment(date: string, time: string, now = new Date()): boolean {
  const parsed = parseDateTime(date, time);
  return parsed !== null && parsed.getTime() > now.getTime();
}

function isAllowedAppointmentTime(time: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  const [hours, minutes] = time.split(':').map(Number);
  if (hours > 23 || minutes > 59) return false;
  const total = hours * 60 + minutes;
  return total >= MIN_APPOINTMENT_HOUR && total <= MAX_APPOINTMENT_HOUR;
}

export function pointAcceptsEquipment(point: Pick<CollectionPoint, 'materials'>, equipment: Equipment[]): boolean {
  const accepted = new Set(point.materials.map((material) => material.trim().toLocaleLowerCase('pt-BR')));
  return equipment.every((item) => accepted.has(item.type.trim().toLocaleLowerCase('pt-BR')));
}

function pointOpenAt(point: CollectionPoint, date: string, time: string): boolean {
  const day = new Date(`${date}T12:00:00`).getDay();
  const hours = point.hours.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const weekdays = hours.includes('seg a sex') ? [1, 2, 3, 4, 5]
    : hours.includes('seg a qui') ? [1, 2, 3, 4]
      : hours.includes('ter a dom') ? [2, 3, 4, 5, 6, 0] : [];
  const saturday = /\bsab\b/.test(hours) && day === 6;
  const explicit = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][day];
  const openDay = weekdays.includes(day) || saturday || (!weekdays.length && new RegExp(`\\b${explicit}\\b`).test(hours));
  if (!openDay) return false;
  const section = point.hours.split(';').map((value) => value.trim()).find((value) => {
    const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    if (day === 6) return /\bsab\b/.test(normalized);
    if (weekdays.includes(day)) return normalized.startsWith('seg a') || normalized.startsWith('ter a');
    return new RegExp(`\\b${explicit}\\b`).test(normalized);
  }) ?? point.hours;
  const range = section.match(/(\d{1,2})h(\d{2})?\s*(?:as|às)\s*(\d{1,2})h(\d{2})?/i);
  if (!range) return false;
  const [, startHour, startMinute = '0', endHour, endMinute = '0'] = range;
  const toMinutes = (hour: string, minute: string) => Number(hour) * 60 + Number(minute);
  const selected = toMinutes(time.slice(0, 2), time.slice(3, 5));
  return selected >= toMinutes(startHour, startMinute) && selected <= toMinutes(endHour, endMinute);
}

function normalizedEquipment(equipment: Equipment[]): string {
  return equipment
    .map((item) => `${item.type.trim().toLowerCase()}|${item.quantity}|${item.condition.trim().toLowerCase()}|${item.notes.trim().toLowerCase()}`)
    .sort()
    .join(';;');
}

export function validateAppointmentInput(
  state: AppState,
  userId: string,
  input: AppointmentInput,
  now = new Date(),
): string | null {
  if (!validUser(state, userId)) return 'Faça login para criar um agendamento.';
  if (!Array.isArray(input.equipment) || input.equipment.length === 0) return 'Adicione pelo menos um equipamento.';
  for (const item of input.equipment) {
    if (!requiredText(item.type) || !equipmentTypes.includes(item.type)) return 'Selecione um tipo de equipamento válido.';
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) return 'As quantidades devem ser inteiras e positivas.';
    if (!requiredText(item.condition)) return 'Informe o estado de cada equipamento.';
    if (item.weight !== undefined && (!Number.isFinite(item.weight) || item.weight <= 0)) return 'O peso estimado deve ser positivo.';
  }
  if (input.mode !== 'entrega' && input.mode !== 'coleta') return 'Modalidade de agendamento inválida.';
  if (!isFutureAppointment(input.date, input.time, now)) return 'Escolha uma data e horário futuros.';
  if (!isAllowedAppointmentTime(input.time)) return 'Escolha um horário entre 08:00 e 18:00.';

  if (input.mode === 'entrega') {
    const point = state.points.find((candidate) => candidate.id === input.pointId);
    if (!point) return 'Selecione um ponto de coleta válido.';
    if (!point.open) return 'O ponto selecionado está indisponível.';
    if (!pointAcceptsEquipment(point, input.equipment)) return 'O ponto selecionado não recebe todos os equipamentos informados.';
    if (!pointOpenAt(point, input.date, input.time)) return 'O ponto está fechado nesse dia ou horário. Escolha outro horário disponível.';
  } else {
    if (!state.points.some((point) => point.open && point.pickup)) return 'Não há pontos com modalidade de coleta disponíveis nesta demonstração.';
    if (!isAddressComplete(input.address)) return 'Informe o endereço completo para a coleta.';
  }
  return null;
}

export function createAppointmentInState(
  state: AppState,
  userId: string,
  input: AppointmentInput,
  now = new Date(),
): DomainOutcome {
  const validationError = validateAppointmentInput(state, userId, input, now);
  if (validationError) return fail(state, validationError);

  const fingerprint = normalizedEquipment(input.equipment);
  const conflictingSlot = state.appointments.some((appointment) => {
    if (appointment.status === 'Cancelado' || appointment.date !== input.date || appointment.time !== input.time) return false;
    if (input.mode === 'entrega') return appointment.mode === 'entrega' && appointment.pointId === input.pointId;
    if (appointment.mode !== 'coleta' || !appointment.address || !input.address) return false;
    return appointment.address.cep.replace(/\D/g, '') === input.address.cep.replace(/\D/g, '')
      && appointment.address.street.trim().toLocaleLowerCase('pt-BR') === input.address.street.trim().toLocaleLowerCase('pt-BR')
      && appointment.address.number.trim() === input.address.number.trim();
  });
  if (conflictingSlot) return fail(state, 'Esse horário já está reservado para o local escolhido. Selecione outro horário disponível.');
  const duplicate = state.appointments.some((appointment) =>
    appointment.userId === userId &&
    appointment.status !== 'Cancelado' &&
    appointment.date === input.date &&
    appointment.time === input.time &&
    appointment.mode === input.mode &&
    appointment.pointId === input.pointId &&
    normalizedEquipment(appointment.equipment) === fingerprint,
  );
  if (duplicate) return fail(state, 'Este agendamento já foi enviado. Verifique seus agendamentos.');

  const id = uniqueId('appointment', state.appointments.map((appointment) => appointment.id));
  const protocolDate = input.date.replace(/-/g, '');
  let protocol = `ECO-${protocolDate}-${String(state.appointments.length + 1).padStart(3, '0')}`;
  while (state.appointments.some((appointment) => appointment.protocol === protocol)) {
    protocol = `ECO-${protocolDate}-${randomToken().slice(0, 4).toUpperCase()}`;
  }
  const createdAt = now.toISOString();
  const appointment: Appointment = {
    ...input,
    id,
    userId,
    protocol,
    status: 'Solicitado',
    createdAt,
    validated: false,
    equipment: input.equipment.map((item) => ({ ...item })),
    history: [{ date: createdAt, status: 'Solicitado' }],
  };
  const nextState: AppState = {
    ...state,
    appointments: [...state.appointments, appointment],
    notifications: notificationsFor(state, userId, 'Agendamento solicitado', `Seu protocolo ${protocol} foi criado e aguarda confirmação.`, 'appointment', createdAt),
  };
  return ok(nextState, id);
}

const allowedTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  Solicitado: ['Confirmado', 'Cancelado'],
  Confirmado: ['Em coleta', 'Cancelado'],
  'Em coleta': ['Concluído', 'Cancelado'],
  Concluído: [],
  Cancelado: [],
};

export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return APPOINTMENT_STATUSES.includes(to) && allowedTransitions[from].includes(to);
}

export function cancelAppointmentInState(state: AppState, userId: string, appointmentId: string): DomainOutcome {
  const actor = validUser(state, userId);
  if (!actor) return fail(state, 'Faça login para cancelar um agendamento.');
  const appointment = state.appointments.find((candidate) => candidate.id === appointmentId);
  if (!appointment) return fail(state, 'Agendamento não encontrado.');
  if (actor.role !== 'admin' && appointment.userId !== actor.id) return fail(state, 'Você não pode cancelar este agendamento.');
  if (appointment.status === 'Concluído') return fail(state, 'Agendamentos concluídos não podem ser cancelados.');
  if (appointment.status === 'Cancelado') return fail(state, 'Este agendamento já está cancelado.');
  if (!canTransitionAppointment(appointment.status, 'Cancelado')) return fail(state, 'A transição para cancelado não é permitida.');

  const date = nowIso();
  const nextAppointment: Appointment = {
    ...appointment,
    status: 'Cancelado',
    history: [...appointment.history, { date, status: 'Cancelado' }],
  };
  return ok({
    ...state,
    appointments: state.appointments.map((candidate) => candidate.id === appointmentId ? nextAppointment : candidate),
  }, appointmentId);
}

export function updateAppointmentStatusInState(
  state: AppState,
  userId: string,
  appointmentId: string,
  status: AppointmentStatus,
): DomainOutcome {
  if (!isAdmin(state, userId)) return fail(state, 'Apenas administradores podem atualizar status.');
  const appointment = state.appointments.find((candidate) => candidate.id === appointmentId);
  if (!appointment) return fail(state, 'Agendamento não encontrado.');
  if (appointment.validated && appointment.status === 'Concluído') return fail(state, 'Este descarte já foi validado.');
  if (appointment.status === status) return fail(state, 'O agendamento já está nesse status.');
  if (!canTransitionAppointment(appointment.status, status)) return fail(state, 'Transição de status não permitida.');

  const date = nowIso();
  const nextAppointment: Appointment = {
    ...appointment,
    status,
    history: [...appointment.history, { date, status }],
  };
  const statusMessages: Partial<Record<AppointmentStatus, { title: string; message: string; kind: 'appointment' | 'validation' }>> = {
    Confirmado: { title: 'Agendamento confirmado', message: `O protocolo ${appointment.protocol} foi confirmado.`, kind: 'appointment' },
    'Em coleta': { title: 'Coleta em andamento', message: `O protocolo ${appointment.protocol} está em andamento.`, kind: 'appointment' },
    Concluído: { title: 'Coleta concluída', message: `O protocolo ${appointment.protocol} aguarda validação administrativa para gerar EcoPoints.`, kind: 'appointment' },
    Cancelado: { title: 'Agendamento cancelado', message: `O protocolo ${appointment.protocol} foi cancelado.`, kind: 'appointment' },
  };
  const message = statusMessages[status];
  return ok({
    ...state,
    appointments: state.appointments.map((candidate) => candidate.id === appointmentId ? nextAppointment : candidate),
    ...(message ? { notifications: notificationsFor(state, appointment.userId, message.title, message.message, message.kind, date) } : {}),
  }, appointmentId);
}

function pointsForValidation(weight: number, devices: number): number {
  // Pontuação demonstrativa: 10 EcoPoints por kg + 20 por dispositivo.
  return Math.max(1, Math.round(weight * 10 + devices * 20));
}

export function validateAppointmentInState(
  state: AppState,
  userId: string,
  appointmentId: string,
  weight: number,
  destination: string,
  notes?: string,
): DomainOutcome {
  if (!isAdmin(state, userId)) return fail(state, 'Apenas administradores podem validar descartes.');
  const appointment = state.appointments.find((candidate) => candidate.id === appointmentId);
  if (!appointment) return fail(state, 'Agendamento não encontrado.');
  if (appointment.validated) return fail(state, 'Este agendamento já foi validado.');
  if (appointment.status === 'Cancelado') return fail(state, 'Agendamentos cancelados não podem ser validados.');
  if (appointment.status !== 'Concluído') return fail(state, 'Conclua a etapa de coleta antes de validar a destinação.');
  if (!Number.isFinite(weight) || weight <= 0) return fail(state, 'Informe um peso positivo.');
  if (!requiredText(destination)) return fail(state, 'Informe a destinação do material.');

  const totalDevices = appointment.equipment.reduce((sum, item) => sum + item.quantity, 0);
  if (totalDevices <= 0) return fail(state, 'O agendamento não possui equipamentos válidos.');
  const totalPoints = pointsForValidation(weight, totalDevices);
  const totalQuantity = totalDevices;
  let allocatedWeight = 0;
  let allocatedPoints = 0;
  const generatedRecordIds: string[] = [];
  const validationDate = localDate();
  const createdRecords: EnvironmentalRecord[] = appointment.equipment.map((item, index) => {
    const isLast = index === appointment.equipment.length - 1;
    const itemWeight = isLast ? round(weight - allocatedWeight) : round(weight * item.quantity / totalQuantity);
    const itemPoints = isLast ? totalPoints - allocatedPoints : Math.max(1, Math.round(totalPoints * item.quantity / totalQuantity));
    allocatedWeight = round(allocatedWeight + itemWeight);
    allocatedPoints += itemPoints;
    const id = uniqueId('record', [...state.records.map((record) => record.id), ...generatedRecordIds]);
    generatedRecordIds.push(id);
    return {
      id,
      appointmentId,
      userId: appointment.userId,
      date: validationDate,
      equipment: item.type,
      quantity: item.quantity,
      weight: itemWeight,
      destination: destination.trim(),
      points: itemPoints,
      co2: round(itemWeight * 1.5),
      validated: true,
    };
  });

  const timestamp = nowIso();
  const nextEquipment = appointment.equipment.map((item) => ({
    ...item,
    notes: notes?.trim() ? `${item.notes}${item.notes ? ' · ' : ''}Validação: ${notes.trim()}` : item.notes,
  }));
  const nextAppointment: Appointment = {
    ...appointment,
    equipment: nextEquipment,
    status: 'Concluído',
    validated: true,
    history: appointment.status === 'Concluído'
      ? appointment.history
      : [...appointment.history, { date: timestamp, status: 'Concluído' }],
  };
  const nextState: AppState = {
    ...state,
    appointments: state.appointments.map((candidate) => candidate.id === appointmentId ? nextAppointment : candidate),
    records: [...state.records, ...createdRecords],
    notifications: notificationsFor(state, appointment.userId, 'EcoPoints recebidos', `O protocolo ${appointment.protocol} foi validado e gerou ${totalPoints} EcoPoints.`, 'validation', timestamp),
  };
  return ok(nextState, appointmentId);
}

function levelForScore(score: number): string {
  if (score >= 1000) return 'Lenda da Sustentabilidade';
  if (score >= 600) return 'EcoHero';
  if (score >= 300) return 'Guardião Ambiental';
  if (score >= 100) return 'Explorador Sustentável';
  return 'Iniciante Verde';
}

/**
 * Métricas derivadas exclusivamente dos registros validados e do ledger de resgates.
 * EcoScore demonstrativo = min(1000, kg × 4 + dispositivos × 2 + participações × 10).
 * O nível considera EcoPoints acumulados em registros validados, sem regredir após resgates.
 * CO₂ é uma estimativa local de demonstração com fator fixo de 1,5 kg CO₂e/kg.
 */
export function metricsFor(state: AppState, userId?: string): Metrics {
  const records = state.records.filter((record) => record.validated && (!userId || record.userId === userId));
  const redemptions = state.redemptions.filter((redemption) => !userId || redemption.userId === userId);
  const campaigns = state.campaigns.filter((campaign) => campaign.participants.length > 0 && (!userId || campaign.participants.includes(userId))).length;
  const kg = round(records.reduce((sum, record) => sum + record.weight, 0));
  const devices = records.reduce((sum, record) => sum + record.quantity, 0);
  const earnedPoints = records.reduce((sum, record) => sum + record.points, 0);
  const spentPoints = redemptions.reduce((sum, redemption) => sum + redemption.cost, 0);
  const points = Math.max(0, earnedPoints - spentPoints);
  const co2 = round(kg * 1.5);
  const score = Math.round(Math.min(1000, kg * 4 + devices * 2 + campaigns * 10));
  return { kg, devices, points, co2, score, level: levelForScore(earnedPoints), campaigns };
}

export function globalMetrics(state: AppState): Metrics {
  return metricsFor(state);
}

export function redeemRewardInState(state: AppState, userId: string, rewardId: string, now = new Date()): DomainOutcome {
  if (!validUser(state, userId)) return fail(state, 'Faça login para resgatar uma recompensa.');
  const reward = state.rewards.find((candidate) => candidate.id === rewardId);
  if (!reward) return fail(state, 'Recompensa não encontrada.');
  if (!reward.available) return fail(state, 'Esta recompensa está indisponível.');
  if (!Number.isFinite(reward.cost) || reward.cost <= 0) return fail(state, 'Recompensa com custo inválido.');
  const balance = metricsFor(state, userId).points;
  if (balance < reward.cost) return fail(state, 'Saldo insuficiente para este resgate.');

  const date = now.toISOString();
  const dateOnly = localDate(now);
  const duplicate = state.redemptions.some((redemption) =>
    redemption.userId === userId && redemption.rewardId === rewardId && redemption.date.slice(0, 10) === dateOnly,
  );
  if (duplicate) return fail(state, 'Este resgate já foi enviado hoje.');

  const id = uniqueId('redemption', state.redemptions.map((redemption) => redemption.id));
  const receipt = `ECO-REC-${dateOnly.replace(/-/g, '')}-${String(state.redemptions.length + 1).padStart(3, '0')}`;
  const nextState: AppState = {
    ...state,
    redemptions: [...state.redemptions, { id, userId, rewardId, name: reward.name, cost: reward.cost, date, receipt }],
    notifications: notificationsFor(state, userId, 'Recompensa resgatada', `${reward.name} reservado. Comprovante ${receipt}.`, 'reward', date),
  };
  return ok(nextState, id);
}

export function joinCampaignInState(state: AppState, userId: string, campaignId: string): DomainOutcome {
  if (!validUser(state, userId)) return fail(state, 'Faça login para participar de uma campanha.');
  const campaign = state.campaigns.find((candidate) => candidate.id === campaignId);
  if (!campaign) return fail(state, 'Campanha não encontrada.');
  if (!campaign.active || new Date(`${campaign.endDate}T23:59:59`) < new Date()) return fail(state, 'Esta campanha já foi encerrada.');
  if (campaign.participants.includes(userId)) return fail(state, 'Você já participa desta campanha.');
  const nextCampaign: Campaign = { ...campaign, participants: [...campaign.participants, userId] };
  return ok({
    ...state,
    campaigns: state.campaigns.map((candidate) => candidate.id === campaignId ? nextCampaign : candidate),
    notifications: notificationsFor(state, userId, 'Campanha iniciada', `Sua participação em ${campaign.title} foi registrada.`, 'campaign'),
  }, campaignId);
}

function validCampaignInput(input: CampaignInput): string | null {
  if (!requiredText(input.title) || !requiredText(input.description) || !requiredText(input.organization)) return 'Título, descrição e organização são obrigatórios.';
  if (!CAMPAIGN_CATEGORIES.includes(input.category)) return 'Categoria de campanha inválida.';
  if (!Number.isFinite(input.goal) || input.goal <= 0) return 'A meta da campanha deve ser positiva.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) return 'Informe uma data de encerramento válida.';
  if (Number.isNaN(new Date(`${input.endDate}T23:59:59`).getTime())) return 'Informe uma data de encerramento válida.';
  return null;
}

function institutionMatchesCampaign(user: User, category: Campaign['category']): boolean {
  return (category === 'Empresa' && user.type === 'empresa') || (category === 'Escola' && user.type === 'escola')
    || (category === 'Comunidade' && (user.type === 'empresa' || user.type === 'escola'));
}

export function saveCampaignInState(
  state: AppState,
  userId: string,
  input: CampaignInput,
  campaignId?: string,
  now = new Date(),
): DomainOutcome {
  const actor = validUser(state, userId);
  if (!actor) return fail(state, 'Faça login para salvar uma campanha.');
  if (actor.role !== 'admin' && !institutionMatchesCampaign(actor, input.category)) return fail(state, 'Somente a instituição responsável pode criar esta categoria de campanha.');
  const inputError = validCampaignInput(input);
  if (inputError) return fail(state, inputError);
  if (input.active && new Date(`${input.endDate}T23:59:59`).getTime() <= now.getTime()) return fail(state, 'A campanha ativa precisa terminar no futuro.');

  if (campaignId) {
    const campaign = state.campaigns.find((candidate) => candidate.id === campaignId);
    if (!campaign) return fail(state, 'Campanha não encontrada.');
    if (campaign.ownerId !== actor.id && actor.role !== 'admin') return fail(state, 'Você não pode editar esta campanha.');
    if (!campaign.active) return fail(state, 'Campanhas encerradas não podem ser editadas.');
    const nextCampaign: Campaign = { ...campaign, ...input, ownerId: campaign.ownerId, participants: [...campaign.participants], kg: campaign.kg };
    return ok({ ...state, campaigns: state.campaigns.map((candidate) => candidate.id === campaignId ? nextCampaign : candidate) }, campaignId);
  }

  const id = uniqueId('campaign', state.campaigns.map((campaign) => campaign.id));
  const campaign: Campaign = { ...input, id, ownerId: actor.id, participants: [], kg: 0 };
  return ok({ ...state, campaigns: [...state.campaigns, campaign] }, id);
}

export function closeCampaignInState(state: AppState, userId: string, campaignId: string): DomainOutcome {
  const actor = validUser(state, userId);
  if (!actor) return fail(state, 'Faça login para encerrar uma campanha.');
  const campaign = state.campaigns.find((candidate) => candidate.id === campaignId);
  if (!campaign) return fail(state, 'Campanha não encontrada.');
  if (campaign.ownerId !== actor.id && actor.role !== 'admin') return fail(state, 'Você não pode encerrar esta campanha.');
  if (!campaign.active) return fail(state, 'Esta campanha já está encerrada.');
  return ok({
    ...state,
    campaigns: state.campaigns.map((candidate) => candidate.id === campaignId ? { ...candidate, active: false } : candidate),
  }, campaignId);
}

export function saveOrganizationInState(
  state: AppState,
  userId: string,
  input: Omit<Organization, 'id' | 'userId'>,
): DomainOutcome {
  const actor = validUser(state, userId);
  if (!actor) return fail(state, 'Faça login para salvar uma instituição.');
  if (actor.role !== 'admin' && actor.type !== input.type) return fail(state, 'O tipo da instituição deve corresponder ao tipo do usuário.');
  const required = [input.name, input.document, input.email, input.phone, input.address, input.responsible];
  if (!required.every(requiredText) || !isEmail(input.email)) return fail(state, 'Preencha os dados obrigatórios da instituição.');
  if (input.classes?.some((item) => item.kg < 0 || item.participants < 0 || !requiredText(item.name))) return fail(state, 'Dados de turma inválidos.');

  const existing = state.organizations.find((organization) => organization.userId === actor.id && organization.type === input.type);
  const organization: Organization = {
    ...input,
    id: existing?.id ?? uniqueId('organization', state.organizations.map((item) => item.id)),
    userId: existing?.userId ?? actor.id,
  };
  return ok({
    ...state,
    organizations: existing
      ? state.organizations.map((item) => item.id === existing.id ? organization : item)
      : [...state.organizations, organization],
  }, organization.id);
}

const profileKeys = new Set(['name', 'city', 'email', 'notificationEnabled', 'publicRanking', 'addresses', 'avatar']);

export function updateProfileInState(state: AppState, userId: string, patch: Partial<User>): DomainOutcome {
  const actor = validUser(state, userId);
  if (!actor) return fail(state, 'Faça login para atualizar seu perfil.');
  const keys = Object.keys(patch);
  if (keys.some((key) => !profileKeys.has(key))) return fail(state, 'O perfil só permite atualizar dados pessoais e preferências.');
  if (patch.name !== undefined && !requiredText(patch.name)) return fail(state, 'Informe um nome válido.');
  if (patch.city !== undefined && !requiredText(patch.city)) return fail(state, 'Informe uma cidade válida.');
  if (patch.email !== undefined && (!isEmail(patch.email) || state.users.some((user) => user.id !== userId && user.email.toLowerCase() === patch.email?.trim().toLowerCase()))) return fail(state, 'Informe um e-mail válido e ainda não utilizado.');
  if (patch.addresses !== undefined && (!Array.isArray(patch.addresses) || patch.addresses.some((address) => !requiredText(address)))) return fail(state, 'Os endereços devem ser textos preenchidos.');
  const updatedUser: User = { ...actor, ...patch, email: patch.email?.trim() ?? actor.email };
  return ok({ ...state, users: state.users.map((user) => user.id === userId ? updatedUser : user) }, userId);
}

function validPointInput(input: Omit<CollectionPoint, 'id'>): string | null {
  const required = [input.name, input.address, input.district, input.city, input.cep, input.hours, input.phone, input.email, input.instructions];
  if (!required.every(requiredText) || !isEmail(input.email)) return 'Preencha os dados obrigatórios do ponto.';
  if (!/^\d{8}$/.test(input.cep.replace(/\D/g, ''))) return 'Informe um CEP válido.';
  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90 || !Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) return 'Informe latitude entre -90 e 90 e longitude entre -180 e 180.';
  if (!Array.isArray(input.materials) || input.materials.length === 0) return 'Informe ao menos um material aceito.';
  if (!['Ponto de coleta', 'Empresa', 'Escola'].includes(input.category)) return 'Categoria de ponto inválida.';
  return null;
}

export function savePointInState(state: AppState, userId: string, input: Omit<CollectionPoint, 'id'>, pointId?: string): DomainOutcome {
  if (!isAdmin(state, userId)) return fail(state, 'Apenas administradores podem salvar pontos.');
  const inputError = validPointInput(input);
  if (inputError) return fail(state, inputError);
  if (pointId && !state.points.some((point) => point.id === pointId)) return fail(state, 'Ponto não encontrado.');
  const id = pointId ?? uniqueId('point', state.points.map((point) => point.id));
  const point: CollectionPoint = { ...input, id, materials: [...input.materials] };
  return ok({ ...state, points: pointId ? state.points.map((candidate) => candidate.id === pointId ? point : candidate) : [...state.points, point] }, id);
}

export function deletePointInState(state: AppState, userId: string, pointId: string): DomainOutcome {
  if (!isAdmin(state, userId)) return fail(state, 'Apenas administradores podem excluir pontos.');
  if (!state.points.some((point) => point.id === pointId)) return fail(state, 'Ponto não encontrado.');
  if (state.appointments.some((appointment) => appointment.pointId === pointId)) return fail(state, 'O ponto possui agendamentos vinculados e não pode ser excluído.');
  return ok({ ...state, points: state.points.filter((point) => point.id !== pointId) }, pointId);
}

export function setRewardAvailabilityInState(state: AppState, userId: string, rewardId: string, available: boolean): DomainOutcome {
  if (!isAdmin(state, userId)) return fail(state, 'Apenas administradores podem alterar a disponibilidade.');
  if (!state.rewards.some((reward) => reward.id === rewardId)) return fail(state, 'Recompensa não encontrada.');
  return ok({ ...state, rewards: state.rewards.map((reward) => reward.id === rewardId ? { ...reward, available } : reward) }, rewardId);
}

export function issueCertificateInState(state: AppState, userId: string, organizationName: string, campaignId?: string): DomainOutcome {
  const actor = validUser(state, userId);
  if (!actor) return fail(state, 'Faça login para emitir um certificado demonstrativo.');
  const organization = state.organizations.find((candidate) => candidate.name.trim().toLowerCase() === organizationName.trim().toLowerCase());
  if (!organization || !['empresa', 'escola'].includes(organization.type)) return fail(state, 'Informe uma empresa ou escola cadastrada.');
  if (actor.role !== 'admin' && organization.userId !== userId) return fail(state, 'Somente a instituição responsável pode emitir este certificado.');
  if (campaignId && !state.campaigns.some((campaign) => campaign.id === campaignId && (actor.role === 'admin' || campaign.ownerId === userId))) return fail(state, 'Campanha não encontrada ou não pertence à instituição.');
  const id = uniqueId('certificate', state.certificates.map((certificate) => certificate.id));
  const code = `ECO-CERT-${new Date().getFullYear()}-${String(state.certificates.length + 1).padStart(3, '0')}`;
  const certificate = { id, userId: organization.userId, organization: organization.name, campaignId, date: localDate(), code };
  return ok({ ...state, certificates: [...state.certificates, certificate] }, id);
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function utf8Base64(value: string): string {
  return base64Url(new TextEncoder().encode(value));
}

function fallbackDigest(value: string): string {
  // Fallback mínimo para ambientes sem WebCrypto; não guarda nem devolve a senha.
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function randomSalt(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return base64Url(bytes);
  }
  return `${Date.now()}-${randomToken()}`;
}

export async function hashPassword(password: string, salt = randomSalt()): Promise<string> {
  const payload = new TextEncoder().encode(`${salt}:${password}`);
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.subtle) {
    const digest = await cryptoApi.subtle.digest('SHA-256', payload);
    return `v1$${utf8Base64(salt)}$${base64Url(new Uint8Array(digest))}`;
  }
  return `v0$${utf8Base64(salt)}$${fallbackDigest(`${salt}:${password}`)}`;
}

async function verifyPassword(password: string, storedHash: string | undefined): Promise<boolean> {
  if (!storedHash) return false;
  const [version, encodedSalt, encodedDigest] = storedHash.split('$');
  if (!version || !encodedSalt || !encodedDigest) return false;
  let salt: string;
  try {
    salt = new TextDecoder().decode(decodeBase64Url(encodedSalt));
  } catch {
    return false;
  }
  if (version === 'v1' && !globalThis.crypto?.subtle) return false;
  const candidate = await hashPassword(password, salt);
  return candidate === storedHash;
}

function storage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window[kind] ?? null;
  } catch {
    return null;
  }
}

interface PersistedEnvelope {
  version: number;
  state: AppState;
}

function readEnvelope(): AppState | null {
  const stored = storage('localStorage')?.getItem(STATE_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as PersistedEnvelope;
    if (parsed.version !== STORAGE_VERSION || !parsed.state || !Array.isArray(parsed.state.users)) return null;
    return parsed.state;
  } catch {
    return null;
  }
}

function readSessionId(): string | null {
  const local = storage('localStorage')?.getItem(LOCAL_SESSION_KEY);
  const session = storage('sessionStorage')?.getItem(SESSION_SESSION_KEY);
  return local || session || null;
}

function loadInitialState(): AppState {
  const persisted = readEnvelope();
  const next = cloneState(persisted ?? seedState);
  const sessionId = readSessionId();
  next.sessionUserId = next.users.some((user) => user.id === sessionId) ? sessionId : null;
  return next;
}

function persistState(state: AppState): void {
  const target = storage('localStorage');
  if (!target) return;
  try {
    const persisted: AppState = { ...state, sessionUserId: null };
    const envelope: PersistedEnvelope = { version: STORAGE_VERSION, state: persisted };
    target.setItem(STATE_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // A aplicação continua funcionando em modo memória quando o storage é bloqueado.
  }
}

function setSessionId(userId: string | null, remember: boolean): void {
  const local = storage('localStorage');
  const session = storage('sessionStorage');
  try {
    if (remember) {
      local?.setItem(LOCAL_SESSION_KEY, userId ?? '');
      session?.removeItem(SESSION_SESSION_KEY);
    } else {
      session?.setItem(SESSION_SESSION_KEY, userId ?? '');
      local?.removeItem(LOCAL_SESSION_KEY);
    }
    if (!userId) {
      local?.removeItem(LOCAL_SESSION_KEY);
      session?.removeItem(SESSION_SESSION_KEY);
    }
  } catch {
    // Storage indisponível não impede a sessão em memória.
  }
}

const StoreContext = createContext<StoreAPI | null>(null);

export function StoreProvider({ children }: { children?: ReactNode }) {
  const [state, setState] = useState<AppState>(loadInitialState);

  useEffect(() => {
    persistState(state);
  }, [state]);

  const user = useMemo(() => validUser(state, state.sessionUserId), [state]);
  const metrics = useMemo(() => metricsFor(state, state.sessionUserId ?? undefined), [state]);

  const login = useCallback(async (email: string, password: string, remember = false): Promise<ActionResult> => {
    const normalizedEmail = email.trim().toLowerCase();
    const candidate = state.users.find((item) => item.email.toLowerCase() === normalizedEmail);
    if (!candidate || !(await verifyPassword(password, candidate.passwordHash))) return { ok: false, error: 'E-mail ou senha inválidos.' };
    setState({ ...state, sessionUserId: candidate.id });
    setSessionId(candidate.id, remember);
    return { ok: true, id: candidate.id };
  }, [state]);

  const register = useCallback(async (input: { name: string; email: string; password: string; type: UserType }): Promise<ActionResult> => {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (!requiredText(name) || !isEmail(email)) return { ok: false, error: 'Informe nome e e-mail válidos.' };
    if (!USER_TYPES.includes(input.type)) return { ok: false, error: 'Tipo de usuário inválido.' };
    if (input.password.length < 6) return { ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
    if (state.users.some((item) => item.email.toLowerCase() === email)) return { ok: false, error: 'Este e-mail já está cadastrado.' };
    const id = uniqueId('user', state.users.map((item) => item.id));
    const passwordHash = await hashPassword(input.password);
    const newUser: User = {
      id,
      name,
      email,
      type: input.type,
      role: 'user',
      city: 'Palmas',
      createdAt: nowIso(),
      passwordHash,
      notificationEnabled: true,
      publicRanking: false,
      addresses: [],
    };
    setState({ ...state, users: [...state.users, newUser], sessionUserId: id });
    setSessionId(id, false);
    return { ok: true, id };
  }, [state]);

  const demoLogin = useCallback((type: UserType | 'admin' = 'pessoa') => {
    const id = type === 'admin' ? 'demo-admin' : `demo-${type}`;
    if (!state.users.some((candidate) => candidate.id === id)) return;
    setState({ ...state, sessionUserId: id });
    setSessionId(id, false);
  }, [state]);

  const logout = useCallback(() => {
    setState({ ...state, sessionUserId: null });
    setSessionId(null, false);
  }, [state]);

  const updateProfile = useCallback((patch: Partial<User>): ActionResult => {
    if (!state.sessionUserId) return { ok: false, error: 'Faça login para atualizar seu perfil.' };
    const outcome = updateProfileInState(state, state.sessionUserId, patch);
    if (outcome.result.ok) setState(outcome.state);
    return outcome.result;
  }, [state]);

  const createAppointment = useCallback((input: AppointmentInput): ActionResult => {
    if (!state.sessionUserId) return { ok: false, error: 'Faça login para criar um agendamento.' };
    const outcome = createAppointmentInState(state, state.sessionUserId, input);
    if (outcome.result.ok) setState(outcome.state);
    return outcome.result;
  }, [state]);

  const cancelAppointment = useCallback((id: string): ActionResult => {
    if (!state.sessionUserId) return { ok: false, error: 'Faça login para cancelar um agendamento.' };
    const outcome = cancelAppointmentInState(state, state.sessionUserId, id);
    if (outcome.result.ok) setState(outcome.state);
    return outcome.result;
  }, [state]);

  const updateAppointmentStatus = useCallback((id: string, status: AppointmentStatus): ActionResult => {
    if (!state.sessionUserId) return { ok: false, error: 'Faça login para atualizar o status.' };
    const outcome = updateAppointmentStatusInState(state, state.sessionUserId, id, status);
    if (outcome.result.ok) setState(outcome.state);
    return outcome.result;
  }, [state]);

  const validateAppointment = useCallback((id: string, weight: number, destination: string, notes?: string): ActionResult => {
    if (!state.sessionUserId) return { ok: false, error: 'Faça login para validar descartes.' };
    const outcome = validateAppointmentInState(state, state.sessionUserId, id, weight, destination, notes);
    if (outcome.result.ok) setState(outcome.state);
    return outcome.result;
  }, [state]);

  const redeemReward = useCallback((id: string): ActionResult => {
    if (!state.sessionUserId) return { ok: false, error: 'Faça login para resgatar uma recompensa.' };
    const outcome = redeemRewardInState(state, state.sessionUserId, id);
    if (outcome.result.ok) setState(outcome.state);
    return outcome.result;
  }, [state]);

  const joinCampaign = useCallback((id: string): ActionResult => {
    if (!state.sessionUserId) return { ok: false, error: 'Faça login para participar de uma campanha.' };
    const outcome = joinCampaignInState(state, state.sessionUserId, id);
    if (outcome.result.ok) setState(outcome.state);
    return outcome.result;
  }, [state]);

  const saveCampaign = useCallback((input: CampaignInput, id?: string): ActionResult => {
    if (!state.sessionUserId) return { ok: false, error: 'Faça login para salvar uma campanha.' };
    const outcome = saveCampaignInState(state, state.sessionUserId, input, id);
    if (outcome.result.ok) setState(outcome.state);
    return outcome.result;
  }, [state]);

  const closeCampaign = useCallback((id: string): ActionResult => {
    if (!state.sessionUserId) return { ok: false, error: 'Faça login para encerrar uma campanha.' };
    const outcome = closeCampaignInState(state, state.sessionUserId, id);
    if (outcome.result.ok) setState(outcome.state);
    return outcome.result;
  }, [state]);

  const saveOrganization = useCallback((input: Omit<Organization, 'id' | 'userId'>): ActionResult => {
    if (!state.sessionUserId) return { ok: false, error: 'Faça login para salvar uma instituição.' };
    const outcome = saveOrganizationInState(state, state.sessionUserId, input);
    if (outcome.result.ok) setState(outcome.state);
    return outcome.result;
  }, [state]);

  const markNotification = useCallback((id?: string) => {
    if (!state.sessionUserId) return;
    setState({
      ...state,
      notifications: state.notifications.map((notification) => notification.userId === state.sessionUserId && (!id || notification.id === id) ? { ...notification, read: true } : notification),
    });
  }, [state]);

  const savePoint = useCallback((input: Omit<CollectionPoint, 'id'>, id?: string): ActionResult => {
    if (!state.sessionUserId) return { ok: false, error: 'Faça login para salvar pontos.' };
    const outcome = savePointInState(state, state.sessionUserId, input, id);
    if (outcome.result.ok) setState(outcome.state);
    return outcome.result;
  }, [state]);

  const deletePoint = useCallback((id: string): ActionResult => {
    if (!state.sessionUserId) return { ok: false, error: 'Faça login para excluir pontos.' };
    const outcome = deletePointInState(state, state.sessionUserId, id);
    if (outcome.result.ok) setState(outcome.state);
    return outcome.result;
  }, [state]);

  const setRewardAvailability = useCallback((id: string, available: boolean): ActionResult => {
    if (!state.sessionUserId) return { ok: false, error: 'Faça login para alterar recompensas.' };
    const outcome = setRewardAvailabilityInState(state, state.sessionUserId, id, available);
    if (outcome.result.ok) setState(outcome.state);
    return outcome.result;
  }, [state]);

  const issueCertificate = useCallback((organization: string, campaignId?: string): ActionResult => {
    if (!state.sessionUserId) return { ok: false, error: 'Faça login para emitir certificados.' };
    const outcome = issueCertificateInState(state, state.sessionUserId, organization, campaignId);
    if (outcome.result.ok) setState(outcome.state);
    return outcome.result;
  }, [state]);

  const resetDemo = useCallback(() => {
    for (const key of DEMO_STORAGE_KEYS) {
      try {
        storage('localStorage')?.removeItem(key);
        storage('sessionStorage')?.removeItem(key);
      } catch {
        // Storage pode estar bloqueado; o reset em memória ainda é aplicado.
      }
    }
    setState(cloneState(seedState));
  }, []);

  const api = useMemo<StoreAPI>(() => ({
    state,
    user,
    metrics,
    login,
    register,
    demoLogin,
    logout,
    updateProfile,
    createAppointment,
    cancelAppointment,
    updateAppointmentStatus,
    validateAppointment,
    redeemReward,
    joinCampaign,
    saveCampaign,
    closeCampaign,
    saveOrganization,
    markNotification,
    savePoint,
    deletePoint,
    setRewardAvailability,
    issueCertificate,
    resetDemo,
  }), [
    state,
    user,
    metrics,
    login,
    register,
    demoLogin,
    logout,
    updateProfile,
    createAppointment,
    cancelAppointment,
    updateAppointmentStatus,
    validateAppointment,
    redeemReward,
    joinCampaign,
    saveCampaign,
    closeCampaign,
    saveOrganization,
    markNotification,
    savePoint,
    deletePoint,
    setRewardAvailability,
    issueCertificate,
    resetDemo,
  ]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreAPI {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore deve ser usado dentro de StoreProvider.');
  return context;
}
