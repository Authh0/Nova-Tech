import React, {Suspense, lazy, useEffect, type ReactNode} from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter, Routes, Route, useLocation, Link} from 'react-router-dom';
import {StoreProvider} from './services/store';
import {ToastProvider, LinkButton} from './components/ui';
import {PublicLayout} from './components/PublicLayout';
import {AppLayout} from './components/AppLayout';
import {LandingPage} from './pages/public/Landing';
import './styles.css';
const Dashboard = lazy(() => import('./pages/app/Dashboard').then(m => ({default:m.DashboardPage})));
const Points = lazy(() => import('./pages/app/CollectionPoints').then(m => ({default:m.CollectionPointsPage})));
const PointDetail = lazy(() => import('./pages/app/CollectionPoints').then(m => ({default:m.CollectionPointDetailPage})));
const Appointments = lazy(() => import('./pages/app/Appointments').then(m => ({default:m.AppointmentsPage})));
const NewAppointment = lazy(() => import('./pages/app/Appointments').then(m => ({default:m.NewAppointmentPage})));
const AppointmentDetail = lazy(() => import('./pages/app/Appointments').then(m => ({default:m.AppointmentDetailPage})));
const Rewards = lazy(() => import('./pages/app/Rewards').then(m => ({default:m.RewardsPage})));
const Impact = lazy(() => import('./pages/app/Impact').then(m => ({default:m.ImpactPage})));
const Campaigns = lazy(() => import('./pages/app/Campaigns').then(m => ({default:m.CampaignsPage})));
const Profile = lazy(() => import('./pages/app/Profile').then(m => ({default:m.ProfilePage})));
const Notifications = lazy(() => import('./pages/app/Notifications').then(m => ({default:m.NotificationsPage})));
const Organization = lazy(() => import('./pages/app/Organizations').then(m => ({default:m.OrganizationPage})));
const Admin = lazy(() => import('./pages/app/Admin').then(m => ({default:m.AdminPage})));
const Login = lazy(() => import('./pages/auth/Auth').then(m => ({default:m.LoginPage})));
const Register = lazy(() => import('./pages/auth/Auth').then(m => ({default:m.RegisterPage})));
const About = lazy(() => import('./pages/public/Institutional').then(m => ({default:m.AboutPage})));
const HowItWorks = lazy(() => import('./pages/public/Institutional').then(m => ({default:m.HowItWorksPage})));
const Businesses = lazy(() => import('./pages/public/Institutional').then(m => ({default:m.BusinessesPage})));
const Schools = lazy(() => import('./pages/public/Institutional').then(m => ({default:m.SchoolsPage})));
const PublicImpact = lazy(() => import('./pages/public/Institutional').then(m => ({default:m.PublicImpactPage})));
const Team = lazy(() => import('./pages/public/Institutional').then(m => ({default:m.TeamPage})));
const Privacy = lazy(() => import('./pages/public/Institutional').then(m => ({default:m.PrivacyPage})));
const Terms = lazy(() => import('./pages/public/Institutional').then(m => ({default:m.TermsPage})));
function Loading() {return <div className="route-loading" aria-label="Carregando página"><span/><span/><span/><p>Preparando seu próximo passo...</p></div>;}
function ScrollAndTitle() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0,0);
    const names:Record<string,string> = {'/':'Descarte inteligente. Futuro sustentável.','/sobre':'Sobre o projeto','/como-funciona':'Como funciona','/empresas':'Para empresas','/escolas':'Para escolas','/equipe':'Nossa equipe','/login':'Entrar','/cadastro':'Criar uma conta','/impacto':'Impacto coletivo','/app':'Sua jornada sustentável','/app/pontos-de-coleta':'Pontos de coleta','/app/agendamentos':'Agendamentos','/app/agendamentos/novo':'Novo agendamento','/app/recompensas':'EcoPoints e recompensas','/app/impacto':'Impacto ambiental','/app/campanhas':'Campanhas','/app/perfil':'Meu perfil','/app/notificacoes':'Notificações','/app/empresa':'Minha empresa','/app/escola':'Minha escola','/app/admin':'Administração','/termos':'Termos de uso','/privacidade':'Privacidade'};
    document.title = `EcoTech — ${names[location.pathname] || 'Sua plataforma de descarte inteligente'}`;
  },[location.pathname]);
  return null;
}
class ErrorBoundary extends React.Component<{children:ReactNode},{error:boolean}> {
  state = {error:false};
  static getDerivedStateFromError() {return {error:true};}
  render() {if (this.state.error) return <div className="error-page"><h1>Não foi possível carregar esta experiência.</h1><p>Recarregue a página para tentar novamente. Os dados da demonstração continuam neste navegador.</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Tentar novamente</button></div>; return this.props.children;}
}
function NotFound() {return <section className="section"><div className="container page-stack"><span className="eyebrow">404 · PÁGINA NÃO ENCONTRADA</span><h1 className="section-title">Vamos encontrar<br/>um novo caminho?</h1><p className="muted">Este endereço não faz parte da EcoTech. Volte ao início ou explore a demonstração.</p><div className="row"><LinkButton to="/">Ir para o início</LinkButton><Link to="/login">Explorar a plataforma →</Link></div></div></section>;}
function Application() {return <><ScrollAndTitle/><Suspense fallback={<Loading/>}><Routes><Route element={<PublicLayout/>}><Route index element={<LandingPage/>}/><Route path="sobre" element={<About/>}/><Route path="como-funciona" element={<HowItWorks/>}/><Route path="empresas" element={<Businesses/>}/><Route path="escolas" element={<Schools/>}/><Route path="impacto" element={<PublicImpact/>}/><Route path="equipe" element={<Team/>}/><Route path="privacidade" element={<Privacy/>}/><Route path="termos" element={<Terms/>}/><Route path="*" element={<NotFound/>}/></Route><Route path="login" element={<Login/>}/><Route path="cadastro" element={<Register/>}/><Route path="app" element={<AppLayout/>}><Route index element={<Dashboard/>}/><Route path="pontos-de-coleta" element={<Points/>}/><Route path="pontos-de-coleta/:id" element={<PointDetail/>}/><Route path="agendamentos" element={<Appointments/>}/><Route path="agendamentos/novo" element={<NewAppointment/>}/><Route path="agendamentos/:id" element={<AppointmentDetail/>}/><Route path="recompensas" element={<Rewards/>}/><Route path="impacto" element={<Impact/>}/><Route path="campanhas" element={<Campaigns/>}/><Route path="perfil" element={<Profile/>}/><Route path="notificacoes" element={<Notifications/>}/><Route path="empresa" element={<Organization kind="empresa"/>}/><Route path="escola" element={<Organization kind="escola"/>}/><Route path="admin" element={<Admin/>}/></Route></Routes></Suspense></>;}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><BrowserRouter><StoreProvider><ToastProvider><Application/></ToastProvider></StoreProvider></BrowserRouter></ErrorBoundary></React.StrictMode>);
