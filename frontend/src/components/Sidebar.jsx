import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, Building2,
  MapPin, FileText, Settings, Shield, ClipboardList,
} from 'lucide-react';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/planning', icon: Calendar, label: 'Planning' },
  { to: '/agents', icon: Users, label: 'Agents' },
  { to: '/clients', icon: Building2, label: 'Clients' },
  { to: '/sites', icon: MapPin, label: 'Sites' },
  { to: '/absences', icon: ClipboardList, label: 'Absences / Congés' },
  { to: '/quotes', icon: FileText, label: 'Devis' },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-dark-800 border-r border-dark-600 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-dark-600">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">SecuritySaaS</div>
            <div className="text-xs text-slate-500">Gestion Sécurité</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label }) => (
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
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-dark-600">
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
      </div>
    </aside>
  );
}
