import { useEffect, useState, useCallback } from 'react';
import {
  format, startOfWeek, endOfWeek, addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths,
  eachDayOfInterval, isSameDay, parseISO, getDay
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Download, Mail, Trash2, Edit2, Send, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { shiftsApi, agentsApi, sitesApi, absencesApi, pdfApi, emailApi } from '../api';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';
import { ToastProvider, useToast } from '../components/Toast';

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function ShiftForm({ shift, agents, sites, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    agent_id: shift?.agent_id || '',
    site_id: shift?.site_id || '',
    date: shift?.date || format(new Date(), 'yyyy-MM-dd'),
    start_time: shift?.start_time || '08:00',
    end_time: shift?.end_time || '20:00',
    notes: shift?.notes || '',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (shift?.id) {
        await shiftsApi.update(shift.id, form);
        toast('Shift modifié avec succès');
      } else {
        await shiftsApi.create(form);
        toast('Shift créé avec succès');
      }
      onSave();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Agent *</label>
          <select className="input" value={form.agent_id} onChange={e => set('agent_id', e.target.value)} required>
            <option value="">Sélectionner...</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Site *</label>
          <select className="input" value={form.site_id} onChange={e => set('site_id', e.target.value)} required>
            <option value="">Sélectionner...</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name} — {s.client_name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Date *</label>
        <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Heure début *</label>
          <input type="time" className="input" value={form.start_time} onChange={e => set('start_time', e.target.value)} required />
        </div>
        <div>
          <label className="label">Heure fin *</label>
          <input type="time" className="input" value={form.end_time} onChange={e => set('end_time', e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
        <button type="submit" className="btn-primary">
          {shift?.id ? 'Modifier' : 'Créer le shift'}
        </button>
      </div>
    </form>
  );
}

function ExportModal({ onClose, agents, sites }) {
  const toast = useToast();
  const [type, setType] = useState('agent');
  const [selectedId, setSelectedId] = useState('');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [sendEmail, setSendEmail] = useState(false);
  const [emailTo, setEmailTo] = useState('');

  async function handleExport() {
    if (!selectedId) return toast('Veuillez sélectionner un élément', 'error');
    const params = { start_date: startDate, end_date: endDate };
    if (!sendEmail) {
      if (type === 'agent') pdfApi.agentPlanning(selectedId, params);
      else if (type === 'site') pdfApi.sitePlanning(selectedId, params);
      onClose();
    } else {
      try {
        await emailApi.sendAgentPlanning(selectedId, { ...params, to: emailTo });
        toast('Email envoyé avec succès');
        onClose();
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  }

  const [bulkSending, setBulkSending] = useState(false);

  async function handleBulkEmail() {
    setBulkSending(true);
    try {
      const res = await emailApi.sendBulkPlanning({ start_date: startDate, end_date: endDate });
      toast(`Plannings envoyés : ${res.sent} succès, ${res.failed} échec(s)`);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setBulkSending(false); }
  }

  return (
    <Modal title="Export / Envoi Planning" onClose={onClose} size="md">
      <div className="space-y-4">
        {/* Bulk email banner */}
        <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-300">Envoi groupé</span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Envoie automatiquement le planning par email à <strong className="text-white">tous les agents actifs</strong> ayant une adresse email.</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Date début</label>
              <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Date fin</label>
              <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <button className="btn-primary w-full" onClick={handleBulkEmail} disabled={bulkSending}>
            <Send className="w-4 h-4" />
            {bulkSending ? 'Envoi en cours...' : 'Envoyer à tous les agents'}
          </button>
        </div>

        <div className="border-t border-dark-600 pt-4">
          <p className="text-xs text-slate-500 mb-3">Ou exporter / envoyer un planning individuel :</p>
          <div>
            <label className="label">Type d'export</label>
            <div className="flex gap-2">
              {['agent', 'site', 'client'].map(t => (
                <button key={t} onClick={() => { setType(t); setSelectedId(''); }}
                  className={`px-3 py-1.5 rounded-lg text-sm capitalize border transition-colors ${
                    type === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-dark-700 border-dark-500 text-slate-300'
                  }`}>
                  {t === 'agent' ? 'Agent' : t === 'site' ? 'Site' : 'Client'}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <label className="label">{type === 'agent' ? 'Agent' : type === 'site' ? 'Site' : 'Client'}</label>
            <select className="input" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              <option value="">Sélectionner...</option>
              {type === 'agent' && agents.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
              {type === 'site' && sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input type="checkbox" id="sendEmail" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)}
              className="w-4 h-4 rounded border-dark-500 bg-dark-700 accent-blue-500" />
            <label htmlFor="sendEmail" className="text-sm text-slate-300 cursor-pointer">Envoyer par email</label>
          </div>
          {sendEmail && (
            <div className="mt-3">
              <label className="label">Email destinataire</label>
              <input type="email" className="input" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="agent@email.com" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose}>Fermer</button>
          <button className="btn-primary" onClick={handleExport}>
            {sendEmail ? <><Mail className="w-4 h-4" /> Envoyer</> : <><Download className="w-4 h-4" /> Exporter PDF</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ——— Weekly View ———
function WeeklyView({ days, shifts, absences, agents, onAddShift, onEditShift, onDeleteShift, onOpenAgent }) {
  const getShiftsForDay = (day, agentId) =>
    shifts.filter(s => isSameDay(parseISO(s.date), day) && s.agent_id === agentId);

  const getAbsencesForDay = (day, agentId) =>
    absences.filter(a => {
      const start = parseISO(a.start_date);
      const end = parseISO(a.end_date);
      return a.agent_id === agentId && day >= start && day <= end;
    });

  const ABSENCE_LABELS = { conge: 'Congé', maladie: 'Maladie', autre: 'Absence' };
  const ABSENCE_COLORS = { conge: 'bg-emerald-600/30 text-emerald-300 border-emerald-600/40', maladie: 'bg-red-600/30 text-red-300 border-red-600/40', autre: 'bg-slate-600/30 text-slate-300 border-slate-600/40' };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="w-36 text-left px-3 py-3 text-xs text-slate-400 font-medium border-b border-dark-600">Agent</th>
            {days.map(day => {
              const isSun = getDay(day) === 0;
              const isSat = getDay(day) === 6;
              return (
                <th key={day.toISOString()} className={`px-2 py-3 text-center border-b border-dark-600 min-w-[100px] ${
                  isSun ? 'bg-amber-900/10' : isSat ? 'bg-dark-700/30' : ''
                }`}>
                  <div className={`text-xs font-medium ${isSun ? 'text-amber-400' : 'text-slate-300'}`}>
                    {format(day, 'EEE', { locale: fr })}
                  </div>
                  <div className={`text-sm font-bold ${isSun ? 'text-amber-300' : 'text-white'}`}>
                    {format(day, 'd')}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {agents.map((agent, idx) => (
            <tr key={agent.id} className={idx % 2 === 0 ? 'bg-dark-800/30' : ''}>
              <td
                className="px-3 py-2 border-b border-dark-600/50 cursor-pointer select-none group"
                title="Double-clic pour ouvrir la fiche"
                onDoubleClick={() => onOpenAgent?.(agent)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: agent.color || '#3B82F6' }} />
                  <span className="text-xs text-slate-300 font-medium truncate group-hover:text-white">
                    {agent.first_name} {agent.last_name}
                  </span>
                </div>
              </td>
              {days.map(day => {
                const isSun = getDay(day) === 0;
                const dayShifts = getShiftsForDay(day, agent.id);
                const dayAbsences = getAbsencesForDay(day, agent.id);
                return (
                  <td key={day.toISOString()} className={`px-1 py-1.5 border-b border-dark-600/50 align-top ${
                    isSun ? 'bg-amber-900/5' : ''
                  }`}>
                    <div className="space-y-0.5 min-h-[32px]">
                      {dayAbsences.map(ab => (
                        <div key={ab.id} className={`shift-chip border ${ABSENCE_COLORS[ab.type] || ABSENCE_COLORS.autre}`}>
                          {ABSENCE_LABELS[ab.type] || 'Absence'}
                        </div>
                      ))}
                      {dayShifts.map(shift => (
                        <div
                          key={shift.id}
                          className="shift-chip border border-white/10 flex items-center justify-between group"
                          style={{ backgroundColor: (agent.color || '#3B82F6') + '33', color: agent.color || '#3B82F6' }}
                        >
                          <span>{shift.start_time}–{shift.end_time}</span>
                          <div className="hidden group-hover:flex gap-0.5 ml-1">
                            <button onClick={() => onEditShift(shift)} className="hover:text-white p-0.5 rounded">
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                            <button onClick={() => onDeleteShift(shift.id)} className="hover:text-red-400 p-0.5 rounded">
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => onAddShift(agent.id, day)}
                        className="w-full text-left px-1 py-0.5 rounded text-xs text-slate-600 hover:text-blue-400 hover:bg-blue-600/10 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ——— Monthly View ———
function MonthlyView({ currentDate, shifts, absences, agents, onAddShift, onEditShift, onDeleteShift }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const getShiftsForDay = (day) => shifts.filter(s => isSameDay(parseISO(s.date), day));
  const getAbsencesForDay = (day) => absences.filter(a => {
    return day >= parseISO(a.start_date) && day <= parseISO(a.end_date);
  });

  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-slate-400 py-2">{d}</div>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map(day => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isSun = getDay(day) === 0;
              const isSat = getDay(day) === 6;
              const dayShifts = getShiftsForDay(day);
              const dayAbsences = getAbsencesForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[90px] rounded-lg border p-1.5 ${
                    !isCurrentMonth ? 'bg-dark-900/50 border-dark-700/30' :
                    isSun ? 'bg-amber-900/10 border-amber-800/20' :
                    'bg-dark-800 border-dark-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                      isToday ? 'bg-blue-600 text-white' :
                      isSun ? 'text-amber-400' :
                      isCurrentMonth ? 'text-slate-300' : 'text-slate-600'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    <button
                      onClick={() => onAddShift(null, day)}
                      className="text-slate-600 hover:text-blue-400 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {dayAbsences.slice(0, 2).map(ab => {
                      const a = agentMap[ab.agent_id];
                      return (
                        <div key={ab.id} className="shift-chip bg-red-600/20 text-red-300 border border-red-600/30">
                          {a ? `${a.first_name[0]}. ${a.last_name}` : '?'} — Abs.
                        </div>
                      );
                    })}
                    {dayShifts.slice(0, 3).map(shift => {
                      const a = agentMap[shift.agent_id];
                      return (
                        <div
                          key={shift.id}
                          className="shift-chip border border-white/10 group flex items-center justify-between"
                          style={{
                            backgroundColor: (a?.color || '#3B82F6') + '33',
                            color: a?.color || '#3B82F6'
                          }}
                          onClick={() => onEditShift(shift)}
                        >
                          <span className="truncate">{a ? `${a.first_name[0]}. ${a.last_name}` : '?'}</span>
                          <span className="ml-1 opacity-70 shrink-0">{shift.start_time}</span>
                        </div>
                      );
                    })}
                    {dayShifts.length > 3 && (
                      <div className="text-xs text-slate-500 px-1">+{dayShifts.length - 3} autres</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ——— Main Planning ———
function PlanningInner() {
  const toast = useToast();
  const navigate = useNavigate();
  const [view, setView] = useState('week'); // 'week' | 'month'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [agents, setAgents] = useState([]);
  const [sites, setSites] = useState([]);
  const [shiftModal, setShiftModal] = useState(null); // null | { shift?, agentId?, date? }
  const [deleteId, setDeleteId] = useState(null);
  const [exportModal, setExportModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const rangeStart = view === 'week' ? weekStart : monthStart;
  const rangeEnd = view === 'week' ? weekEnd : monthEnd;

  const days = view === 'week'
    ? eachDayOfInterval({ start: weekStart, end: weekEnd })
    : [];

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = {
      start_date: format(rangeStart, 'yyyy-MM-dd'),
      end_date: format(rangeEnd, 'yyyy-MM-dd'),
    };
    const [s, ab, ag, si] = await Promise.all([
      shiftsApi.list(params),
      absencesApi.list(params),
      agentsApi.list(true),
      sitesApi.list(),
    ]);
    setShifts(s);
    setAbsences(ab);
    setAgents(ag);
    setSites(si);
    setLoading(false);
  }, [format(rangeStart, 'yyyy-MM-dd'), format(rangeEnd, 'yyyy-MM-dd')]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function prev() {
    setCurrentDate(d => view === 'week' ? subWeeks(d, 1) : subMonths(d, 1));
  }
  function next() {
    setCurrentDate(d => view === 'week' ? addWeeks(d, 1) : addMonths(d, 1));
  }

  function openAdd(agentId, day) {
    setShiftModal({
      shift: {
        agent_id: agentId || '',
        date: format(day, 'yyyy-MM-dd'),
        start_time: '08:00',
        end_time: '20:00',
      }
    });
  }

  function openEdit(shift) {
    setShiftModal({ shift });
  }

  async function handleDelete() {
    try {
      await shiftsApi.delete(deleteId);
      toast('Shift supprimé');
      fetchData();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const title = view === 'week'
    ? `Semaine du ${format(weekStart, 'd MMM', { locale: fr })} au ${format(weekEnd, 'd MMM yyyy', { locale: fr })}`
    : format(currentDate, 'MMMM yyyy', { locale: fr });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Planning</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => setExportModal(true)}>
            <Download className="w-4 h-4" /> Export PDF
          </button>
          <button className="btn-primary" onClick={() => setShiftModal({ shift: {} })}>
            <Plus className="w-4 h-4" /> Nouveau shift
          </button>
        </div>
      </div>

      <div className="card p-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button className="btn-secondary p-2" onClick={prev}><ChevronLeft className="w-4 h-4" /></button>
            <button className="btn-secondary text-sm px-3 py-2" onClick={() => setCurrentDate(new Date())}>
              Aujourd'hui
            </button>
            <button className="btn-secondary p-2" onClick={next}><ChevronRight className="w-4 h-4" /></button>
            <span className="text-sm font-semibold text-white ml-2 capitalize">{title}</span>
          </div>
          <div className="flex gap-1 bg-dark-700 rounded-lg p-1">
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'week' ? 'bg-dark-500 text-white' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setView('week')}
            >
              Semaine
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'month' ? 'bg-dark-500 text-white' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setView('month')}
            >
              Mois
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"/>Jour (06h–21h)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500"/>Nuit (21h–06h)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"/>Dimanche</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"/>Absence</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">Chargement...</div>
        ) : view === 'week' ? (
          <WeeklyView
            days={days}
            shifts={shifts}
            absences={absences}
            agents={agents}
            onAddShift={openAdd}
            onEditShift={openEdit}
            onDeleteShift={setDeleteId}
            onOpenAgent={agent => navigate('/agents', { state: { openAgentId: agent.id } })}
          />
        ) : (
          <MonthlyView
            currentDate={currentDate}
            shifts={shifts}
            absences={absences}
            agents={agents}
            onAddShift={openAdd}
            onEditShift={openEdit}
            onDeleteShift={setDeleteId}
          />
        )}
      </div>

      {shiftModal && (
        <Modal title={shiftModal.shift?.id ? 'Modifier le shift' : 'Nouveau shift'} onClose={() => setShiftModal(null)}>
          <ShiftForm
            shift={shiftModal.shift}
            agents={agents}
            sites={sites}
            onSave={() => { setShiftModal(null); fetchData(); }}
            onClose={() => setShiftModal(null)}
          />
        </Modal>
      )}

      {deleteId && (
        <Confirm
          title="Supprimer le shift"
          message="Êtes-vous sûr de vouloir supprimer ce shift ?"
          onConfirm={handleDelete}
          onClose={() => setDeleteId(null)}
        />
      )}

      {exportModal && (
        <ExportModal
          onClose={() => setExportModal(false)}
          agents={agents}
          sites={sites}
        />
      )}
    </div>
  );
}

export default function Planning() {
  return (
    <ToastProvider>
      <PlanningInner />
    </ToastProvider>
  );
}
