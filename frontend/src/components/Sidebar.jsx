import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, Building2,
  MapPin, FileText, Settings, Shield, ClipboardList,
  LogOut, ChevronDown, CreditCard, ScrollText, Receipt, Activity, TrendingUp, Calculator, X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/planning', icon: Calendar, label: 'Planning' },
  { to: '/agents', icon: Users, label: 'Agents' },
  { to: '/clients', icon: Building2, label: 'Clients' },
  { to: '/sites', icon: MapPin, label: 'Sites' },
  { to: '/absences',  icon: ClipboardList, label: 'Absences / Congés' },
  { to: '/quotes',    icon: FileText,      label: 'Devis' },
  { to: '/contracts', icon: ScrollText, label: 'Contrats' },
  { to: '/invoices',  icon: Receipt,   label: 'Factures' },
  { to: '/audit',      icon: Activity,    label: 'Journal d\'audit' },
  { to: '/simulation', icon: TrendingUp,  label: 'Simulation marge' },
  { to: '/chiffrage',  icon: Calculator,  label: 'Chiffrage', badge: 'Pro' },
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
        {NAV.map(({ to, icon: Icon, label, badge }) => (
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
