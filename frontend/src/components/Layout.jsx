import { Outlet } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import Sidebar from './Sidebar';
import { API_BASE_URL } from '../api';

const misconfig = import.meta.env.PROD && !import.meta.env.VITE_API_URL;

export default function Layout() {
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
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
