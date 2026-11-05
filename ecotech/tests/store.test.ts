import { describe, expect, it } from 'vitest';
import { equipmentTypes, seedState, teamMembers } from '../src/data/seed';
import {
  cancelAppointmentInState,
  createAppointmentInState,
  deletePointInState,
  joinCampaignInState,
  metricsFor,
  redeemRewardInState,
  savePointInState,
  updateAppointmentStatusInState,
  updateProfileInState,
  validateAppointmentInState,
  hashPassword,
} from '../src/services/store';
import type { AppState, AppointmentInput } from '../src/types';

function copyState(): AppState {
  return JSON.parse(JSON.stringify(seedState)) as AppState;
}

function futureDate(days = 3): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function appointmentInput(overrides: Partial<AppointmentInput> = {}): AppointmentInput {
  return {
    equipment: [{ type: 'Smartphones', quantity: 2, condition: 'Usado', notes: 'Teste' }],
    mode: 'entrega',
    pointId: 'point-palmas-centro',
    date: futureDate(),
    time: '10:00',
    ...overrides,
  };
}

describe('seed demonstrativo', () => {
  it('expõe os 12 equipamentos e os nomes oficiais sem alterações', () => {
    expect(equipmentTypes).toEqual([
      'Smartphones', 'Notebooks', 'Computadores', 'Tablets', 'Monitores', 'Cabos',
      'Carregadores', 'Teclados', 'Mouses', 'Impressoras', 'Pilhas', 'Baterias',
    ]);
    expect(teamMembers).toEqual([
      'Pedro Sales',
      'Mauro Filho Lima Noleto',
      'Kauã Guilherme Laurentino Brito',
      'Isaac Ramos Rodrigues Monteiro',
      'João Antonio Nozue Bueno',
      'Luca Bernardo Kemper Garcia',
      'Julio Keven Silva Melo',
      'Matheus Henrique Dos Santos Sousa Ferraz',
    ]);
  });

  it('mantém oito pontos em Palmas e saldo derivado dos registros validados', () => {
    const metrics = metricsFor(seedState, 'demo-pessoa');
    expect(seedState.points).toHaveLength(8);
    expect(seedState.points.every((point) => point.city === 'Palmas' && point.demo)).toBe(true);
    expect(metrics.kg).toBe(65);
    expect(metrics.devices).toBe(23);
    expect(metrics.points).toBe(1250);
    expect(metrics.co2).toBe(97.5);
    expect(seedState.records.filter((record) => record.userId === 'demo-pessoa' && record.validated)).toHaveLength(9);
    expect(seedState.records.every((record) => {
      const appointment = seedState.appointments.find((item) => item.id === record.appointmentId);
      return appointment?.userId === record.userId && appointment.status === 'Concluído' && appointment.validated;
    })).toBe(true);
  });
});

describe('agendamentos e validação administrativa', () => {
  it('rejeita equipamentos vazios, data passada, horário inválido e endereço incompleto', () => {
    const state = copyState();
    expect(createAppointmentInState(state, 'demo-pessoa', appointmentInput({ equipment: [] })).result.ok).toBe(false);
    expect(createAppointmentInState(state, 'demo-pessoa', appointmentInput({ date: '2020-01-01' })).result.error).toMatch(/futuros/i);
    expect(createAppointmentInState(state, 'demo-pessoa', appointmentInput({ time: '07:00' })).result.error).toMatch(/08:00/i);
    expect(createAppointmentInState(state, 'demo-pessoa', appointmentInput({ mode: 'coleta', pointId: undefined })).result.error).toMatch(/endereço completo/i);
    expect(createAppointmentInState(state, 'demo-pessoa', appointmentInput({ pointId: 'point-inexistente' })).result.error).toMatch(/ponto de coleta válido/i);
    expect(createAppointmentInState(state, 'demo-pessoa', appointmentInput({ pointId: 'point-taquaralto' })).result.error).toMatch(/não recebe todos/i);
    expect(createAppointmentInState(state, 'demo-pessoa', appointmentInput({ pointId: 'point-palmas-centro', time: '17:00', date: '2026-11-07' })).result.error).toMatch(/fechado nesse dia/i);
  });

  it('impede dupla submissão do mesmo agendamento', () => {
    const state = copyState();
    const input = appointmentInput();
    const first = createAppointmentInState(state, 'demo-pessoa', input);
    expect(first.result.ok).toBe(true);
    const second = createAppointmentInState(first.state, 'demo-pessoa', input);
    expect(second.result.ok).toBe(false);
    expect(second.result.error).toMatch(/reservado para o local/i);
  });

  it('nega transição de status e cancelamento para usuário sem permissão', () => {
    const state = copyState();
    expect(updateAppointmentStatusInState(state, 'demo-pessoa', 'appointment-004', 'Em coleta').result.ok).toBe(false);
    expect(cancelAppointmentInState(state, 'demo-empresa', 'appointment-001').result.ok).toBe(false);
  });

  it('valida uma única vez, cria registros e só então contabiliza impacto', () => {
    const state = copyState();
    const before = metricsFor(state, 'demo-pessoa');
    expect(validateAppointmentInState(state, 'demo-admin', 'appointment-004', 8, 'Reciclagem certificada — Palmas').result.error).toMatch(/Conclua a etapa/i);
    const inCollection = updateAppointmentStatusInState(state, 'demo-admin', 'appointment-004', 'Em coleta').state;
    const completed = updateAppointmentStatusInState(inCollection, 'demo-admin', 'appointment-004', 'Concluído').state;
    const first = validateAppointmentInState(completed, 'demo-admin', 'appointment-004', 8, 'Reciclagem certificada — Palmas', 'Conferido no recebimento');
    expect(first.result.ok).toBe(true);
    expect(first.state.appointments.find((appointment) => appointment.id === 'appointment-004')?.validated).toBe(true);
    expect(first.state.records.filter((record) => record.appointmentId === 'appointment-004')).toHaveLength(2);
    expect(metricsFor(first.state, 'demo-pessoa').kg).toBe(before.kg + 8);
    expect(validateAppointmentInState(first.state, 'demo-admin', 'appointment-004', 8, 'Outra destinação').result.ok).toBe(false);
    expect(validateAppointmentInState(state, 'demo-pessoa', 'appointment-004', 8, 'Outra destinação').result.ok).toBe(false);
  });
});

describe('recompensas, campanhas, perfil e integridade', () => {
  it('rejeita resgate sem saldo suficiente e evita participação duplicada', () => {
    const state = copyState();
    expect(redeemRewardInState(state, 'demo-ponto', 'reward-kit').result.error).toMatch(/Saldo insuficiente/i);
    expect(joinCampaignInState(state, 'demo-pessoa', 'campaign-escola').result.error).toMatch(/já participa/i);
  });

  it('não permite patch de privilégio no perfil', () => {
    const state = copyState();
    const outcome = updateProfileInState(state, 'demo-pessoa', { role: 'admin' });
    expect(outcome.result.ok).toBe(false);
    expect(outcome.state.users.find((user) => user.id === 'demo-pessoa')?.role).toBe('user');
  });

  it('respeita opt-out de notificações durante novos agendamentos', () => {
    const state = copyState();
    const optedOut = updateProfileInState(state, 'demo-pessoa', { notificationEnabled: false }).state;
    const count = optedOut.notifications.length;
    const created = createAppointmentInState(optedOut, 'demo-pessoa', appointmentInput());
    expect(created.result.ok).toBe(true);
    expect(created.state.notifications).toHaveLength(count);
  });

  it('recusa campanhas vencidas e coordenadas fora do globo', () => {
    const state = copyState();
    const expired = { ...state, campaigns: state.campaigns.map((campaign) => campaign.id === 'campaign-circularidade' ? { ...campaign, endDate: '2020-01-01' } : campaign) };
    expect(joinCampaignInState(expired, 'demo-empresa', 'campaign-circularidade').result.error).toMatch(/encerrada/i);
    const { id: _id, ...point } = state.points[0];
    expect(savePointInState(state, 'demo-admin', { ...point, lat: 91 }).result.error).toMatch(/latitude entre/i);
  });

  it('preserva integridade de pontos vinculados a agendamentos', () => {
    const state = copyState();
    expect(deletePointInState(state, 'demo-pessoa', 'point-palmas-centro').result.ok).toBe(false);
    expect(deletePointInState(state, 'demo-admin', 'point-palmas-centro').result.error).toMatch(/agendamentos vinculados/i);
  });

  it('hash de senha não armazena a senha em texto puro', async () => {
    const password = 'senha-de-teste-123';
    const hash = await hashPassword(password, 'salt-de-teste');
    expect(hash).not.toContain(password);
    expect(hash).toMatch(/^v[01]\$/);
  });
});
