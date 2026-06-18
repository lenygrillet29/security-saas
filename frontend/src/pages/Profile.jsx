import { useState } from 'react';
import { UserCircle, Lock, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ToastProvider, useToast } from '../components/Toast';

const BASE = import.meta.env.VITE_API_URL || '/api';

function ProfileInner() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const token = localStorage.getItem('auth_token');

  const [nameForm, setNameForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
  });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [savingName, setSavingName] = useState(false);
  const [savingPw,   setSavingPw]   = useState(false);

  async function saveName(e) {
    e.preventDefault();
    if (!nameForm.first_name || !nameForm.last_name) return toast('Prénom et nom requis', 'error');
    setSavingName(true);
    try {
      const res = await fetch(`${BASE}/auth/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...nameForm, role: user.role, active: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setUser?.(u => ({ ...u, first_name: nameForm.first_name, last_name: nameForm.last_name }));
      toast('Profil mis à jour');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSavingName(false); }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (!pwForm.current_password || !pwForm.new_password) return toast('Tous les champs sont requis', 'error');
    if (pwForm.new_password.length < 8) return toast('Minimum 8 caractères', 'error');
    if (pwForm.new_password !== pwForm.confirm) return toast('Les mots de passe ne correspondent pas', 'error');
    setSavingPw(true);
    try {
      const res = await fetch(`${BASE}/auth/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: pwForm.current_password, new_password: pwForm.new_password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
      toast('Mot de passe modifié');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSavingPw(false); }
  }

  const ROLE_LABELS = { admin: 'Admin', gestionnaire: 'Gestionnaire', lecteur: 'Lecteur' };
  const ROLE_COLORS = { admin: 'text-blue-400 bg-blue-400/10', gestionnaire: 'text-emerald-400 bg-emerald-400/10', lecteur: 'text-slate-400 bg-slate-400/10' };

  return (
    <div className="space-y-5 animate-fade-in max-w-lg">
      <div className="page-header">
        <h1 className="page-title">Mon profil</h1>
      </div>

      {/* Carte identité */}
      <div className="card p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-600/20 border-2 border-blue-600/40 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-blue-300">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </span>
        </div>
        <div>
          <div className="text-white font-semibold">{user?.first_name} {user?.last_name}</div>
          <div className="text-sm text-slate-400 mt-0.5">{user?.email}</div>
          <span className={`text-xs px-2 py-0.5 rounded font-medium mt-1 inline-block ${ROLE_COLORS[user?.role] || ROLE_COLORS.lecteur}`}>
            {ROLE_LABELS[user?.role] || user?.role}
          </span>
        </div>
      </div>

      {/* Modifier nom */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dark-600">
          <UserCircle className="w-4 h-4 text-blue-400" />
          <h2 className="font-semibold text-white text-sm">Informations personnelles</h2>
        </div>
        <form onSubmit={saveName} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Prénom</label>
              <input className="input" value={nameForm.first_name}
                onChange={e => setNameForm(f => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Nom</label>
              <input className="input" value={nameForm.last_name}
                onChange={e => setNameForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input opacity-50 cursor-not-allowed" value={user?.email} disabled />
            <p className="text-xs text-slate-500 mt-1">L'email ne peut pas être modifié.</p>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={savingName}>
              <Save className="w-4 h-4" />
              {savingName ? 'Sauvegarde…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      {/* Changer mot de passe */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dark-600">
          <Lock className="w-4 h-4 text-blue-400" />
          <h2 className="font-semibold text-white text-sm">Changer le mot de passe</h2>
        </div>
        <form onSubmit={savePassword} className="space-y-4">
          <div>
            <label className="label">Mot de passe actuel</label>
            <input type="password" className="input" placeholder="••••••••"
              value={pwForm.current_password}
              onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} />
          </div>
          <div>
            <label className="label">Nouveau mot de passe</label>
            <input type="password" className="input" placeholder="Minimum 8 caractères"
              value={pwForm.new_password}
              onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} />
          </div>
          <div>
            <label className="label">Confirmer le nouveau mot de passe</label>
            <input type="password" className="input" placeholder="••••••••"
              value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={savingPw}>
              <Lock className="w-4 h-4" />
              {savingPw ? 'Modification…' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Profile() {
  return <ToastProvider><ProfileInner /></ToastProvider>;
}
