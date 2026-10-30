import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Trash2, Download, Filter, Eye, EyeOff, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
import { Transaction } from '../types';
import { formatCurrency, cn, formatDateTime, getBakuDateString, convertBakuToUTC } from '../lib/utils';
import { toast } from 'sonner';
import { useTheme } from '../contexts/ThemeContext';
import ConfirmModal from '../components/ConfirmModal';
import ActionPasswordModal from '../components/ActionPasswordModal';
import ReportPasswordModal from '../components/ReportPasswordModal';
import ClearHistoryModal from '../components/ClearHistoryModal';
import FinancialValue from '../components/FinancialValue';
import { useFinancialVisibility } from '../contexts/FinancialVisibilityContext';
import { apiFetch } from '../lib/api';

const Reports: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isVisible, hide } = useFinancialVisibility();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expandedTx, setExpandedTx] = useState<number | null>(null);
  const [summary, setSummary] = useState({ 
    daily: 0, dailyCash: 0, dailyCard: 0,
    monthly: 0, monthlyCash: 0, monthlyCard: 0,
    total: 0, totalCash: 0, totalCard: 0
  });
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');

  const [fromTime, setFromTime] = useState(() => localStorage.getItem('workingFromTime') || '12:00');
  const [toTime, setToTime] = useState(() => localStorage.getItem('workingToTime') || '02:00');
  const [workingFromDate, setWorkingFromDate] = useState(() => {
    const saved = localStorage.getItem('workingFromDate');
    if (saved) return saved;
    return getBakuDateString(new Date());
  });
  const [workingToDate, setWorkingToDate] = useState(() => {
    const saved = localStorage.getItem('workingToDate');
    if (saved) return saved;
    const now = new Date();
    // Add 24 hours to current time to get tomorrow's date in Baku
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return getBakuDateString(tomorrow);
  });

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearRangeModalOpen, setIsClearRangeModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<number | null>(null);
  const [txPage, setTxPage] = useState(1);
  const itemsPerPage = 20;

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'delete' | 'clear', data?: any } | null>(null);

  const handlePasswordSuccess = () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'delete') {
      setTxToDelete(pendingAction.data);
      setIsDeleteModalOpen(true);
    } else if (pendingAction.type === 'clear') {
      setIsClearRangeModalOpen(true);
    }
    setPendingAction(null);
  };

  useEffect(() => {
    fetchTransactions();
    fetchSummary();

    // Auto-refresh every minute
    const interval = setInterval(() => {
      fetchTransactions();
      fetchSummary();
    }, 60000);
    return () => clearInterval(interval);
  }, [startDate, startTime, endDate, endTime]);

  const fetchSummary = async () => {
    try {
      const res = await apiFetch('/api/reports/summary');
      const data = await res.json();
      setSummary(data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) {
        const utcStart = convertBakuToUTC(startDate, startTime);
        if (utcStart) params.append('startDate', utcStart);
      }
      if (endDate) {
        const utcEnd = convertBakuToUTC(endDate, endTime);
        if (utcEnd) {
          const utcEndFinal = utcEnd.substring(0, 16) + ':59';
          params.append('endDate', utcEndFinal);
        }
      }

      const res = await apiFetch(`/api/transactions?${params.toString()}&reportType=main`);
      let data = await res.json();
      
      setTransactions(data);
      setTxPage(1); // Reset pagination on refresh
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error(t('error_update'));
    }
  };

  const getFilterDates = (type: 'today' | 'week' | 'month') => {
    const nowBaku = new Date(new Date().getTime() + (4 * 60 * 60 * 1000));
    const todayStr = nowBaku.toISOString().split('T')[0];
    
    if (type === 'today') return { start: todayStr, end: todayStr };
    
    if (type === 'week') {
      const day = nowBaku.getUTCDay(); // 0 is Sun, 1 is Mon
      const dayOffset = day === 0 ? 6 : day - 1;
      const startOfThisWeek = new Date(nowBaku);
      startOfThisWeek.setUTCDate(nowBaku.getUTCDate() - dayOffset);
      return { start: startOfThisWeek.toISOString().split('T')[0], end: todayStr };
    }
    
    if (type === 'month') {
      const startOfThisMonth = new Date(nowBaku);
      startOfThisMonth.setUTCDate(1);
      return { start: startOfThisMonth.toISOString().split('T')[0], end: todayStr };
    }
    
    return { start: todayStr, end: todayStr };
  };

  const isFilterActive = (type: 'today' | 'week' | 'month') => {
    const { start, end } = getFilterDates(type);
    return startDate === start && endDate === end && startTime === '00:00' && endTime === '23:59';
  };

  const setQuickFilter = (type: 'today' | 'week' | 'month') => {
    const { start, end } = getFilterDates(type);
    setStartDate(start);
    setStartTime('00:00');
    setEndDate(end);
    setEndTime('23:59');
  };

  const clearFilters = () => {
    setStartDate('');
    setStartTime('00:00');
    setEndDate('');
    setEndTime('23:59');
  };

  const handleDeleteClick = (id: number) => {
    setPendingAction({ type: 'delete', data: id });
    setIsPasswordModalOpen(true);
  };

  const handleClearHistoryClick = () => {
    setPendingAction({ type: 'clear' });
    setIsPasswordModalOpen(true);
  };

  const exportCSV = () => {
    const headers = ["ID", "Masa", "Açılış Vaxtı", "Bağlanış Vaxtı", "Sifariş Məbləği", "Xidmət Haqqı", "Yekun Hesab", "Ödəniş Üsulu", "Nağd", "Kart", "Tarix"];
    const rows = transactions.map(tx => [
      tx.id,
      `"${tx.table_name}"`,
      `"${formatDateTime(tx.start_time)}"`,
      `"${formatDateTime(tx.end_time)}"`,
      tx.product_cost,
      tx.service_fee || 0,
      tx.total_cost,
      tx.payment_type,
      tx.cash_amount,
      tx.card_amount,
      `"${formatDateTime(tx.created_at)}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `magify_restoran_hesabat_${getBakuDateString(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SummaryCard = ({ title, total, cash, card }: any) => (
    <div className={cn(
      "border rounded-2xl p-6",
      theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-200 shadow-sm"
    )}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{title}</p>
      <p className={cn("text-2xl font-bold tracking-tighter mb-4", theme === 'dark' ? "text-white" : "text-slate-900")}>
        <FinancialValue>{formatCurrency(total)}</FinancialValue>
      </p>
      {(cash > 0 || card > 0) && (
        <div className={cn("flex items-center gap-4 pt-4 border-t", theme === 'dark' ? "border-white/5" : "border-slate-100")}>
          {cash > 0 && (
            <div className="flex flex-col">
              <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-1">{t('cash')}</span>
              <span className="text-xs font-bold text-emerald-500/80 tracking-tight">
                <FinancialValue>{formatCurrency(cash)}</FinancialValue>
              </span>
            </div>
          )}
          {card > 0 && (
            <div className="flex flex-col">
              <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-1">{t('card')}</span>
              <span className="text-xs font-bold text-blue-500/80 tracking-tight">
                <FinancialValue>{formatCurrency(card)}</FinancialValue>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const workingHoursStats = React.useMemo(() => {
    let total = 0;
    let cash = 0;
    let card = 0;
    let mixed = 0;
    let count = 0;
    let unpaidCount = 0;

    const startRange = new Date(`${workingFromDate}T${fromTime}:00+04:00`);
    const endRange = new Date(`${workingToDate}T${toTime}:00+04:00`);

    transactions.forEach(tx => {
      const txDate = new Date(tx.created_at.includes(' ') ? tx.created_at.replace(' ', 'T') + 'Z' : tx.created_at);
      
      if (txDate >= startRange && txDate <= endRange) {
        if (tx.payment_type === 'unpaid') {
          unpaidCount++;
          return;
        }

        total += tx.total_cost;
        count++;
        if (tx.payment_type === 'cash') cash += tx.total_cost;
        else if (tx.payment_type === 'card') card += tx.total_cost;
        else {
          mixed += tx.total_cost;
          cash += tx.cash_amount || 0;
          card += tx.card_amount || 0;
        }
      }
    });

    return { total, cash, card, mixed, count, unpaidCount };
  }, [transactions, workingFromDate, fromTime, workingToDate, toTime]);

  const confirmDelete = async () => {
    if (!txToDelete) return;
    try {
      await apiFetch(`/api/transactions/${txToDelete}?reportType=main`, { method: 'DELETE' });
      toast.success(t('success_delete'));
      fetchTransactions();
      fetchSummary();
      setIsDeleteModalOpen(false);
    } catch (error) {
      toast.error(t('error_delete'));
    }
  };

  const confirmClear = async (startDate?: string, startTime?: string, endDate?: string, endTime?: string) => {
    try {
      const params = new URLSearchParams();
      if (startDate) {
        const utcStart = convertBakuToUTC(startDate, startTime || '00:00');
        if (utcStart) params.append('startDate', utcStart);
      }
      if (endDate) {
        const utcEnd = convertBakuToUTC(endDate, endTime || '23:59');
        if (utcEnd) {
          const utcEndFinal = utcEnd.substring(0, 16) + ':59';
          params.append('endDate', utcEndFinal);
        }
      }

      await apiFetch(`/api/transactions?${params.toString()}&reportType=main`, { method: 'DELETE' });
      toast.success(t('success_delete'));
      fetchTransactions();
      fetchSummary();
      setIsClearRangeModalOpen(false);
    } catch (error) {
      toast.error(t('error_delete'));
    }
  };

  return (
    <div className="space-y-8">
      {isPasswordModalOpen && (
        <ActionPasswordModal 
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          onConfirm={handlePasswordSuccess}
        />
      )}
      {isDeleteModalOpen && (
        <ConfirmModal 
          isOpen={isDeleteModalOpen}
          title={t('delete')}
          message={t('confirm_delete')}
          onConfirm={confirmDelete}
          onCancel={() => setIsDeleteModalOpen(false)}
        />
      )}
      {isClearModalOpen && (
        <ConfirmModal 
          isOpen={isClearModalOpen}
          title={t('clear_history')}
          message={t('clear_history_confirm')}
          onConfirm={confirmClear}
          onCancel={() => setIsClearModalOpen(false)}
        />
      )}
      {isClearRangeModalOpen && (
        <ClearHistoryModal 
          isOpen={isClearRangeModalOpen}
          onClose={() => setIsClearRangeModalOpen(false)}
          onConfirm={confirmClear}
        />
      )}
      {isReportModalOpen && (
        <ReportPasswordModal 
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className={cn("text-3xl font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>{t('reports')}</h1>
          <p className="text-zinc-400 mt-1">{t('manage_reports_desc')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => isVisible ? hide() : setIsReportModalOpen(true)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
              isVisible 
                ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20" 
                : "bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20"
            )}
          >
            {isVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            {isVisible ? t('hide') : t('reveal')}
          </button>
          <button 
            onClick={exportCSV}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all border",
              theme === 'dark' ? "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
            )}
          >
            <Download className="w-5 h-5" />
            {t('export_csv')}
          </button>
        </div>
      </header>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard title={t('revenue_daily')} total={summary.daily} cash={summary.dailyCash} card={summary.dailyCard} />
        <SummaryCard title={t('revenue_monthly')} total={summary.monthly} cash={summary.monthlyCash} card={summary.monthlyCard} />
        <SummaryCard title={t('revenue_total')} total={summary.total} cash={summary.totalCash} card={summary.totalCard} />
      </div>

      {/* Working Hours Revenue Widget */}
      <div className={cn(
        "border rounded-2xl p-6 space-y-6",
        theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-200 shadow-sm"
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center">
              <History className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t('working_hours_revenue')}</h2>
              <p className="text-xs text-zinc-500 font-medium">{t('manage_reports_desc')}</p>
            </div>
          </div>
          
          <div className={cn(
            "flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border",
            theme === 'dark' ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"
          )}>
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">{t('from')}</span>
              <div className={cn(
                "flex items-center gap-2 p-2 rounded-xl border",
                theme === 'dark' ? "bg-black/20 border-white/5" : "bg-white border-slate-200"
              )}>
                <input 
                  type="date" 
                  value={workingFromDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWorkingFromDate(val);
                    localStorage.setItem('workingFromDate', val);
                  }}
                  className={cn(
                    "bg-transparent text-xs font-bold focus:outline-none",
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}
                />
                <div className={cn("w-px h-3", theme === 'dark' ? "bg-white/10" : "bg-slate-200")} />
                <input 
                  type="time" 
                  value={fromTime}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFromTime(val);
                    localStorage.setItem('workingFromTime', val);
                  }}
                  className={cn(
                    "bg-transparent text-xs font-bold focus:outline-none",
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}
                />
              </div>
            </div>

            <div className="hidden sm:block w-px h-8 bg-white/10 self-end mb-2" />

            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">{t('to')}</span>
              <div className={cn(
                "flex items-center gap-2 p-2 rounded-xl border",
                theme === 'dark' ? "bg-black/20 border-white/5" : "bg-white border-slate-200"
              )}>
                <input 
                  type="date" 
                  value={workingToDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWorkingToDate(val);
                    localStorage.setItem('workingToDate', val);
                  }}
                  className={cn(
                    "bg-transparent text-xs font-bold focus:outline-none",
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}
                />
                <div className={cn("w-px h-3", theme === 'dark' ? "bg-white/10" : "bg-slate-200")} />
                <input 
                  type="time" 
                  value={toTime}
                  onChange={(e) => {
                    const val = e.target.value;
                    setToTime(val);
                    localStorage.setItem('workingToTime', val);
                  }}
                  className={cn(
                    "bg-transparent text-xs font-bold focus:outline-none",
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}
                />
              </div>
            </div>
          </div>
        </div>

          <div className={cn(
            "grid grid-cols-2 md:grid-cols-6 gap-6 pt-6 border-t",
            theme === 'dark' ? "border-white/5" : "border-slate-100"
          )}>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('total')}</p>
              <p className={cn("text-2xl font-black tracking-tighter", theme === 'dark' ? "text-white" : "text-slate-900")}>
                <FinancialValue>{formatCurrency(workingHoursStats.total)}</FinancialValue>
              </p>
            </div>
            {workingHoursStats.count > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('orders_count')}</p>
                <p className="text-2xl font-black text-blue-500 tracking-tighter">{workingHoursStats.count}</p>
              </div>
            )}
            {workingHoursStats.cash > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('cash')}</p>
                <p className="text-2xl font-black text-emerald-500 tracking-tighter">
                  <FinancialValue>{formatCurrency(workingHoursStats.cash)}</FinancialValue>
                </p>
              </div>
            )}
            {workingHoursStats.card > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('card')}</p>
                <p className="text-2xl font-black text-blue-400 tracking-tighter">
                  <FinancialValue>{formatCurrency(workingHoursStats.card)}</FinancialValue>
                </p>
              </div>
            )}
            {workingHoursStats.mixed > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('mixed_payment')}</p>
                <p className="text-2xl font-black text-purple-500 tracking-tighter">
                  <FinancialValue>{formatCurrency(workingHoursStats.mixed)}</FinancialValue>
                </p>
              </div>
            )}
            {workingHoursStats.unpaidCount > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('unpaid_closures')}</p>
                <p className="text-2xl font-black text-rose-500 tracking-tighter">{workingHoursStats.unpaidCount}</p>
              </div>
            )}
          </div>
      </div>

      {/* Filters at the Top */}
      <div className={cn(
        "border rounded-2xl p-4",
        theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-200 shadow-sm"
      )}>
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setQuickFilter('today')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-colors duration-100",
                isFilterActive('today')
                  ? "bg-blue-600 text-white shadow-sm"
                  : (theme === 'dark' ? "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900")
              )}
            >
              {t('today')}
            </button>
            <button 
              onClick={() => setQuickFilter('week')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-colors duration-100",
                isFilterActive('week')
                  ? "bg-blue-600 text-white shadow-sm"
                  : (theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white" : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-500 hover:text-slate-900")
              )}
            >
              {t('this_week')}
            </button>
            <button 
              onClick={() => setQuickFilter('month')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-colors duration-100",
                isFilterActive('month')
                  ? "bg-blue-600 text-white shadow-sm"
                  : (theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white" : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-500 hover:text-slate-900")
              )}
            >
              {t('this_month')}
            </button>
            <button 
              onClick={clearFilters}
              className={cn(
                "px-4 py-2 text-sm font-bold transition-colors duration-100",
                theme === 'dark' ? "text-zinc-500 hover:text-white" : "text-slate-400 hover:text-slate-900"
              )}
            >
              {t('clear_filters')}
            </button>
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-4 w-full lg:w-auto">
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap">{t('custom_date_range')}:</span>
              <div className={cn(
                "flex items-center gap-2 p-2 rounded-xl border w-full lg:w-auto",
                theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-sm"
              )}>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={cn(
                    "bg-transparent text-xs font-bold focus:outline-none",
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}
                />
                <div className={cn("w-px h-3", theme === 'dark' ? "bg-white/10" : "bg-slate-200")} />
                <input 
                  type="time" 
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={cn(
                    "bg-transparent text-xs font-bold focus:outline-none",
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap">-</span>
              <div className={cn(
                "flex items-center gap-2 p-2 rounded-xl border w-full lg:w-auto",
                theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-sm"
              )}>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={cn(
                    "bg-transparent text-xs font-bold focus:outline-none",
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}
                />
                <div className={cn("w-px h-3", theme === 'dark' ? "bg-white/10" : "bg-slate-200")} />
                <input 
                  type="time" 
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={cn(
                    "bg-transparent text-xs font-bold focus:outline-none",
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className={cn(
        "border rounded-2xl overflow-hidden shadow-sm",
        theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-200"
      )}>
        <div className={cn(
          "p-6 border-b flex items-center justify-between",
          theme === 'dark' ? "border-white/5 bg-white/5" : "border-slate-100 bg-slate-50/50"
        )}>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-500" />
            <h2 className={cn("font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t('history')}</h2>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                clearFilters();
              }}
              className="flex items-center gap-2 text-blue-500 hover:text-blue-400 text-[10px] font-black uppercase tracking-widest transition-colors duration-100"
            >
              <Filter className="w-3.5 h-3.5" />
              {t('clear_filters')}
            </button>
            <div className="w-px h-4 bg-white/10" />
            <button 
              onClick={handleClearHistoryClick}
              className="flex items-center gap-1.5 text-rose-500 hover:text-rose-400 text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('clear_history')}</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn("border-b", theme === 'dark' ? "border-white/5" : "border-slate-100")}>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">{t('date')}</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">{t('table')}</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">{t('order_items')}</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">{t('payment')}</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">{t('total')}</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", theme === 'dark' ? "divide-white/5" : "divide-slate-100")}>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 italic">
                    {t('no_activity')}
                  </td>
                </tr>
              ) : (
                transactions.slice(0, txPage * itemsPerPage).map(tx => {
                  let parsedProducts: any[] = [];
                  try {
                    parsedProducts = JSON.parse(tx.products_json || '[]');
                  } catch {}
                  const totalItems = parsedProducts.reduce((sum, p) => sum + (p.quantity || 0), 0);

                  return (
                    <React.Fragment key={tx.id}>
                      <tr 
                        className={cn(
                          "transition-colors group cursor-pointer",
                          theme === 'dark' ? "hover:bg-white/5" : "hover:bg-blue-50/50"
                        )}
                        onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                      >
                        <td className="px-6 py-4 text-xs text-zinc-400 tabular-nums">
                          <div className="flex items-center gap-3">
                            {expandedTx === tx.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {formatDateTime(tx.created_at)}
                          </div>
                        </td>
                        <td className={cn("px-6 py-4 font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{tx.table_name}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/10 text-blue-500 rounded-lg text-[11px] font-bold tabular-nums">
                            <ShoppingBag className="w-3 h-3" />
                            {totalItems} {t('items_count')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase w-fit",
                              tx.payment_type === 'cash' ? "bg-emerald-500/10 text-emerald-500" :
                              tx.payment_type === 'card' ? "bg-blue-500/10 text-blue-500" :
                              tx.payment_type === 'mixed' ? "bg-purple-500/10 text-purple-500" :
                              "bg-zinc-500/10 text-zinc-500"
                            )}>
                              {tx.payment_type === 'unpaid' ? t('unpaid_closed') : t(tx.payment_type || 'cash')}
                            </span>
                            {tx.payment_type === 'mixed' && (
                              <span className="text-[9px] text-zinc-500 font-medium tabular-nums">
                                <FinancialValue>{formatCurrency(tx.cash_amount)}</FinancialValue> / <FinancialValue>{formatCurrency(tx.card_amount)}</FinancialValue>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={cn("px-6 py-4 font-black font-mono tabular-nums", theme === 'dark' ? "text-white" : "text-slate-900")}>
                          <FinancialValue>{formatCurrency(tx.total_cost)}</FinancialValue>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(tx.id);
                            }}
                            className="p-2 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {expandedTx === tx.id && (
                        <tr className={theme === 'dark' ? "bg-white/[0.02]" : "bg-slate-50/50"}>
                          <td colSpan={6} className="px-8 sm:px-12 py-6">
                            <div className="space-y-6">
                              <div className={cn(
                                "flex flex-wrap items-center gap-6 pb-4 border-b",
                                theme === 'dark' ? "border-white/5" : "border-slate-200"
                              )}>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('start_time')}</span>
                                  <span className={cn("text-xs font-bold tabular-nums", theme === 'dark' ? "text-white" : "text-slate-900")}>{formatDateTime(tx.start_time)}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('end_time')}</span>
                                  <span className={cn("text-xs font-bold tabular-nums", theme === 'dark' ? "text-white" : "text-slate-900")}>{formatDateTime(tx.end_time)}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('order_amount')}</span>
                                  <span className={cn("text-xs font-mono font-bold tabular-nums", theme === 'dark' ? "text-white" : "text-slate-900")}>
                                    <FinancialValue>{formatCurrency(tx.product_cost)}</FinancialValue>
                                  </span>
                                </div>
                                {(tx.service_fee || 0) > 0 && (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('service_fee_amount')}</span>
                                    <span className={cn("text-xs font-mono font-bold tabular-nums", theme === 'dark' ? "text-white" : "text-slate-900")}>
                                      <FinancialValue>{formatCurrency(tx.service_fee || 0)}</FinancialValue>
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{t('active_products')}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {parsedProducts.map((p: any, i: number) => (
                                    <div key={i} className={cn(
                                      "flex justify-between items-center p-3.5 rounded-2xl border transition-all",
                                      theme === 'dark' ? "bg-white/5 border-white/5" : "bg-white border-slate-100 shadow-sm"
                                    )}>
                                      <div className="min-w-0 pr-2">
                                        <p className={cn("text-xs font-bold truncate", theme === 'dark' ? "text-white" : "text-slate-900")}>{p.name}</p>
                                        <p className="text-[10px] text-zinc-500 font-mono tabular-nums">{formatCurrency(p.price)}</p>
                                      </div>
                                      <span className="text-[11px] font-black text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-lg tabular-nums shrink-0">×{p.quantity}</span>
                                    </div>
                                  ))}
                                  {parsedProducts.length === 0 && (
                                    <p className="text-xs text-zinc-500 italic">{t('no_products_added')}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {transactions.length > txPage * itemsPerPage && (
          <div className="p-6 border-t flex justify-center">
            <button 
              onClick={() => setTxPage(p => p + 1)}
              className={cn(
                "px-8 py-3 rounded-2xl font-bold text-sm transition-all",
                theme === 'dark' ? "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {t('load_more')} ({transactions.length - (txPage * itemsPerPage)} {t('remaining')})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
