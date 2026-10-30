import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Search, 
  Clock, 
  User, 
  Users,
  Phone, 
  FileText, 
  CheckCircle2, 
  Edit2, 
  Trash2, 
  X, 
  UtensilsCrossed,
  Crown,
  CalendarCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../contexts/ThemeContext';
import { useSessions } from '../contexts/SessionContext';
import { Reservation, Table, ActiveSession } from '../types';
import { apiFetch } from '../lib/api';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';

const Reservations: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { sessions, startSession } = useSessions();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'active' | 'completed' | 'cancelled'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Partial<Reservation> | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState<Reservation | null>(null);

  // Form State
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formTableId, setFormTableId] = useState<number | ''>('');
  const [formReservationTime, setFormReservationTime] = useState('');
  const [formGuestsCount, setFormGuestsCount] = useState<number>(2);
  const [formDurationMinutes, setFormDurationMinutes] = useState<number>(120);
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<Reservation['status']>('confirmed');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchReservations = useCallback(async () => {
    try {
      const res = await apiFetch('/api/reservations');
      const data = await res.json();
      setReservations(data);
    } catch (error) {
      console.error('Error fetching reservations:', error);
      toast.error(t('error_update'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchTables = useCallback(async () => {
    try {
      const res = await apiFetch('/api/tables');
      const data = await res.json();
      setTables(data);
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
    fetchTables();
  }, [fetchReservations, fetchTables]);

  const openCreateModal = () => {
    setEditingReservation(null);
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormTableId(tables.length > 0 ? tables[0].id : '');
    
    // Default reservation time to next full hour in local ISO format (YYYY-MM-DDTHH:mm)
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0, 0, 0);
    const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    
    setFormReservationTime(localIso);
    setFormGuestsCount(2);
    setFormDurationMinutes(120);
    setFormNotes('');
    setFormStatus('confirmed');
    setIsModalOpen(true);
  };

  const openEditModal = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setFormCustomerName(reservation.customer_name);
    setFormCustomerPhone(reservation.customer_phone || '');
    setFormTableId(reservation.table_id);
    
    const d = new Date(reservation.reservation_time);
    const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    
    setFormReservationTime(localIso);
    setFormGuestsCount(reservation.guests_count || 2);
    setFormDurationMinutes(reservation.duration_minutes || 120);
    setFormNotes(reservation.notes || '');
    setFormStatus(reservation.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim() || !formTableId || !formReservationTime) {
      toast.error(t('error_add'));
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        customer_name: formCustomerName.trim(),
        customer_phone: formCustomerPhone.trim(),
        table_id: Number(formTableId),
        reservation_time: new Date(formReservationTime).toISOString(),
        guests_count: formGuestsCount,
        duration_minutes: formDurationMinutes,
        notes: formNotes.trim(),
        status: formStatus
      };

      let res;
      if (editingReservation?.id) {
        res = await apiFetch(`/api/reservations/${editingReservation.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await apiFetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'DOUBLE_BOOKING') {
          toast.error(data.message || t('conflict_error'));
        } else {
          toast.error(data.message || t('error_update'));
        }
        return;
      }

      toast.success(editingReservation ? t('success_update') : t('success_add'));
      setIsModalOpen(false);
      fetchReservations();
    } catch (error) {
      toast.error(t('error_update'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!reservationToDelete) return;
    try {
      const res = await apiFetch(`/api/reservations/${reservationToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success(t('success_delete'));
        setIsDeleteModalOpen(false);
        setReservationToDelete(null);
        fetchReservations();
      } else {
        toast.error(t('error_delete'));
      }
    } catch (error) {
      toast.error(t('error_delete'));
    }
  };

  const handleStartSessionFromReservation = async (reservation: Reservation) => {
    const table = tables.find(t => t.id === reservation.table_id);
    if (!table) {
      toast.error(t('error_update'));
      return;
    }

    if (sessions[table.id]) {
      toast.error(t('active_tables'));
      return;
    }

    try {
      const newSession: ActiveSession = {
        tableId: table.id,
        startTime: Date.now(),
        products: [],
        billingMode: 'adi',
        isAlreadyPaid: false,
        guestNote: reservation.notes ? `${reservation.customer_name} • ${reservation.notes}` : reservation.customer_name
      };

      await startSession(newSession);

      await apiFetch(`/api/reservations/${reservation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: reservation.customer_name,
          customer_phone: reservation.customer_phone,
          table_id: reservation.table_id,
          reservation_time: reservation.reservation_time,
          guests_count: reservation.guests_count || 2,
          duration_minutes: reservation.duration_minutes || 120,
          notes: reservation.notes,
          status: 'active'
        })
      });

      toast.success(`${t('success_add')}: ${table.name}`);
      fetchReservations();
    } catch (error) {
      toast.error(t('error_add'));
    }
  };

  // Filter reservations
  const filteredReservations = reservations.filter(r => {
    const matchesSearch = 
      r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.customer_phone && r.customer_phone.includes(search)) ||
      (r.table_name && r.table_name.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Reservation['status']) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('status_confirmed')}
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            {t('status_pending')}
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <UtensilsCrossed className="w-3.5 h-3.5" />
            {t('status_active')}
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('status_completed')}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <X className="w-3.5 h-3.5" />
            {t('status_cancelled')}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-3 rounded-2xl border",
              theme === 'dark' ? "bg-white/5 border-white/10 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600"
            )}>
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className={cn("text-3xl font-black tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
                {t('reservations')}
              </h1>
              <p className="text-sm font-medium text-zinc-500 mt-0.5">
                {t('reservations_subtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {t('add_reservation')}
          </button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className={cn(
        "p-4 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-4 transition-colors",
        theme === 'dark' ? "bg-[#111111] border-white/5" : "bg-white border-slate-200 shadow-sm"
      )}>
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder={t('search_reservation_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full pl-11 pr-4 py-2.5 rounded-2xl text-sm font-medium border outline-none transition-colors",
              theme === 'dark'
                ? "bg-white/5 border-white/10 text-white placeholder-zinc-500 focus:border-blue-500/50"
                : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
            )}
          />
        </div>

        {/* Status Filter Tabs */}
        <div className={cn(
          "flex items-center gap-1.5 p-1 rounded-2xl border overflow-x-auto max-w-full",
          theme === 'dark' ? "bg-white/[0.02] border-white/5" : "bg-slate-100 border-slate-200"
        )}>
          {(['all', 'confirmed', 'pending', 'active', 'completed', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap cursor-pointer",
                statusFilter === status
                  ? theme === 'dark'
                    ? "bg-white text-black shadow-md"
                    : "bg-white text-slate-900 shadow-sm border border-slate-200"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {status === 'all' ? t('status_all') : (t(`status_${status}`) || t(status))}
            </button>
          ))}
        </div>
      </div>

      {/* Reservations List / Grid */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-zinc-500 font-medium">{t('loading')}...</p>
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className={cn(
          "py-20 px-6 text-center rounded-3xl border transition-colors",
          theme === 'dark' ? "bg-[#111111] border-white/5 text-zinc-500" : "bg-white border-slate-200 text-slate-400"
        )}>
          <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <h3 className={cn("text-lg font-bold mb-1", theme === 'dark' ? "text-zinc-300" : "text-slate-700")}>
            {t('no_reservations_found')}
          </h3>
          <p className="text-xs max-w-md mx-auto">
            {t('no_reservations_desc')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredReservations.map((reservation) => {
            const table = tables.find(t => t.id === reservation.table_id);
            const isTableActive = !!sessions[reservation.table_id];
            const dateObj = new Date(reservation.reservation_time);
            const formattedTime = dateObj.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
            const formattedDate = dateObj.toLocaleDateString('az-AZ', { day: '2-digit', month: 'short', year: 'numeric' });

            return (
              <motion.div
                key={reservation.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "p-5 rounded-3xl border relative flex flex-col justify-between transition-all duration-200 group hover:shadow-xl",
                  theme === 'dark'
                    ? "bg-[#141414] border-white/5 hover:border-white/15 hover:bg-[#181818]"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                )}
              >
                <div>
                  {/* Top Row: Table and Status */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "p-2 rounded-xl",
                        table?.type === 'kabinet' 
                          ? "bg-amber-500/10 text-amber-500" 
                          : "bg-blue-500/10 text-blue-500"
                      )}>
                        {table?.type === 'kabinet' ? <Crown className="w-5 h-5" /> : <UtensilsCrossed className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className={cn("font-bold text-base", theme === 'dark' ? "text-white" : "text-slate-900")}>
                          {table?.name || `Masa #${reservation.table_id}`}
                        </h4>
                        <span className="text-[11px] font-semibold text-zinc-500">
                          {table?.type === 'kabinet' ? t('vip_kabinet') : t('standard')}
                        </span>
                      </div>
                    </div>

                    <div>
                      {getStatusBadge(reservation.status)}
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className={cn(
                    "p-3.5 rounded-2xl mb-4 space-y-2 border",
                    theme === 'dark' ? "bg-white/[0.02] border-white/5" : "bg-slate-50 border-slate-100"
                  )}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className={cn("font-bold text-sm truncate", theme === 'dark' ? "text-white" : "text-slate-800")}>
                          {reservation.customer_name}
                        </span>
                      </div>
                      {reservation.guests_count && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-500 text-[11px] font-bold tabular-nums shrink-0">
                          <Users className="w-3 h-3" />
                          {reservation.guests_count} {t('guests_unit')}
                        </span>
                      )}
                    </div>

                    {reservation.customer_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                        <a 
                          href={`tel:${reservation.customer_phone}`}
                          className="font-mono text-xs font-semibold text-zinc-400 hover:text-emerald-400 transition-colors tabular-nums"
                        >
                          {reservation.customer_phone}
                        </a>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="font-semibold text-xs text-zinc-400 tabular-nums">
                        {formattedDate}, {formattedTime}
                      </span>
                    </div>
                  </div>

                  {/* Notes if any */}
                  {reservation.notes && (
                    <div className="flex items-start gap-2 mb-4 px-1">
                      <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-zinc-400 italic">
                        "{reservation.notes}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className={cn(
                  "pt-4 border-t flex items-center justify-between gap-2 mt-2",
                  theme === 'dark' ? "border-white/5" : "border-slate-100"
                )}>
                  <div className="flex items-center gap-1.5">
                    {reservation.status !== 'completed' && reservation.status !== 'cancelled' && (
                      <button
                        onClick={() => handleStartSessionFromReservation(reservation)}
                        disabled={isTableActive}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer",
                          isTableActive
                            ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                            : "bg-emerald-500 hover:bg-emerald-400 text-white shadow-md shadow-emerald-500/20 active:scale-95"
                        )}
                        title={isTableActive ? t('active_tables') : t('start_session_from_reservation')}
                      >
                        <UtensilsCrossed className="w-3 h-3" />
                        <span>{t('start_session_from_reservation')}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(reservation)}
                      className={cn(
                        "p-2 rounded-xl border transition-colors cursor-pointer",
                        theme === 'dark'
                          ? "bg-white/5 border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
                          : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                      )}
                      title={t('edit')}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setReservationToDelete(reservation);
                        setIsDeleteModalOpen(true);
                      }}
                      className={cn(
                        "p-2 rounded-xl border transition-colors cursor-pointer",
                        theme === 'dark'
                          ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                          : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                      )}
                      title={t('delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={cn(
                "w-full max-w-lg rounded-3xl border p-6 shadow-2xl relative overflow-hidden",
                theme === 'dark' ? "bg-[#141414] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
              )}
            >
              <div className="flex items-center justify-between pb-4 border-b mb-6 border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold">
                    {editingReservation ? t('edit_reservation') : t('add_reservation')}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Customer Name */}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    {t('customer_name')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Məs: Əli Məmmədov"
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    className={cn(
                      "w-full px-4 py-3 rounded-2xl text-sm font-semibold border outline-none transition-colors",
                      theme === 'dark'
                        ? "bg-white/5 border-white/10 text-white placeholder-zinc-600 focus:border-blue-500"
                        : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
                    )}
                  />
                </div>

                {/* Customer Phone */}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    {t('customer_phone')}
                  </label>
                  <input
                    type="text"
                    placeholder="Məs: +994 50 123 45 67"
                    value={formCustomerPhone}
                    onChange={(e) => setFormCustomerPhone(e.target.value)}
                    className={cn(
                      "w-full px-4 py-3 rounded-2xl text-sm font-semibold border outline-none transition-colors font-mono",
                      theme === 'dark'
                        ? "bg-white/5 border-white/10 text-white placeholder-zinc-600 focus:border-blue-500"
                        : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
                    )}
                  />
                </div>

                {/* Table and Guests Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      {t('table')} / {t('kabinet')} *
                    </label>
                    <select
                      required
                      value={formTableId}
                      onChange={(e) => setFormTableId(Number(e.target.value))}
                      className={cn(
                        "w-full px-4 py-3 rounded-2xl text-sm font-semibold border outline-none transition-colors",
                        theme === 'dark'
                          ? "bg-[#1e1e1e] border-white/10 text-white focus:border-blue-500"
                          : "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"
                      )}
                    >
                      {tables.map(table => (
                        <option key={table.id} value={table.id}>
                          {table.name} ({table.type === 'kabinet' ? t('vip_kabinet') : t('standard')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      {t('guests_count')} *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      required
                      value={formGuestsCount}
                      onChange={(e) => setFormGuestsCount(Math.max(1, Number(e.target.value)))}
                      className={cn(
                        "w-full px-4 py-3 rounded-2xl text-sm font-semibold border outline-none transition-colors tabular-nums",
                        theme === 'dark'
                          ? "bg-white/5 border-white/10 text-white focus:border-blue-500"
                          : "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"
                      )}
                    />
                  </div>
                </div>

                {/* Reservation Time & Estimated Stay */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      {t('reservation_time')} *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formReservationTime}
                      onChange={(e) => setFormReservationTime(e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 rounded-2xl text-sm font-semibold border outline-none transition-colors",
                        theme === 'dark'
                          ? "bg-white/5 border-white/10 text-white focus:border-blue-500"
                          : "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      {t('estimated_stay')}
                    </label>
                    <select
                      value={formDurationMinutes}
                      onChange={(e) => setFormDurationMinutes(Number(e.target.value))}
                      className={cn(
                        "w-full px-4 py-3 rounded-2xl text-sm font-semibold border outline-none transition-colors",
                        theme === 'dark'
                          ? "bg-[#1e1e1e] border-white/10 text-white focus:border-blue-500"
                          : "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"
                      )}
                    >
                      <option value={60}>1 {t('hours')}</option>
                      <option value={90}>1.5 {t('hours')}</option>
                      <option value={120}>2 {t('hours')}</option>
                      <option value={180}>3 {t('hours')}</option>
                      <option value={240}>4 {t('hours')}</option>
                    </select>
                  </div>
                </div>

                {/* Status (when editing) */}
                {editingReservation && (
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      {t('status')}
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as Reservation['status'])}
                      className={cn(
                        "w-full px-4 py-3 rounded-2xl text-sm font-semibold border outline-none transition-colors",
                        theme === 'dark'
                          ? "bg-[#1e1e1e] border-white/10 text-white focus:border-blue-500"
                          : "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"
                      )}
                    >
                      <option value="confirmed">{t('status_confirmed')}</option>
                      <option value="pending">{t('status_pending')}</option>
                      <option value="active">{t('status_active')}</option>
                      <option value="completed">{t('status_completed')}</option>
                      <option value="cancelled">{t('status_cancelled')}</option>
                    </select>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    {t('notes')}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={t('extra_notes_placeholder')}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className={cn(
                      "w-full px-4 py-3 rounded-2xl text-sm font-medium border outline-none transition-colors resize-none",
                      theme === 'dark'
                        ? "bg-white/5 border-white/10 text-white placeholder-zinc-600 focus:border-blue-500"
                        : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500"
                    )}
                  />
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-3 rounded-2xl font-bold text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-6 py-3 rounded-2xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {formSubmitting ? `${t('loading')}...` : t('save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title={t('confirm_delete')}
        message={t('confirm_delete_reservation')}
        onConfirm={handleDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setReservationToDelete(null);
        }}
      />
    </div>
  );
};

export default Reservations;
