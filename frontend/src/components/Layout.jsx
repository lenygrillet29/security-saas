import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AlertTriangle, Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import { API_BASE_URL } from '../api';

const misconfig = import.meta.env.PROD && !import.meta.env.VITE_API_URL;

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Fermer la sidebar quand on change de page ou via event
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);
  useEffect(() => {
    const handler = () => setSidebarOpen(false);
    window.addEventListener('closeSidebar', handler);
    return () => window.removeEventListener('closeSidebar', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-dark-900 flex-col">
      {misconfig && (
        <div className="shrink-0 bg-red-900/80 border-b border-red-600/50 px-4 py-2 flex items-center gap-3 text-sm text-red-200 z-50">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>
            <strong>VITE_API_URL non configurée.</strong>{' '}
            Dans Vercel → Settings → Environment Variables, ajoute{' '}
            <code className="bg-red-950/60 px-1 rounded text-red-100">VITE_API_URL = https://TON_APP.up.railway.app/api</code>{' '}
            puis <strong>redéploie</strong>.
          </span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar desktop */}
        <div className="hidden md:block shrink-0">
          <Sidebar />
        </div>

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar mobile (drawer) */}
        <div className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <Sidebar />
        </div>

        {/* Contenu principal */}
        <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
          {/* Topbar mobile */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-dark-800 border-b border-dark-600 shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">S</span>
              </div>
              <span className="text-white font-semibold text-sm">SecuroPlan</span>
            </div>
          </div>

          <div className="p-4 md:p-6 max-w-[1400px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
