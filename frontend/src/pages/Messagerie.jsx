import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Trash2, Plus, Search, Users, User, Hash } from 'lucide-react';
import { messagesApi, agentsApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';

function timeAgo(ts) {
  if (!ts) return '';
  const d    = new Date(ts);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)    return 'à l\'instant';
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function Avatar({ firstName, lastName, color, size = 'md', icon: Icon }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  if (Icon) return (
    <div className={`${sz} rounded-xl flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: color || '#6366F1' }}>
      <Icon className="w-4 h-4" />
    </div>
  );
  return (
    <div className={`${sz} rounded-xl flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: color || '#3B82F6' }}>
      {firstName?.[0]}{lastName?.[0]}
    </div>
  );
}

function ThreadItem({ t, active, onClick }) {
  const unread = parseInt(t.unread) || 0;
  const isTeam = t.thread_type === 'team';
  const isUser = t.thread_type === 'user';
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${active ? 'bg-blue-600/15 border border-blue-600/30' : 'hover:bg-dark-700/50'}`}
    >
      <div className="relative shrink-0">
        {isTeam
          ? <Avatar firstName="É" lastName="Q" color="#6366F1" icon={Hash} />
          : isUser
            ? <Avatar firstName={t.first_name} lastName={t.last_name} color="#64748B" icon={User} size="md" />
            : <Avatar firstName={t.first_name} lastName={t.last_name} color={t.color} />
        }
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-sm font-medium truncate ${unread > 0 ? 'text-white' : 'text-slate-300'}`}>
            {isTeam ? 'Équipe' : `${t.last_name} ${t.first_name}`}
          </span>
          {t.last_at && <span className="text-[10px] text-slate-600 shrink-0">{timeAgo(t.last_at)}</span>}
        </div>
        {t.last_body && (
          <p className="text-xs text-slate-500 truncate mt-0.5">{t.last_body}</p>
        )}
      </div>
    </button>
  );
}

export default function Messagerie() {
  const toast         = useToast();
  const { user: me }  = useAuth();
  const [threads, setThreads]       = useState([]);
  const [allAgents, setAllAgents]   = useState([]);
  const [collab, setCollab]         = useState([]);
  const [active, setActive]         = useState(null); // { thread_type, target_id, first_name, last_name, color }
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [search, setSearch]         = useState('');
  const [newModal, setNewModal]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  async function loadThreads() {
    try {
      const [th, ag, us] = await Promise.all([
        messagesApi.threads(),
        agentsApi.list(true),
        messagesApi.users(),
      ]);
      setThreads(th);
      setAllAgents(ag);
      setCollab(us);
    } catch (e) { console.error(e); }
  }

  useEffect(() => { loadThreads(); }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (active) inputRef.current?.focus(); }, [active]);

  async function openThread(t) {
    setActive(t);
    setLoading(true);
    try {
      let msgs;
      if (t.thread_type === 'team')        msgs = await messagesApi.teamThread();
      else if (t.thread_type === 'user')   msgs = await messagesApi.userThread(t.target_id);
      else                                  msgs = await messagesApi.agentThread(t.target_id);
      setMessages(msgs);
      loadThreads();
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  async function send() {
    if (!input.trim() || !active) return;
    const body = input.trim();
    setInput('');
    try {
      let msg;
      if (active.thread_type === 'team')       msg = await messagesApi.sendToTeam(body);
      else if (active.thread_type === 'user')  msg = await messagesApi.sendToUser(active.target_id, body);
      else                                      msg = await messagesApi.sendToAgent(active.target_id, body);
      setMessages(m => [...m, msg]);
      loadThreads();
    } catch (e) { toast(e.message, 'error'); setInput(body); }
  }

  async function doDelete(id) {
    try { await messagesApi.delete(id); setMessages(m => m.filter(x => x.id !== id)); }
    catch (e) { toast(e.message, 'error'); }
  }

  function startThread(t) {
    setNewModal(false);
    openThread(t);
  }

  // Séparer les fils par type
  const teamThread   = threads.find(t => t.thread_type === 'team');
  const agentThreads = threads.filter(t => t.thread_type === 'agent');
  const userThreads  = threads.filter(t => t.thread_type === 'user');

  const filterThread = (t) => {
    const name = t.thread_type === 'team' ? 'Équipe' : `${t.first_name} ${t.last_name}`;
    return name.toLowerCase().includes(search.toLowerCase());
  };

  // Pour savoir si le message est "de moi"
  function isMine(msg) {
    if (active?.thread_type === 'agent') return msg.sender_type === 'user';
    return String(msg.sender_id) === String(me?.id);
  }

  function senderLabel(msg) {
    if (msg.user_first) return `${msg.user_first} ${msg.user_last}`;
    return active?.thread_type === 'agent' ? `${active.last_name} ${active.first_name}` : '?';
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-dark-600 bg-dark-800">

      {/* Panneau gauche */}
      <div className="w-72 shrink-0 flex flex-col border-r border-dark-600">
        {/* Recherche + nouveau */}
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
          <ThreadItem
            t={{ thread_type: 'team', first_name: 'Équipe', last_name: '', color: '#6366F1',
              unread: teamThread?.unread || 0, last_at: teamThread?.last_at, last_body: teamThread?.last_body }}
            active={active?.thread_type === 'team'}
            onClick={() => startThread({ thread_type: 'team', target_id: 0, first_name: 'Équipe', last_name: '', color: '#6366F1' })}
          />

          {/* DMs collaborateurs */}
          {(userThreads.filter(filterThread).length > 0) && (
            <>
              <p className="text-[10px] text-slate-600 uppercase tracking-wide px-2 pt-3 pb-1">Collaborateurs</p>
              {userThreads.filter(filterThread).map(t => (
                <ThreadItem key={`user_${t.target_id}`} t={t}
                  active={active?.thread_type === 'user' && String(active.target_id) === String(t.target_id)}
                  onClick={() => startThread({ ...t })} />
              ))}
            </>
          )}

          {/* Agents */}
          {(agentThreads.filter(filterThread).length > 0 || search) && (
            <p className="text-[10px] text-slate-600 uppercase tracking-wide px-2 pt-3 pb-1">Agents</p>
          )}
          {agentThreads.filter(filterThread).map(t => (
            <ThreadItem key={`agent_${t.target_id}`} t={t}
              active={active?.thread_type === 'agent' && String(active.target_id) === String(t.target_id)}
              onClick={() => startThread({ ...t })} />
          ))}

          {threads.length === 0 && (
            <div className="text-center py-10 px-4">
              <MessageSquare className="w-7 h-7 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-xs">Démarrez une conversation avec le bouton +</p>
            </div>
          )}
        </div>
      </div>

      {/* Panneau droit */}
      <div className="flex-1 flex flex-col min-w-0">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
            <MessageSquare className="w-10 h-10 text-slate-700" />
            <p className="text-sm">Sélectionnez une conversation ou démarrez-en une nouvelle</p>
          </div>
        ) : (
          <>
            {/* En-tête */}
            <div className="px-5 py-3 border-b border-dark-600 flex items-center gap-3">
              {active.thread_type === 'team'
                ? <Avatar firstName="É" color="#6366F1" icon={Hash} />
                : active.thread_type === 'user'
                  ? <Avatar firstName={active.first_name} lastName={active.last_name} color="#64748B" icon={User} />
                  : <Avatar firstName={active.first_name} lastName={active.last_name} color={active.color} />
              }
              <div>
                <div className="text-white font-semibold text-sm">
                  {active.thread_type === 'team' ? '# Équipe' : `${active.last_name} ${active.first_name}`}
                </div>
                <div className="text-xs text-slate-500">
                  {active.thread_type === 'team' && 'Canal partagé avec toute l\'équipe'}
                  {active.thread_type === 'user' && 'Message direct — collaborateur'}
                  {active.thread_type === 'agent' && 'Message direct — agent'}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-slate-600 text-sm">Aucun message — commencez la conversation !</div>
              ) : messages.map(msg => {
                const mine = isMine(msg);
                const showSender = !mine && (active.thread_type === 'team' || active.thread_type === 'user');
                return (
                  <div key={msg.id} className={`flex items-end gap-2 group ${mine ? 'flex-row-reverse' : ''}`}>
                    {!mine && (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 mb-0.5"
                        style={{ backgroundColor: active.color || '#3B82F6' }}>
                        {(msg.user_first || active.first_name)?.[0]}{(msg.user_last || active.last_name)?.[0]}
                      </div>
                    )}
                    <div className="max-w-[72%]">
                      {showSender && <p className="text-[10px] text-slate-500 mb-0.5 px-1">{senderLabel(msg)}</p>}
                      <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        mine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-dark-700 text-slate-200 rounded-bl-sm'
                      }`}>
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
                  className="input flex-1 resize-none text-sm py-2.5 max-h-32"
                  style={{ minHeight: 42 }}
                  placeholder={active.thread_type === 'team'
                    ? 'Message à l\'équipe…'
                    : `Message à ${active.first_name}…`}
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

      {/* Modal nouvelle conversation */}
      {newModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-sm shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-600">
              <h2 className="text-white font-semibold">Nouvelle conversation</h2>
              <button onClick={() => setNewModal(false)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <div className="overflow-y-auto p-3 space-y-1">
              {/* Canal équipe */}
              <p className="text-[10px] text-slate-600 uppercase tracking-wide px-2 pb-1">Canal</p>
              <button onClick={() => startThread({ thread_type: 'team', target_id: 0, first_name: 'Équipe', last_name: '', color: '#6366F1' })}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-dark-700 transition-colors text-left">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Hash className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <div className="text-white text-sm font-medium">Équipe</div>
                  <div className="text-xs text-slate-500">Visible par tous les collaborateurs</div>
                </div>
              </button>

              {/* Collaborateurs */}
              {collab.length > 0 && (
                <>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wide px-2 pt-3 pb-1">Collaborateurs</p>
                  {collab.map(u => (
                    <button key={u.id}
                      onClick={() => startThread({ thread_type: 'user', target_id: u.id, first_name: u.first_name, last_name: u.last_name, color: '#64748B' })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-dark-700 transition-colors text-left">
                      <div className="w-8 h-8 rounded-xl bg-slate-500/20 flex items-center justify-center text-xs font-bold text-slate-300">
                        {u.first_name?.[0]}{u.last_name?.[0]}
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">{u.first_name} {u.last_name}</div>
                        <div className="text-xs text-slate-500 capitalize">{u.role}</div>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* Agents */}
              <p className="text-[10px] text-slate-600 uppercase tracking-wide px-2 pt-3 pb-1">Agents ({allAgents.length})</p>
              {allAgents.map(a => (
                <button key={a.agent_id || a.id}
                  onClick={() => startThread({ thread_type: 'agent', target_id: a.agent_id || a.id, first_name: a.first_name, last_name: a.last_name, color: a.color })}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-dark-700 transition-colors text-left">
                  <Avatar firstName={a.first_name} lastName={a.last_name} color={a.color} size="sm" />
                  <div>
                    <div className="text-white text-sm font-medium">{a.last_name} {a.first_name}</div>
                    {a.employee_number && <div className="text-xs text-slate-500">{a.employee_number}</div>}
                  </div>
                  {agentThreads.find(t => String(t.target_id) === String(a.agent_id || a.id)) && (
                    <span className="ml-auto text-xs text-slate-600">existant</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
