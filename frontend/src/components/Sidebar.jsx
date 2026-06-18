import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, Building2,
  MapPin, FileText, Settings, Shield, ClipboardList,
  LogOut, ChevronDown, CreditCard, ScrollText, Receipt, Activity, TrendingUp, Calculator, X, Download, Clock, Wallet, Sun, BarChart3, Package, GraduationCap, Siren, FolderOpen, MessageSquare, CheckSquare, Bell,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const NAV = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/planning',      icon: Calendar,        label: 'Planning' },
  { to: '/agents',        icon: Users,           label: 'Agents' },
  { to: '/clients',       icon: Building2,       label: 'Clients' },
  { to: '/sites',         icon: MapPin,          label: 'Sites' },
  { to: '/recap-heures',  icon: Clock,           label: 'Récap heures' },
  { to: '/absences',      icon: ClipboardList,   label: 'Absences / Congés', notifCategory: 'absences' },
  { to: '/quotes',        icon: FileText,        label: 'Devis' },
  { to: '/contracts',     icon: ScrollText,      label: 'Contrats' },
  { to: '/invoices',      icon: Receipt,         label: 'Factures' },
  { to: '/expenses',      icon: Wallet,          label: 'Notes de frais' },
  { to: '/conges',        icon: Sun,             label: 'Congés payés' },
  { to: '/rh',            icon: BarChart3,       label: 'Tableau RH' },
  { to: '/equipements',   icon: Package,         label: 'Équipements',   notifCategory: 'equipements' },
  { to: '/formations',    icon: GraduationCap,   label: 'Formations',    notifCategory: 'formations' },
  { to: '/incidents',     icon: Siren,           label: 'Incidents',     notifCategory: 'incidents' },
  { to: '/documents',     icon: FolderOpen,      label: 'Documents',     notifCategory: 'documents' },
  { to: '/messagerie',    icon: MessageSquare,   label: 'Messagerie',    unreadBadge: true },
  { to: '/taches',        icon: CheckSquare,     label: 'Tâches',        notifCategory: 'taches' },
  { to: '/vacation-reports', icon: ClipboardList,  label: 'Rapports vacation' },
  { to: '/notifications',    icon: Bell,           label: 'Notifications', notifTotal: true },
  { to: '/audit',         icon: Activity,        label: "Journal d'audit" },
  { to: '/simulation',    icon: TrendingUp,      label: 'Simulation marge' },
  { to: '/chiffrage',     icon: Calculator,      label: 'Chiffrage',     badge: 'Pro' },
];

const ROLE_LABELS = {
  admin: { label: 'Admin', color: 'text-blue-400 bg-blue-400/10' },
  gestionnaire: { label: 'Gestionnaire', color: 'text-emerald-400 bg-emerald-400/10' },
  lecteur: { label: 'Lecteur', color: 'text-slate-400 bg-slate-400/10' },
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [catCounts, setCatCounts]           = useState({});
  const [totalNotif, setTotalNotif]         = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    const api = import.meta.env.VITE_API_URL || '/api';
    const headers = { Authorization: `Bearer ${token}` };

    // Messages non lus
    fetch(`${api}/messages/unread-count`, { headers })
      .then(r => r.json()).then(d => setUnreadMessages(d.count || 0)).catch(() => {});

    // Notifications par catégorie + push browser
    async function loadNotifs() {
      try {
        const res = await fetch(`${api}/notifications`, { headers });
        const data = await res.json();
        const items = data.items || [];
        const total = data.count || 0;
        setTotalNotif(total);

        // Compter par catégorie
        const counts = {};
        items.forEach(item => { counts[item.category] = (counts[item.category] || 0) + 1; });
        setCatCounts(counts);

        // Push browser : déclencher si nouvelles alertes depuis la dernière visite
        const prevTotal = parseInt(localStorage.getItem('sp_notif_count') || '0', 10);
        if (total > prevTotal && prevTotal >= 0) {
          // Demander la permission si pas encore accordée
          if (Notification.permission === 'default') {
            await Notification.requestPermission();
          }
          if (Notification.permission === 'granted' && total > 0) {
            const newCount = total - prevTotal;
            const critiques = items.filter(i => i.level === 'critique');
            const title = critiques.length > 0
              ? `🔴 ${critiques.length} alerte${critiques.length > 1 ? 's' : ''} critique${critiques.length > 1 ? 's' : ''}`
              : `${newCount > 0 ? newCount + ' nouvelle' + (newCount > 1 ? 's' : '') + ' alerte' + (newCount > 1 ? 's' : '') : total + ' alerte' + (total > 1 ? 's' : '')}`;
            const body = critiques.length > 0
              ? critiques.slice(0, 2).map(i => i.title).join('\n')
              : items.slice(0, 2).map(i => i.title).join('\n');
            new Notification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png' });
          }
        }
        localStorage.setItem('sp_notif_count', String(total));
      } catch (e) { /* silencieux */ }
    }
    loadNotifs();
  }, []);

  useEffect(() => {
    // Capturer l'événement beforeinstallprompt
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    // Détecter si déjà installé
    window.addEventListener('appinstalled', () => { setInstalled(true); setInstallPrompt(null); });
    // Déjà en mode standalone = déjà installé
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { setInstalled(true); setInstallPrompt(null); }
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleInfo = ROLE_LABELS[user?.role] || ROLE_LABELS.lecteur;

  return (
    <aside className="w-64 h-full bg-dark-800 border-r border-dark-600 flex flex-col shrink-0">
      {/* Logo + company */}
      <div className="px-5 py-4 border-b border-dark-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white leading-tight truncate">
              {user?.company_name || 'SecuroPlan'}
            </div>
            <div className="text-xs text-slate-500 truncate">Gestion Sécurité</div>
          </div>
          {/* Bouton fermer — mobile seulement */}
          <button
            className="md:hidden p-1 text-slate-400 hover:text-white rounded-lg"
            onClick={() => window.dispatchEvent(new CustomEvent('closeSidebar'))}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label, badge, unreadBadge, notifCategory, notifTotal }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {badge && (
              <span className="text-xs px-1.5 py-0.5 rounded font-semibold bg-violet-600/20 text-violet-400 border border-violet-600/30">
                {badge}
              </span>
            )}
            {unreadBadge && unreadMessages > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-blue-500 text-white min-w-[18px] text-center">
                {unreadMessages}
              </span>
            )}
            {notifCategory && (catCounts[notifCategory] || 0) > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-red-500 text-white min-w-[18px] text-center">
                {catCounts[notifCategory]}
              </span>
            )}
            {notifTotal && totalNotif > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-red-500 text-white min-w-[18px] text-center">
                {totalNotif > 99 ? '99+' : totalNotif}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom : billing + settings + user */}
      <div className="px-3 pb-3 space-y-1 border-t border-dark-600 pt-3">
        <NavLink
          to="/billing"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              isActive
                ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700'
            }`
          }
        >
          <CreditCard className="w-4 h-4 shrink-0" />
          Abonnement
        </NavLink>
        {/* Bouton installer l'appli */}
        {!installed && installPrompt && (
          <button
            onClick={handleInstall}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-400 hover:bg-emerald-600/10 border border-emerald-600/30 transition-colors"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">Installer l'application</span>
          </button>
        )}

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              isActive
                ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700'
            }`
          }
        >
          <Settings className="w-4 h-4 shrink-0" />
          Paramètres
        </NavLink>

        {/* User card */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(s => !s)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-dark-700 transition-colors"
          >
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-600/50 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-blue-300">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-slate-200 font-medium truncate text-xs leading-tight">
                {user?.first_name} {user?.last_name}
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleInfo.color}`}>
                {roleInfo.label}
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-dark-700 border border-dark-500 rounded-lg shadow-xl overflow-hidden z-50">
              <div className="px-3 py-2 border-b border-dark-600">
                <div className="text-xs text-slate-400 truncate">{user?.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
