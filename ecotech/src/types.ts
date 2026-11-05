export type UserType = 'pessoa' | 'empresa' | 'escola' | 'ponto';
export type Role = 'user' | 'admin';
export interface User { id: string; name: string; email: string; type: UserType; role: Role; city: string; createdAt: string; passwordHash?: string; notificationEnabled?: boolean; publicRanking?: boolean; addresses?: string[]; avatar?: string; }
export interface Organization { id: string; userId: string; type: 'empresa' | 'escola'; name: string; document: string; email: string; phone: string; address: string; responsible: string; logo?: string; classes?: {name: string; kg: number; participants: number}[]; }
export interface CollectionPoint { id: string; name: string; category: 'Ponto de coleta' | 'Empresa' | 'Escola'; address: string; district: string; city: string; cep: string; lat: number; lng: number; hours: string; materials: string[]; open: boolean; pickup: boolean; accessible: boolean; phone: string; email: string; instructions: string; demo: boolean; }
export interface Equipment { type: string; quantity: number; condition: string; notes: string; weight?: number; }
export type AppointmentStatus = 'Solicitado' | 'Confirmado' | 'Em coleta' | 'Concluído' | 'Cancelado';
export interface Address { cep: string; street: string; number: string; complement: string; district: string; city: string; state: string; }
export interface Appointment { id: string; userId: string; protocol: string; equipment: Equipment[]; mode: 'entrega' | 'coleta'; pointId?: string; address?: Address; date: string; time: string; status: AppointmentStatus; createdAt: string; validated: boolean; history: {date: string; status: string}[]; }
export interface Reward { id: string; name: string; description: string; cost: number; category: string; available: boolean; icon: string; }
export interface Redemption { id: string; userId: string; rewardId: string; name: string; cost: number; date: string; receipt: string; }
export interface Campaign { id: string; title: string; description: string; ownerId: string; organization: string; category: 'Empresa' | 'Escola' | 'Comunidade'; goal: number; kg: number; endDate: string; active: boolean; participants: string[]; }
export interface EnvironmentalRecord { id: string; appointmentId: string; userId: string; date: string; equipment: string; quantity: number; weight: number; destination: string; points: number; co2: number; validated: boolean; }
export interface Notification { id: string; userId: string; title: string; message: string; date: string; read: boolean; kind: string; }
export interface Achievement { id: string; title: string; description: string; criteria: string; }
export interface Certificate { id: string; userId: string; organization: string; campaignId?: string; date: string; code: string; }
export interface AppState { users: User[]; organizations: Organization[]; points: CollectionPoint[]; appointments: Appointment[]; rewards: Reward[]; redemptions: Redemption[]; campaigns: Campaign[]; records: EnvironmentalRecord[]; notifications: Notification[]; achievements: Achievement[]; certificates: Certificate[]; sessionUserId: string | null; }
export interface Metrics { kg: number; devices: number; points: number; co2: number; score: number; level: string; campaigns: number; }
export interface ActionResult { ok: boolean; error?: string; id?: string; }
export type AppointmentInput = Omit<Appointment, 'id' | 'userId' | 'protocol' | 'status' | 'createdAt' | 'validated' | 'history'>;
export type CampaignInput = Omit<Campaign, 'id' | 'ownerId' | 'participants' | 'kg'>;
export interface StoreAPI {
  state: AppState; user: User | null; metrics: Metrics;
  login: (email: string, password: string, remember?: boolean) => Promise<ActionResult>;
  register: (input: {name: string; email: string; password: string; type: UserType}) => Promise<ActionResult>;
  demoLogin: (type?: UserType | 'admin') => void; logout: () => void;
  updateProfile: (patch: Partial<User>) => ActionResult;
  createAppointment: (input: AppointmentInput) => ActionResult;
  cancelAppointment: (id: string) => ActionResult;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => ActionResult;
  validateAppointment: (id: string, weight: number, destination: string, notes?: string) => ActionResult;
  redeemReward: (id: string) => ActionResult;
  joinCampaign: (id: string) => ActionResult;
  saveCampaign: (input: CampaignInput, id?: string) => ActionResult;
  closeCampaign: (id: string) => ActionResult;
  saveOrganization: (input: Omit<Organization, 'id' | 'userId'>) => ActionResult;
  markNotification: (id?: string) => void;
  savePoint: (input: Omit<CollectionPoint, 'id'>, id?: string) => ActionResult;
  deletePoint: (id: string) => ActionResult;
  setRewardAvailability: (id: string, available: boolean) => ActionResult;
  issueCertificate: (organization: string, campaignId?: string) => ActionResult;
  resetDemo: () => void;
}
