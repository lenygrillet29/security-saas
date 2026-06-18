import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Trash2, Plus, Search, Hash, User, Users, UserPlus, Settings, X } from 'lucide-react';
import { messagesApi, agentsApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60)    return 'à l\'instant';
  if (diff < 3600)  return `${Math.floor(diff/60)}min`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function Avatar({ firstName, lastName, color, size = 'md', icon: Icon }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} rounded-xl flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: color || '#3B82F6' }}>
      {Icon ? <Icon className="w-4 h-4" /> : <>{firstName?.[0]}{lastName?.[0]}</>}
    </div>
  );
}

function ThreadRow({ t, active, onClick }) {
  const unread = parseInt(t.unread) || 0;
  const isTeam  = t.thread_type === 'team';
  const isGroup = t.thread_type === 'group';
  const isUser  = t.thread_type === 'user';
  const icon    = isTeam ? Hash : isGroup ? Users : isUser ? User : null;
  const color   = isTeam ? '#6366F1' : isGroup ? '#10B981' : t.color;
  const name    = isTeam ? 'Équipe' : isGroup ? t.first_name : `${t.last_name} ${t.first_name}`;
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${active ? 'bg-blue-600/15 border border-blue-600/30' : 'hover:bg-dark-700/50'}`}>
      <div className="relative shrink-0">
        <Avatar firstName={t.first_name} lastName={t.last_name} color={color} icon={icon} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-sm font-medium truncate ${unread > 0 ? 'text-white' : 'text-slate-300'}`}>{name}</span>
          {t.last_at && <span className="text-[10px] text-slate-600 shrink-0">{timeAgo(t.last_at)}</span>}
        </div>
        <div className="flex items-center gap-2">
          {t.last_body && <p className="text-xs text-slate-500 truncate flex-1">{t.last_body}</p>}
          {isGroup && t.member_count && <span className="text-[10px] text-slate-600 shrink-0">{t.member_count} membres</span>}
        </div>
      </div>
    </button>
  );
}

// ── Modal nouveau fil / groupe ────────────────────────────────────────────────
function NewModal({ users, agents, onClose, onDone }) {
  const toast    = useToast();
  const searchRef = useRef(null);
  const [step, setStep]                     = useState('search'); // search | group
  const [searchQ, setSearchQ]               = useState('');
  const [groupName, setGroupName]           = useState('');
  const [groupDesc, setGroupDesc]           = useState('');
  const [agentsCanReply, setAgentsCanReply] = useState(true);
  const [selUsers, setSelUsers]             = useState([]);
  const [selAgents, setSelAgents]           = useState([]);
  const [groupSearchQ, setGroupSearchQ]     = useState('');

  useEffect(() => { searchRef.current?.focus(); }, []);

  function toggleUser(id)  { setSelUsers(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); }
  function toggleAgent(id) { setSelAgents(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); }

  function highlight(text, query) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return <>{text.slice(0, idx)}<mark className="bg-blue-500/30 text-blue-200 rounded">{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
  }

  async function createGroup() {
    if (!groupName.trim()) return;
    try {
      await messagesApi.createGroup({ name: groupName.trim(), description: groupDesc, agents_can_reply: agentsCanReply, user_ids: selUsers, agent_ids: selAgents });
      toast('Groupe créé', 'success');
      onDone(); onClose();
    } catch (e) { toast(e.message, 'error'); }
  }

  const q = searchQ.toLowerCase();
  const filteredAgents = agents.filter(a =>
    !q || `${a.last_name} ${a.first_name}`.toLowerCase().includes(q) || (a.employee_number || '').toLowerCase().includes(q)
  );
  const filteredUsers = users.filter(u =>
    !q || `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
  );
  const showAll = !q;

  const allGroupPeople = [
    ...users.map(u => ({ id: `u_${u.id}`, rawId: u.id, type: 'user', name: `${u.first_name} ${u.last_name}`, sub: u.role, color: '#64748B' })),
    ...agents.map(a => ({ id: `a_${a.agent_id||a.id}`, rawId: a.agent_id||a.id, type: 'agent', name: `${a.last_name} ${a.first_name}`, sub: a.employee_number, color: a.color })),
  ].filter(p => !groupSearchQ || p.name.toLowerCase().includes(groupSearchQ.toLowerCase()));

  if (step === 'group') return (
    <div className="p-4 space-y-3">
      <button onClick={() => setStep('search')} className="text-xs text-slate-500 hover:text-white flex items-center gap-1">
        ← Retour
      </button>
      <div>
        <label className="label">Nom du groupe *</label>
        <input className="input" placeholder="Ex: Événement Stade, Brigade nuit…" value={groupName} onChange={e => setGroupName(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="label">Description (optionnel)</label>
        <input className="input" placeholder="…" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} />
      </div>
      <button type="button" onClick={() => setAgentsCanReply(s => !s)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${agentsCanReply ? 'border-emerald-600/40 bg-emerald-500/10' : 'border-dark-600 bg-dark-700/50'}`}>
        <div className="text-left">
          <div className={`text-sm font-medium ${agentsCanReply ? 'text-emerald-300' : 'text-slate-400'}`}>
            Les agents peuvent répondre
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {agentsCanReply ? 'Échanges bidirectionnels dans le groupe' : 'Diffusion uniquement — agents en lecture seule'}
          </div>
        </div>
        <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${agentsCanReply ? 'bg-emerald-500' : 'bg-dark-500'}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${agentsCanReply ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
      </button>
      <div>
        <label className="label">Ajouter des membres</label>
        <input className="input text-sm mb-2" placeholder="Rechercher…" value={groupSearchQ} onChange={e => setGroupSearchQ(e.target.value)} />
        <div className="space-y-1 max-h-44 overflow-y-auto">
          {allGroupPeople.map(p => {
            const sel = p.type === 'user' ? selUsers.includes(p.rawId) : selAgents.includes(p.rawId);
            return (
              <button key={p.id} onClick={() => p.type === 'user' ? toggleUser(p.rawId) : toggleAgent(p.rawId)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${sel ? 'bg-blue-600/15 border border-blue-600/30' : 'hover:bg-dark-700'}`}>
                <Avatar firstName={p.name.split(' ')[0]} lastName={p.name.split(' ')[1]} color={p.color} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-medium truncate">{p.name}</div>
                  {p.sub && <div className="text-slate-500 text-[10px]">{p.sub}</div>}
                </div>
                {sel && <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                  <X className="w-2.5 h-2.5 text-white" />
                </div>}
              </button>
            );
          })}
        </div>
        {(selUsers.length + selAgents.length) > 0 && (
          <p className="text-xs text-slate-500 mt-2">{selUsers.length + selAgents.length} membre{selUsers.length + selAgents.length > 1 ? 's' : ''} sélectionné{selUsers.length + selAgents.length > 1 ? 's' : ''}</p>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
        <button onClick={createGroup} disabled={!groupName.trim()} className="btn-primary flex-1 disabled:opacity-40">Créer le groupe</button>
      </div>
    </div>
  );

  // Étape principale : recherche instantanée
  return (
    <div className="flex flex-col">
      {/* Barre de recherche */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            ref={searchRef}
            className="input pl-9 text-sm"
            placeholder="Nom d'un agent ou collaborateur…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
          {searchQ && (
            <button onClick={() => setSearchQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-y-auto max-h-72 pb-2">
        {/* Bouton créer groupe (toujours visible) */}
        {!q && (
          <div className="px-3 pb-1">
            <button onClick={() => setStep('group')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-dark-700 transition-colors text-left border border-dark-600 border-dashed">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-emerald-300 text-sm font-medium">Créer un groupe</div>
                <div className="text-xs text-slate-500">Équipe événement, brigade nuit…</div>
              </div>
            </button>
          </div>
        )}

        {/* Agents filtrés */}
        {filteredAgents.length > 0 && (
          <>
            <p className="text-[10px] text-slate-600 uppercase tracking-wide px-4 pt-3 pb-1">
              Agents {q && <span className="normal-case text-slate-500">· {filteredAgents.length} résultat{filteredAgents.length > 1 ? 's' : ''}</span>}
            </p>
            {(showAll ? filteredAgents.slice(0, 6) : filteredAgents).map(a => (
              <button key={a.agent_id||a.id}
                onClick={() => { onClose(); onDone({ thread_type: 'agent', target_id: a.agent_id||a.id, first_name: a.first_name, last_name: a.last_name, color: a.color }); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-dark-700 transition-colors text-left">
                <Avatar firstName={a.first_name} lastName={a.last_name} color={a.color} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm truncate">{highlight(`${a.last_name} ${a.first_name}`, searchQ)}</div>
                  {a.employee_number && <div className="text-xs text-slate-500">{highlight(a.employee_number, searchQ)}</div>}
                </div>
                <span className="text-[10px] text-slate-600 shrink-0">Agent</span>
              </button>
            ))}
            {showAll && filteredAgents.length > 6 && (
              <p className="text-xs text-slate-600 px-4 py-1">+{filteredAgents.length - 6} agents — tapez pour filtrer</p>
            )}
          </>
        )}

        {/* Collaborateurs filtrés */}
        {filteredUsers.length > 0 && (
          <>
            <p className="text-[10px] text-slate-600 uppercase tracking-wide px-4 pt-3 pb-1">
              Collaborateurs {q && <span className="normal-case text-slate-500">· {filteredUsers.length} résultat{filteredUsers.length > 1 ? 's' : ''}</span>}
            </p>
            {filteredUsers.map(u => (
              <button key={u.id}
                onClick={() => { onClose(); onDone({ thread_type: 'user', target_id: u.id, first_name: u.first_name, last_name: u.last_name, color: '#64748B' }); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-dark-700 transition-colors text-left">
                <Avatar firstName={u.first_name} lastName={u.last_name} color="#64748B" size="sm" icon={User} />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm truncate">{highlight(`${u.first_name} ${u.last_name}`, searchQ)}</div>
                  {u.email && <div className="text-xs text-slate-500">{highlight(u.email, searchQ)}</div>}
                </div>
                <span className="text-[10px] text-slate-600 shrink-0">Collaborateur</span>
              </button>
            ))}
          </>
        )}

        {/* Aucun résultat */}
        {q && filteredAgents.length === 0 && filteredUsers.length === 0 && (
          <div className="text-center py-8 text-slate-600 text-sm px-4">
            Aucun résultat pour "<span className="text-slate-400">{searchQ}</span>"
          </div>
        )}
      </div>

      {/* Bouton créer groupe en bas quand on recherche */}
      {q && (
        <div className="px-3 py-2 border-t border-dark-600">
          <button onClick={() => setStep('group')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-dark-700 transition-colors text-left">
            <Users className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-emerald-300 text-sm">Créer un groupe</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Panneau membres groupe ────────────────────────────────────────────────────
function MembersPanel({ groupId, users, agents, onClose, onUpdated }) {
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [adding, setAdding]   = useState(false);
  const [selUsers, setSelUsers]   = useState([]);
  const [selAgents, setSelAgents] = useState([]);

  useEffect(() => {
    messagesApi.groupMembers(groupId).then(setMembers).catch(() => {});
  }, [groupId]);

  async function addMembers() {
    try {
      await messagesApi.addGroupMembers(groupId, { user_ids: selUsers, agent_ids: selAgents });
      const m = await messagesApi.groupMembers(groupId);
      setMembers(m); setSelUsers([]); setSelAgents([]); setAdding(false);
      onUpdated();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function remove(memberId) {
    try {
      await messagesApi.removeGroupMember(groupId, memberId);
      setMembers(m => m.filter(x => x.id !== memberId));
      onUpdated();
    } catch (e) { toast(e.message, 'error'); }
  }

  const memberUserIds  = new Set(members.filter(m => m.user_id).map(m => String(m.user_id)));
  const memberAgentIds = new Set(members.filter(m => m.agent_id).map(m => String(m.agent_id)));

  return (
    <div className="border-l border-dark-600 w-64 shrink-0 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-600">
        <span className="text-white text-sm font-semibold">Membres</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-dark-700 group">
            <Avatar
              firstName={m.user_id ? m.user_first : m.agent_first}
              lastName={m.user_id ? m.user_last : m.agent_last}
              color={m.user_id ? '#64748B' : m.color}
              size="sm"
            />
            <span className="text-slate-300 text-xs flex-1 truncate">
              {m.user_id ? `${m.user_first} ${m.user_last}` : `${m.agent_first} ${m.agent_last}`}
            </span>
            <button onClick={() => remove(m.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-opacity">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-dark-600">
        {!adding ? (
          <button onClick={() => setAdding(true)} className="w-full flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            <UserPlus className="w-3.5 h-3.5" /> Ajouter des membres
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 font-medium">Collaborateurs</p>
            {users.filter(u => !memberUserIds.has(String(u.id))).map(u => (
              <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selUsers.includes(u.id)}
                  onChange={() => setSelUsers(s => s.includes(u.id) ? s.filter(x => x !== u.id) : [...s, u.id])} />
                <span className="text-xs text-slate-300">{u.first_name} {u.last_name}</span>
              </label>
            ))}
            <p className="text-xs text-slate-500 font-medium mt-2">Agents</p>
            {agents.filter(a => !memberAgentIds.has(String(a.agent_id||a.id))).map(a => (
              <label key={a.agent_id||a.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selAgents.includes(a.agent_id||a.id)}
                  onChange={() => setSelAgents(s => s.includes(a.agent_id||a.id) ? s.filter(x => x !== a.agent_id||a.id) : [...s, a.agent_id||a.id])} />
                <span className="text-xs text-slate-300">{a.last_name} {a.first_name}</span>
              </label>
            ))}
            <div className="flex gap-2 mt-2">
              <button onClick={() => setAdding(false)} className="btn-secondary text-xs py-1 flex-1">Annuler</button>
              <button onClick={addMembers} className="btn-primary text-xs py-1 flex-1">Ajouter</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Messagerie() {
  const toast        = useToast();
  const { user: me } = useAuth();
  const [threads, setThreads]     = useState([]);
  const [allAgents, setAllAgents] = useState([]);
  const [collab, setCollab]       = useState([]);
  const [active, setActive]       = useState(null);
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [search, setSearch]       = useState('');
  const [newModal, setNewModal]   = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [loading, setLoading]     = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  async function loadThreads() {
    try {
      const [th, ag, us] = await Promise.all([messagesApi.threads(), agentsApi.list(true), messagesApi.users()]);
      setThreads(th); setAllAgents(ag); setCollab(us);
    } catch (e) { console.error(e); }
  }

  useEffect(() => { loadThreads(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (active) inputRef.current?.focus(); }, [active]);

  async function openThread(t) {
    setActive(t); setShowMembers(false); setLoading(true);
    try {
      let msgs;
      if (t.thread_type === 'team')        msgs = await messagesApi.teamThread();
      else if (t.thread_type === 'user')   msgs = await messagesApi.userThread(t.target_id);
      else if (t.thread_type === 'group')  msgs = await messagesApi.groupThread(t.target_id);
      else                                  msgs = await messagesApi.agentThread(t.target_id);
      setMessages(msgs);
      loadThreads();
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function send() {
    if (!input.trim() || !active) return;
    const body = input.trim(); setInput('');
    try {
      let msg;
      if (active.thread_type === 'team')       msg = await messagesApi.sendToTeam(body);
      else if (active.thread_type === 'user')  msg = await messagesApi.sendToUser(active.target_id, body);
      else if (active.thread_type === 'group') msg = await messagesApi.sendToGroup(active.target_id, body);
      else                                      msg = await messagesApi.sendToAgent(active.target_id, body);
      setMessages(m => [...m, msg]); loadThreads();
    } catch (e) { toast(e.message, 'error'); setInput(body); }
  }

  async function doDelete(id) {
    try { await messagesApi.delete(id); setMessages(m => m.filter(x => x.id !== id)); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function deleteGroup(id) {
    if (!confirm('Supprimer ce groupe et tous ses messages ?')) return;
    try { await messagesApi.deleteGroup(id); setActive(null); loadThreads(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function isMine(msg) {
    if (active?.thread_type === 'agent') return msg.sender_type === 'user';
    return String(msg.sender_id) === String(me?.id);
  }

  const teamThread   = threads.find(t => t.thread_type === 'team');
  const groupThreads = threads.filter(t => t.thread_type === 'group');
  const agentThreads = threads.filter(t => t.thread_type === 'agent');
  const userThreads  = threads.filter(t => t.thread_type === 'user');
  const filterFn     = t => {
    const name = t.thread_type === 'team' ? 'Équipe' : t.thread_type === 'group' ? t.first_name : `${t.first_name} ${t.last_name}`;
    return name.toLowerCase().includes(search.toLowerCase());
  };

  const headerName = active
    ? active.thread_type === 'team'  ? '# Équipe'
    : active.thread_type === 'group' ? `# ${active.first_name}`
    : `${active.last_name} ${active.first_name}`
    : '';

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-dark-600 bg-dark-800">
      {/* Panneau gauche */}
      <div className="w-72 shrink-0 flex flex-col border-r border-dark-600">
        <div className="px-3 py-3 border-b border-dark-600 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input pl-8 py-1.5 text-sm" placeholder="Rechercher…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setNewModal(true)}
            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Canal équipe */}
          <p className="text-[10px] text-slate-600 uppercase tracking-wide px-2 pt-2 pb-1">Canaux</p>
          <ThreadRow
            t={{ thread_type: 'team', first_name: 'Équipe', last_name: '', color: '#6366F1',
              unread: teamThread?.unread || 0, last_at: teamThread?.last_at, last_body: teamThread?.last_body }}
            active={active?.thread_type === 'team'}
            onClick={() => openThread({ thread_type: 'team', target_id: 0, first_name: 'Équipe', last_name: '', color: '#6366F1' })}
          />

          {/* Groupes */}
          {groupThreads.filter(filterFn).length > 0 && (
            <p className="text-[10px] text-slate-600 uppercase tracking-wide px-2 pt-3 pb-1">Groupes</p>
          )}
          {groupThreads.filter(filterFn).map(t => (
            <ThreadRow key={`group_${t.target_id}`} t={t}
              active={active?.thread_type === 'group' && String(active.target_id) === String(t.target_id)}
              onClick={() => openThread({ ...t })} />
          ))}

          {/* DMs collaborateurs */}
          {userThreads.filter(filterFn).length > 0 && (
            <p className="text-[10px] text-slate-600 uppercase tracking-wide px-2 pt-3 pb-1">Collaborateurs</p>
          )}
          {userThreads.filter(filterFn).map(t => (
            <ThreadRow key={`user_${t.target_id}`} t={t}
              active={active?.thread_type === 'user' && String(active.target_id) === String(t.target_id)}
              onClick={() => openThread({ ...t })} />
          ))}

          {/* Agents */}
          {agentThreads.filter(filterFn).length > 0 && (
            <p className="text-[10px] text-slate-600 uppercase tracking-wide px-2 pt-3 pb-1">Agents</p>
          )}
          {agentThreads.filter(filterFn).map(t => (
            <ThreadRow key={`agent_${t.target_id}`} t={t}
              active={active?.thread_type === 'agent' && String(active.target_id) === String(t.target_id)}
              onClick={() => openThread({ ...t })} />
          ))}

          {threads.length === 0 && !search && (
            <div className="text-center py-10 px-4">
              <MessageSquare className="w-7 h-7 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-xs">Appuyez sur + pour démarrer une conversation ou créer un groupe</p>
            </div>
          )}
        </div>
      </div>

      {/* Panneau central */}
      <div className="flex-1 flex flex-col min-w-0">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
            <MessageSquare className="w-10 h-10 text-slate-700" />
            <p className="text-sm">Sélectionnez une conversation ou appuyez sur +</p>
          </div>
        ) : (
          <>
            {/* En-tête */}
            <div className="px-5 py-3 border-b border-dark-600 flex items-center gap-3">
              <Avatar
                firstName={active.first_name} lastName={active.last_name} color={
                  active.thread_type === 'team' ? '#6366F1' :
                  active.thread_type === 'group' ? '#10B981' : active.color}
                icon={active.thread_type === 'team' ? Hash : active.thread_type === 'group' ? Users : null}
              />
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm">{headerName}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500">
                    {active.thread_type === 'team'  && 'Canal partagé — toute l\'équipe'}
                    {active.thread_type === 'group' && `Groupe · ${active.member_count || ''} membres`}
                    {active.thread_type === 'user'  && 'Message direct — collaborateur'}
                    {active.thread_type === 'agent' && 'Message direct — agent'}
                  </span>
                  {active.thread_type === 'group' && (
                    active.agents_can_reply
                      ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Agents peuvent répondre</span>
                      : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">Diffusion seulement</span>
                  )}
                </div>
              </div>
              {active.thread_type === 'group' && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowMembers(s => !s)}
                    className={`p-1.5 rounded-lg transition-colors ${showMembers ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-white hover:bg-dark-600'}`}>
                    <Users className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteGroup(active.target_id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-slate-600 text-sm">Aucun message — commencez !</div>
              ) : messages.map(msg => {
                const mine = isMine(msg);
                const showSender = !mine && (active.thread_type === 'team' || active.thread_type === 'group' || active.thread_type === 'user');
                const senderName = msg.user_first ? `${msg.user_first} ${msg.user_last}` : `${active.last_name} ${active.first_name}`;
                return (
                  <div key={msg.id} className={`flex items-end gap-2 group ${mine ? 'flex-row-reverse' : ''}`}>
                    {!mine && (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 mb-0.5"
                        style={{ backgroundColor: active.color || '#3B82F6' }}>
                        {(msg.user_first||active.first_name)?.[0]}{(msg.user_last||active.last_name)?.[0]}
                      </div>
                    )}
                    <div className="max-w-[72%]">
                      {showSender && <p className="text-[10px] text-slate-500 mb-0.5 px-1">{senderName}</p>}
                      <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        mine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-dark-700 text-slate-200 rounded-bl-sm'}`}>
                        {msg.body}
                      </div>
                      <div className={`flex items-center gap-1.5 mt-0.5 ${mine ? 'justify-end' : ''}`}>
                        <span className="text-[10px] text-slate-600">{timeAgo(msg.created_at)}</span>
                        {mine && (
                          <button onClick={() => doDelete(msg.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Saisie */}
            <div className="px-4 py-3 border-t border-dark-600">
              <div className="flex items-end gap-2">
                <textarea ref={inputRef} rows={1}
                  className="input flex-1 resize-none text-sm py-2.5 max-h-32" style={{ minHeight: 42 }}
                  placeholder={active.thread_type === 'team' ? 'Message à l\'équipe…' :
                    active.thread_type === 'group' ? `Message dans ${active.first_name}…` :
                    `Message à ${active.first_name}…`}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                />
                <button onClick={send} disabled={!input.trim()}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-1">Entrée pour envoyer · Shift+Entrée nouvelle ligne</p>
            </div>
          </>
        )}
      </div>

      {/* Panneau membres groupe */}
      {showMembers && active?.thread_type === 'group' && (
        <MembersPanel
          groupId={active.target_id}
          users={collab} agents={allAgents}
          onClose={() => setShowMembers(false)}
          onUpdated={loadThreads}
        />
      )}

      {/* Modal nouveau */}
      {newModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-sm shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-600 shrink-0">
              <h2 className="text-white font-semibold">Nouvelle conversation</h2>
              <button onClick={() => setNewModal(false)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <div className="overflow-y-auto">
              <NewModal
                users={collab} agents={allAgents}
                onClose={() => setNewModal(false)}
                onDone={(t) => { loadThreads(); if (t) openThread(t); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
