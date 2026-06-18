import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Trash2, Plus, Search } from 'lucide-react';
import { messagesApi, agentsApi } from '../api';
import { useToast } from '../components/Toast';

function timeAgo(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)    return 'à l\'instant';
  if (diff < 3600)  return `il y a ${Math.floor(diff/60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff/3600)}h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function Avatar({ firstName, lastName, color, size = 'md' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} rounded-xl flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: color || '#3B82F6' }}>
      {firstName?.[0]}{lastName?.[0]}
    </div>
  );
}

export default function Messagerie() {
  const toast = useToast();
  const [threads, setThreads]       = useState([]);
  const [allAgents, setAllAgents]   = useState([]);
  const [activeAgent, setActiveAgent] = useState(null);
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [search, setSearch]         = useState('');
  const [newModal, setNewModal]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  async function loadThreads() {
    try {
      const [th, ag] = await Promise.all([messagesApi.threads(), agentsApi.list(true)]);
      setThreads(th);
      setAllAgents(ag);
    } catch (e) { toast(e.message, 'error'); }
  }

  async function openThread(agent) {
    setActiveAgent(agent);
    setLoading(true);
    try {
      const msgs = await messagesApi.thread(agent.agent_id || agent.id);
      setMessages(msgs);
      // Rafraîchir le badge unread
      loadThreads();
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadThreads(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (activeAgent) inputRef.current?.focus();
  }, [activeAgent]);

  async function send() {
    if (!input.trim() || !activeAgent) return;
    const body = input.trim();
    setInput('');
    try {
      const msg = await messagesApi.send(activeAgent.agent_id || activeAgent.id, body);
      setMessages(m => [...m, msg]);
      loadThreads();
    } catch (e) { toast(e.message, 'error'); setInput(body); }
  }

  async function doDelete(id) {
    try {
      await messagesApi.delete(id);
      setMessages(m => m.filter(x => x.id !== id));
    } catch (e) { toast(e.message, 'error'); }
  }

  function startNew(agent) {
    setNewModal(false);
    openThread({ ...agent, agent_id: agent.agent_id || agent.id });
  }

  const filteredThreads = threads.filter(t =>
    `${t.first_name} ${t.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  // Agents sans fil existant (pour nouveau thread)
  const threadAgentIds = new Set(threads.map(t => String(t.agent_id)));
  const agentsNoThread = allAgents.filter(a => !threadAgentIds.has(String(a.agent_id || a.id)));

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 overflow-hidden rounded-2xl border border-dark-600 bg-dark-800">

      {/* Panneau gauche — liste des fils */}
      <div className="w-72 shrink-0 flex flex-col border-r border-dark-600">
        <div className="px-4 py-3 border-b border-dark-600 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input pl-8 py-1.5 text-sm" placeholder="Rechercher…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setNewModal(true)}
            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shrink-0" title="Nouveau message">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredThreads.length === 0 && (
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Aucune conversation</p>
              <button onClick={() => setNewModal(true)} className="mt-3 btn-primary text-xs px-3 py-1.5">
                Démarrer une conversation
              </button>
            </div>
          )}
          {filteredThreads.map(t => {
            const isActive = activeAgent && String(activeAgent.agent_id || activeAgent.id) === String(t.agent_id);
            return (
              <button key={t.agent_id}
                onClick={() => openThread(t)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-700/50 transition-colors text-left border-b border-dark-700/50 ${isActive ? 'bg-blue-600/10 border-l-2 border-l-blue-500' : ''}`}
              >
                <div className="relative shrink-0">
                  <Avatar firstName={t.first_name} lastName={t.last_name} color={t.color} />
                  {parseInt(t.unread) > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                      {t.unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium truncate ${parseInt(t.unread) > 0 ? 'text-white' : 'text-slate-300'}`}>
                      {t.last_name} {t.first_name}
                    </span>
                    <span className="text-xs text-slate-600 ml-2 shrink-0">{timeAgo(t.last_at)}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{t.last_body}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panneau droit — fil de messages */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeAgent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <MessageSquare className="w-12 h-12 text-slate-700 mb-4" />
            <p className="text-slate-400 font-medium">Sélectionnez une conversation</p>
            <p className="text-slate-600 text-sm mt-1">ou démarrez-en une nouvelle avec le bouton +</p>
          </div>
        ) : (
          <>
            {/* En-tête */}
            <div className="px-5 py-3 border-b border-dark-600 flex items-center gap-3">
              <Avatar firstName={activeAgent.first_name} lastName={activeAgent.last_name} color={activeAgent.color} />
              <div>
                <div className="text-white font-semibold">{activeAgent.last_name} {activeAgent.first_name}</div>
                {activeAgent.employee_number && <div className="text-xs text-slate-500">{activeAgent.employee_number}</div>}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  Aucun message — commencez la conversation ci-dessous.
                </div>
              ) : (
                messages.map(msg => {
                  const isOut = msg.sender_type === 'user';
                  return (
                    <div key={msg.id} className={`flex items-end gap-2 group ${isOut ? 'flex-row-reverse' : ''}`}>
                      {!isOut && (
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 mb-0.5"
                          style={{ backgroundColor: activeAgent.color || '#3B82F6' }}>
                          {activeAgent.first_name?.[0]}{activeAgent.last_name?.[0]}
                        </div>
                      )}
                      <div className={`max-w-[70%] group relative`}>
                        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          isOut
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-dark-700 text-slate-200 rounded-bl-sm'
                        }`}>
                          {msg.body}
                        </div>
                        <div className={`flex items-center gap-1.5 mt-0.5 ${isOut ? 'justify-end' : ''}`}>
                          <span className="text-[10px] text-slate-600">{timeAgo(msg.created_at)}</span>
                          {isOut && (
                            <button onClick={() => doDelete(msg.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Zone de saisie */}
            <div className="px-4 py-3 border-t border-dark-600">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  className="input flex-1 resize-none text-sm py-2.5 max-h-32"
                  rows={1}
                  placeholder={`Message à ${activeAgent.first_name}…`}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  style={{ minHeight: 42 }}
                />
                <button onClick={send} disabled={!input.trim()}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">Entrée pour envoyer · Shift+Entrée pour sauter une ligne</p>
            </div>
          </>
        )}
      </div>

      {/* Modal nouveau message */}
      {newModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-600">
              <h2 className="text-white font-semibold">Nouvelle conversation</h2>
              <button onClick={() => setNewModal(false)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <div className="p-4 space-y-1 max-h-80 overflow-y-auto">
              {[...agentsNoThread, ...threads.map(t => ({ ...t, agent_id: t.agent_id }))].map(a => (
                <button key={a.agent_id || a.id} onClick={() => startNew(a)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-dark-700 transition-colors text-left">
                  <Avatar firstName={a.first_name} lastName={a.last_name} color={a.color} size="sm" />
                  <div>
                    <div className="text-white text-sm font-medium">{a.last_name} {a.first_name}</div>
                    {a.employee_number && <div className="text-xs text-slate-500">{a.employee_number}</div>}
                  </div>
                  {threads.find(t => String(t.agent_id) === String(a.agent_id || a.id)) && (
                    <span className="ml-auto text-xs text-slate-500">fil existant</span>
                  )}
                </button>
              ))}
              {allAgents.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Aucun agent actif</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
