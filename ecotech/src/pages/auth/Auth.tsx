import { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { LinkButton, Button, Modal, Badge, useToast } from '../../components/ui';
import { useStore } from '../../services/store';
import type { UserType } from '../../types';
import { ArrowRight, Eye, EyeOff, Leaf, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type AuthMode = 'login' | 'register';

const loginSchema = z.object({
  email: z.string().trim().email('Digite um e-mail válido.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
  remember: z.boolean().optional(),
});

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome.'),
    email: z.string().trim().email('Digite um e-mail válido.'),
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
    confirmPassword: z.string().min(6, 'Confirme sua senha.'),
    type: z.enum(['pessoa', 'empresa', 'escola', 'ponto']),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas precisam ser iguais.',
  });

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

const typeLabels: Record<UserType, string> = {
  pessoa: 'Pessoa física',
  empresa: 'Empresa',
  escola: 'Escola',
  ponto: 'Ponto de coleta',
};

function FieldError({ message }: { message?: string }) {
  return message ? <span className="small text-red-700">{message}</span> : null;
}

function PasswordField({
  label,
  error,
  registration,
}: {
  label: string;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="relative block">
        <input className="input pr-11" type={visible ? 'text' : 'password'} autoComplete="current-password" {...registration} />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
      <FieldError message={error} />
    </label>
  );
}

function AuthShell({ mode, onModeChange, children }: { mode: AuthMode; onModeChange: (mode: AuthMode) => void; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#fbf9f5] px-4 py-6 text-[#182522] sm:px-8 lg:px-12">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-black/5 bg-white shadow-[0_22px_80px_rgba(24,37,34,0.12)] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative flex flex-col justify-between overflow-hidden bg-[#182522] p-8 text-white sm:p-12">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#e96925]/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-[#e96925]/20 blur-3xl" />
          <div className="relative">
            <LinkButton to="/" variant="ghost" className="!px-0 !text-white hover:!bg-transparent">
              <span className="mr-2 grid h-9 w-9 place-items-center rounded-xl bg-[#e96925] text-white"><Leaf size={19} /></span>
              <span className="text-lg font-bold tracking-tight">EcoTech</span>
            </LinkButton>
            <div className="mt-20 max-w-sm">
              <Badge tone="orange">Demonstração local</Badge>
              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
                {mode === 'login' ? 'O próximo destino começa aqui.' : 'Faça parte de um descarte mais consciente.'}
              </h1>
              <p className="mt-5 text-base leading-7 text-white/70">
                Uma experiência demonstrativa para conectar pessoas, empresas, escolas e pontos de coleta ao descarte educativo de eletrônicos.
              </p>
            </div>
          </div>
          <div className="relative mt-12 grid gap-3 text-sm text-white/70 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><ShieldCheck size={18} className="mb-3 text-[#ffad7e]" /><strong className="block text-white">Fluxos claros</strong><span>Permissões e limites ficam visíveis.</span></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Sparkles size={18} className="mb-3 text-[#ffad7e]" /><strong className="block text-white">Impacto legível</strong><span>Indicadores vêm do estado demonstrativo.</span></div>
          </div>
        </aside>
        <section className="flex flex-col p-6 sm:p-12">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow text-[#c75013]">Acesso EcoTech</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{mode === 'login' ? 'Entrar na plataforma' : 'Criar uma conta'}</h2>
            </div>
            <div className="hidden rounded-full bg-[#fbf9f5] p-1 sm:flex">
              <button type="button" onClick={() => onModeChange('login')} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === 'login' ? 'bg-white text-[#182522] shadow-sm' : 'text-slate-500'}`}>Entrar</button>
              <button type="button" onClick={() => onModeChange('register')} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === 'register' ? 'bg-white text-[#182522] shadow-sm' : 'text-slate-500'}`}>Cadastrar</button>
            </div>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}

function DemoAccess({ onDemo }: { onDemo: (type: UserType | 'admin') => void }) {
  return (
    <div className="mt-8 rounded-2xl border border-[#f4d2bd] bg-[#fff8f3] p-5">
      <div className="flex items-start gap-3">
        <div className="icon-box bg-white text-[#c75013]"><Sparkles size={17} /></div>
        <div className="min-w-0">
          <p className="font-semibold">Explorar demonstração</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">Os acessos abaixo usam dados locais e não representam uma autenticação de produção.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Button onClick={() => onDemo('pessoa')}>Acessar demonstração</Button>
        <Button variant="secondary" onClick={() => onDemo('empresa')}>Demo empresa</Button>
        <Button variant="secondary" onClick={() => onDemo('escola')}>Demo escola</Button>
        <Button variant="secondary" onClick={() => onDemo('ponto')}>Demo ponto de coleta</Button>
        <Button variant="ghost" onClick={() => onDemo('admin')}>Demo admin</Button>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">O cenário administrativo é separado e serve apenas para inspeção local; não é uma forma de obter privilégio.</p>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, demoLogin } = useStore();
  const { notify } = useToast();
  const mode: AuthMode = 'login';
  const setMode = (next: AuthMode) => navigate(next === 'register' ? '/cadastro' : '/login');
  const [forgotOpen, setForgotOpen] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
  });

  const enterDemo = (type: UserType | 'admin') => {
    demoLogin(type);
    notify(type === 'admin' ? 'Demonstração administrativa ativada.' : `Demonstração de ${typeLabels[type]} ativada.`, 'info');
    navigate('/app', { replace: true });
  };

  const onSubmit = async (values: LoginValues) => {
    const result = await login(values.email, values.password, values.remember);
    if (!result.ok) {
      notify(result.error ?? 'Não foi possível entrar.', 'error');
      return;
    }
    notify('Login local realizado.', 'success');
    navigate('/app', { replace: true });
  };

  return (
    <AuthShell mode={mode} onModeChange={setMode}>
      <form className="form-grid" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="field">
          <span className="field-label">E-mail</span>
          <span className="relative block"><Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-10" type="email" autoComplete="email" placeholder="voce@exemplo.com" {...register('email')} /></span>
          <FieldError message={errors.email?.message} />
        </label>
        <PasswordField label="Senha" error={errors.password?.message} registration={register('password')} />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="inline-flex items-center gap-2 text-slate-600"><input type="checkbox" className="accent-[#e96925]" {...register('remember')} /> Manter conectado</label>
          <button type="button" className="font-semibold text-[#c75013] hover:underline" onClick={() => setForgotOpen(true)}>Esqueci minha senha</button>
        </div>
        <Button type="submit" disabled={isSubmitting} className="mt-2 w-full justify-center">{isSubmitting ? 'Entrando…' : 'Entrar'} <ArrowRight size={17} /></Button>
      </form>
      <div className="my-7 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-slate-400"><span className="h-px flex-1 bg-slate-200" /> ou <span className="h-px flex-1 bg-slate-200" /></div>
      <DemoAccess onDemo={enterDemo} />
      <p className="mt-7 text-center text-sm text-slate-600">Ainda não tem conta? <button type="button" className="font-semibold text-[#c75013] hover:underline" onClick={() => setMode('register')}>Criar conta</button></p>
      <Modal open={forgotOpen} title="Recuperação demonstrativa" onClose={() => setForgotOpen(false)}>
        <div className="space-y-4 text-sm leading-6 text-slate-600"><div className="icon-box bg-[#fff3ea] text-[#c75013]"><LockKeyhole size={18} /></div><p>Este ambiente é local e demonstrativo. Nenhum e-mail real é enviado e não há recuperação de senha conectada.</p><p>Para continuar, use um acesso de demonstração ou crie uma conta local nesta sessão.</p><Button variant="secondary" onClick={() => setForgotOpen(false)}>Entendi</Button></div>
      </Modal>
    </AuthShell>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: createAccount, demoLogin } = useStore();
  const { notify } = useToast();
  const mode: AuthMode = 'register';
  const setMode = (next: AuthMode) => navigate(next === 'register' ? '/cadastro' : '/login');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', type: 'pessoa' },
  });

  const enterDemo = (type: UserType | 'admin') => {
    demoLogin(type);
    notify(type === 'admin' ? 'Demonstração administrativa ativada.' : `Demonstração de ${typeLabels[type]} ativada.`, 'info');
    navigate('/app', { replace: true });
  };

  const onSubmit = async (values: RegisterValues) => {
    const result = await createAccount({ name: values.name, email: values.email, password: values.password, type: values.type });
    if (!result.ok) {
      notify(result.error ?? 'Não foi possível criar a conta.', 'error');
      return;
    }
    notify('Conta local criada com sucesso.', 'success');
    navigate('/app', { replace: true });
  };

  return (
    <AuthShell mode={mode} onModeChange={setMode}>
      <form className="form-grid" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="field"><span className="field-label">Nome</span><span className="relative block"><UserRound size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-10" autoComplete="name" placeholder="Seu nome" {...register('name')} /></span><FieldError message={errors.name?.message} /></label>
        <label className="field"><span className="field-label">E-mail</span><span className="relative block"><Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-10" type="email" autoComplete="email" placeholder="voce@exemplo.com" {...register('email')} /></span><FieldError message={errors.email?.message} /></label>
        <PasswordField label="Senha" error={errors.password?.message} registration={register('password')} />
        <PasswordField label="Confirmação da senha" error={errors.confirmPassword?.message} registration={register('confirmPassword')} />
        <label className="field"><span className="field-label">Tipo de usuário</span><select className="select" {...register('type')}><option value="pessoa">Pessoa física</option><option value="empresa">Empresa</option><option value="escola">Escola</option><option value="ponto">Ponto de coleta</option></select><FieldError message={errors.type?.message} /></label>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">O cadastro não permite escolher papel administrativo. O cenário admin existente só pode ser aberto pelo botão de demonstração separado.</div>
        <Button type="submit" disabled={isSubmitting} className="mt-2 w-full justify-center">{isSubmitting ? 'Criando…' : 'Criar conta'} <ArrowRight size={17} /></Button>
      </form>
      <DemoAccess onDemo={enterDemo} />
      <p className="mt-7 text-center text-sm text-slate-600">Já tem uma conta? <button type="button" className="font-semibold text-[#c75013] hover:underline" onClick={() => setMode('login')}>Entrar</button></p>
    </AuthShell>
  );
}

export default LoginPage;
