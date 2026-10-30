import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  TrendingUp, 
  Search, 
  Calendar,
  Package,
  DollarSign,
  BarChart3,
  Filter,
  Trash2,
  RefreshCcw,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion } from 'motion/react';
import { apiFetch } from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { formatCurrency, cn, getBakuDateString, convertBakuToUTC } from '../lib/utils';
import ActionPasswordModal from '../components/ActionPasswordModal';
import ReportPasswordModal from '../components/ReportPasswordModal';
import FinancialValue from '../components/FinancialValue';
import { useFinancialVisibility } from '../contexts/FinancialVisibilityContext';
import { toast } from 'sonner';

interface ProductProfitStats {
  id: number;
  name: string;
  stock_left: number;
  original_quantity: number;
  sold_quantity: number;
  purchase_price: number;
  selling_price: number;
  revenue: number;
  profit: number;
}

const InventoryProfit: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isVisible, hide } = useFinancialVisibility();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [stats, setStats] = useState<ProductProfitStats[]>([]);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<'today' | 'this_month' | 'all_time' | 'custom'>('custom');
  const [startDate, setStartDate] = useState(() => getBakuDateString(new Date()));
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return getBakuDateString(tomorrow);
  });
  const [endTime, setEndTime] = useState('09:00');
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      const now = new Date();
      
      if (period === 'today') {
        const today = getBakuDateString(now);
        const utcStart = convertBakuToUTC(today, '00:00');
        const utcEnd = convertBakuToUTC(today, '23:59');
        if (utcStart) params.append('startDate', utcStart);
        if (utcEnd) params.append('endDate', utcEnd.substring(0, 16) + ':59');
      } else if (period === 'this_month') {
        // First and last day of the month in Baku
        const bakuNow = new Date(now.getTime() + (4 * 60 * 60 * 1000));
        const firstDay = new Date(bakuNow.getFullYear(), bakuNow.getMonth(), 1);
        const lastDay = new Date(bakuNow.getFullYear(), bakuNow.getMonth() + 1, 0);
        
        const firstDayStr = firstDay.toISOString().split('T')[0];
        const lastDayStr = lastDay.toISOString().split('T')[0];
        
        const utcStart = convertBakuToUTC(firstDayStr, '00:00');
        const utcEnd = convertBakuToUTC(lastDayStr, '23:59');
        
        if (utcStart) params.append('startDate', utcStart);
        if (utcEnd) params.append('endDate', utcEnd.substring(0, 16) + ':59');
      } else if (period === 'all_time') {
          // No params means all time in backend likely
      } else if (period === 'custom' && startDate && endDate) {
        const utcStart = convertBakuToUTC(startDate, startTime);
        const utcEnd = convertBakuToUTC(endDate, endTime);
        if (utcStart) params.append('startDate', utcStart);
        if (utcEnd) params.append('endDate', utcEnd.substring(0, 16) + ':59');
      }

      const res = await apiFetch(`/api/reports/inventory-profit?${params.toString()}`);
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching profit stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Auto-refresh every minute
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [period, startDate, startTime, endDate, endTime]);

  const filteredStats = stats.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const totals = filteredStats.reduce((acc, curr) => ({
    revenue: acc.revenue + curr.revenue,
    profit: acc.profit + curr.profit,
    spent: acc.spent + (curr.sold_quantity * curr.purchase_price),
    sold: acc.sold + curr.sold_quantity
  }), { revenue: 0, profit: 0, spent: 0, sold: 0 });

  const handleReset = async () => {
    try {
      await apiFetch('/api/reports/inventory-profit/reset', { method: 'POST' });
      toast.success(t('stats_cleared'));
      fetchStats();
      setIsPasswordModalOpen(false);
    } catch (error) {
      toast.error(t('error_update'));
    }
  };

  return (
    <div className="space-y-8">
      <ActionPasswordModal 
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={handleReset}
      />
      <ReportPasswordModal 
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-4xl font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>{t('inventory_profit')}</h1>
          <p className="text-zinc-500 mt-2">{t('manage_reports_desc')}</p>
        </div>
        <div className="flex items-center gap-4">
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
            onClick={() => setIsPasswordModalOpen(true)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all border",
              theme === 'dark' ? "bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20" : "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100"
            )}
          >
            <RefreshCcw className="w-4 h-4" />
            {t('clear')}
          </button>
          <div className={cn(
            "flex items-center gap-2 p-1 rounded-2xl border",
            theme === 'dark' ? "bg-white/[0.03] border-white/[0.05]" : "bg-slate-100/50 border-slate-200"
          )}>
            {(['today', 'this_month', 'all_time', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                  period === p 
                    ? (theme === 'dark' ? "bg-white text-black shadow-lg" : "bg-white text-slate-900 shadow-sm border border-slate-200/50")
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {t(p)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {period === 'custom' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "flex flex-col sm:flex-row items-center gap-4 p-4 rounded-[24px] border transition-colors",
            theme === 'dark' ? "bg-white/[0.02] border-white/[0.05]" : "bg-white border-slate-200 shadow-sm"
          )}
        >
          <div className="flex items-center gap-2 flex-1 w-full">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest min-w-[30px]">{t('from')}</span>
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-xl border w-full",
              theme === 'dark' ? "bg-black/20 border-white/5" : "bg-slate-50 border-slate-200"
            )}>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={cn(
                  "bg-transparent text-xs font-bold focus:outline-none w-full",
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
          <div className="flex items-center gap-2 flex-1 w-full">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest min-w-[30px]">{t('to')}</span>
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-xl border w-full",
              theme === 'dark' ? "bg-black/20 border-white/5" : "bg-slate-50 border-slate-200"
            )}>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={cn(
                  "bg-transparent text-xs font-bold focus:outline-none w-full",
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
          <button 
            onClick={() => {
              setStartDate('');
              setStartTime('00:00');
              setEndDate('');
              setEndTime('23:59');
              setPeriod('all_time');
            }}
            className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
            title={t('clear_filters')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "border p-8 rounded-[32px] relative overflow-hidden group transition-all",
            theme === 'dark' ? "bg-[#0A0A0A] border-white/[0.05]" : "bg-white border-slate-200 shadow-sm"
          )}
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
            <DollarSign className={cn("w-24 h-24", theme === 'dark' ? "text-white" : "text-slate-900")} />
          </div>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">{t('total_revenue')}</p>
          <p className={cn("text-4xl font-bold tracking-tighter", theme === 'dark' ? "text-white" : "text-slate-900")}>
            <FinancialValue>{formatCurrency(totals.revenue)}</FinancialValue>
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "border p-8 rounded-[32px] relative overflow-hidden group transition-all",
            theme === 'dark' ? "bg-[#0A0A0A] border-white/[0.05]" : "bg-white border-slate-200 shadow-sm"
          )}
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
            <BarChart3 className="w-24 h-24 text-rose-500" />
          </div>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">{t('total_spent_money')}</p>
          <p className="text-4xl font-bold text-rose-500 tracking-tighter">
            <FinancialValue>{formatCurrency(totals.spent)}</FinancialValue>
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "border p-8 rounded-[32px] relative overflow-hidden group transition-all",
            theme === 'dark' ? "bg-[#0A0A0A] border-white/[0.05]" : "bg-white border-slate-200 shadow-sm"
          )}
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
            <TrendingUp className="w-24 h-24 text-emerald-500" />
          </div>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">{t('total_profit')}</p>
          <p className="text-4xl font-bold text-emerald-500 tracking-tighter">
            <FinancialValue>{formatCurrency(totals.profit)}</FinancialValue>
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={cn(
            "border p-8 rounded-[32px] relative overflow-hidden group transition-all",
            theme === 'dark' ? "bg-[#0A0A0A] border-white/[0.05]" : "bg-white border-slate-200 shadow-sm"
          )}
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
            <Package className="w-24 h-24 text-blue-500" />
          </div>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">{t('total_sold_items')}</p>
          <p className="text-4xl font-bold text-blue-500 tracking-tighter">{totals.sold}</p>
        </motion.div>
      </div>

      <div className={cn(
        "border rounded-[40px] overflow-hidden shadow-2xl transition-all",
        theme === 'dark' ? "bg-[#0A0A0A] border-white/[0.05]" : "bg-white border-slate-200 shadow-slate-200/50"
      )}>
        <div className={cn(
          "p-8 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors",
          theme === 'dark' ? "border-white/[0.05]" : "border-slate-100 bg-slate-50/50"
        )}>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input 
              type="text"
              placeholder={t('search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-full border rounded-2xl py-3 pl-12 pr-4 transition-all focus:outline-none focus:ring-2",
                theme === 'dark' ? "bg-white/[0.03] border-white/[0.05] text-white placeholder:text-zinc-600 focus:ring-white/10" : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-blue-500/20"
              )}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn(
                "border-b transition-colors",
                theme === 'dark' ? "border-white/[0.05] bg-white/[0.01]" : "border-slate-100 bg-slate-50/50"
              )}>
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{t('name')}</th>
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{t('stock_left')}</th>
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{t('sold_quantity')}</th>
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{t('purchase_price')}</th>
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{t('selling_price')}</th>
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{t('spent_money')}</th>
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{t('revenue')}</th>
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 text-right">{t('profit')}</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", theme === 'dark' ? "divide-white/[0.02]" : "divide-slate-100")}>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-8 py-12 text-center text-zinc-500">
                    <div className="flex items-center justify-center gap-3">
                      <div className={cn(
                        "w-5 h-5 border-2 rounded-full animate-spin",
                        theme === 'dark' ? "border-white/10 border-t-white" : "border-slate-200 border-t-blue-600"
                      )} />
                      {t('loading')}...
                    </div>
                  </td>
                </tr>
              ) : filteredStats.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-8 py-12 text-center text-zinc-500">
                    {t('no_activity')}
                  </td>
                </tr>
              ) : filteredStats.map((item) => (
                <tr key={item.id} className={cn(
                  "border-b transition-colors group",
                  theme === 'dark' ? "border-white/[0.02] hover:bg-white/[0.02]" : "border-slate-100 hover:bg-slate-50"
                )}>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "font-bold transition-colors",
                      theme === 'dark' ? "text-white group-hover:text-blue-400" : "text-slate-900 group-hover:text-blue-600"
                    )}>{item.name}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "px-5 py-2 rounded-2xl flex items-center gap-1.5 border shadow-sm transition-all",
                        item.stock_left === 0 
                          ? (theme === 'dark' ? "bg-rose-500/10 border-rose-500/30 text-rose-500" : "bg-rose-50 border-rose-200 text-rose-600") :
                        item.stock_left <= 5 
                          ? (theme === 'dark' ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-amber-50 border-amber-200 text-amber-600") :
                          (theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600")
                      )}>
                        <span className="text-[15px] font-black tracking-tight tabular-nums">{item.stock_left}</span>
                        {(item.original_quantity || 0) > 0 && (
                          <span className="text-[11px] font-bold opacity-40 tabular-nums">/ {item.original_quantity}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest opacity-60">{t('unit')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-zinc-400 font-medium">{item.sold_quantity}</td>
                  <td className={cn("px-8 py-6 font-mono text-xs", theme === 'dark' ? "text-zinc-500" : "text-slate-500")}>
                    <FinancialValue>{formatCurrency(item.purchase_price)}</FinancialValue>
                  </td>
                  <td className={cn("px-8 py-6 font-mono text-xs", theme === 'dark' ? "text-zinc-500" : "text-slate-500")}>
                    <FinancialValue>{formatCurrency(item.selling_price)}</FinancialValue>
                  </td>
                  <td className="px-8 py-6 text-rose-500 font-mono text-xs">
                    <FinancialValue>{formatCurrency(item.sold_quantity * item.purchase_price)}</FinancialValue>
                  </td>
                  <td className={cn("px-8 py-6 font-mono font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>
                    <FinancialValue>{formatCurrency(item.revenue)}</FinancialValue>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className={cn(
                      "font-mono font-bold",
                      item.profit >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      <FinancialValue>{formatCurrency(item.profit)}</FinancialValue>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryProfit;
