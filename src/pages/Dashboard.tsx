import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { 
  TrendingUp, 
  BarChart3 as BarChartIcon, 
  UtensilsCrossed,
  Activity,
  Zap,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { formatCurrency, cn, formatDateTime } from '@/src/lib/utils';
import { apiFetch } from '../lib/api';
import { useFinancialVisibility } from '../contexts/FinancialVisibilityContext';
import FinancialValue from '../components/FinancialValue';
import ReportPasswordModal from '../components/ReportPasswordModal';

const StatCard = React.memo(({ title, value, cash, card, icon: Icon, isCurrency = true, theme, t }: any) => (
  <div 
    className={cn(
      "p-6 rounded-2xl shadow-sm transition-colors border",
      theme === 'dark' ? "bg-[#141414] border-white/5 hover:border-white/10" : "bg-white border-slate-100 hover:border-blue-100"
    )}
  >
    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className={cn(
        "p-3 border rounded-xl transition-colors duration-200",
        theme === 'dark' ? "bg-white/[0.03] border-white/[0.05]" : "bg-blue-50/50 border-blue-100"
      )}>
        <Icon className={cn("w-5 h-5", theme === 'dark' ? "text-white" : "text-blue-600")} />
      </div>
    </div>
    <div className="relative z-10">
      <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.1em] mb-1">{title}</h3>
      <p className={cn(
        "text-2xl font-black tracking-tighter mb-3 tabular-nums",
        theme === 'dark' ? "text-white" : "text-slate-900"
      )}>
        {isCurrency ? (
          <FinancialValue>{formatCurrency(value)}</FinancialValue>
        ) : value}
      </p>
      
      {cash !== undefined && card !== undefined && (cash > 0 || card > 0) && (
        <div className={cn(
          "flex items-center gap-4 pt-3 border-t",
          theme === 'dark' ? "border-white/5" : "border-slate-100"
        )}>
          {cash > 0 && (
            <div className="flex flex-col">
              <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-0.5">{t('cash')}</span>
              <span className={cn(
                "text-xs font-bold tracking-tight",
                theme === 'dark' ? "text-emerald-500/80" : "text-emerald-600"
              )}>
                <FinancialValue>{formatCurrency(cash)}</FinancialValue>
              </span>
            </div>
          )}
          {card > 0 && (
            <div className="flex flex-col">
              <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-0.5">{t('card')}</span>
              <span className={cn(
                "text-xs font-bold tracking-tight",
                theme === 'dark' ? "text-blue-500/80" : "text-blue-600"
              )}>
                <FinancialValue>{formatCurrency(card)}</FinancialValue>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
));

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { isVisible, hide } = useFinancialVisibility();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [summary, setSummary] = useState({ 
    daily: 0, dailyCash: 0, dailyCard: 0,
    monthly: 0, monthlyCash: 0, monthlyCard: 0,
    total: 0, totalCash: 0, totalCard: 0,
    chartData: [] 
  });
  const [transactions, setTransactions] = useState([]);
  const [activeTablesCount, setActiveTablesCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const summaryRes = await apiFetch('/api/reports/summary');
        const summaryData = await summaryRes.json();
        setSummary(summaryData);

        const txRes = await apiFetch('/api/transactions?reportType=main');
        const txData = await txRes.json();
        setTransactions(txData.slice(0, 5));

        const activeRes = await apiFetch('/api/active_sessions');
        const activeData = await activeRes.json();
        setActiveTablesCount(activeData.length);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchData();
    // Refresh every minute
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const chartData = summary.chartData.map((d: any) => {
    const date = new Date(d.date);
    return {
      name: date.toLocaleDateString('az-AZ', { 
        timeZone: 'Asia/Baku',
        weekday: 'short' 
      }),
      revenue: d.revenue
    };
  });

  return (
    <div className="space-y-10 font-sans">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className={cn(
            "text-3xl font-bold tracking-tighter mb-1",
            theme === 'dark' ? "text-white" : "text-slate-900"
          )}>{t('welcome_back')}, Admin</h1>
          <p className="text-zinc-500 font-medium">{t('manage_club')}.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => isVisible ? hide() : setIsReportModalOpen(true)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
              isVisible 
                ? (theme === 'dark' ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20" : "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100") 
                : (theme === 'dark' ? "bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20" : "bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100")
            )}
          >
            {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {isVisible ? t('hide') : t('reveal')}
          </button>
          <div className={cn(
            "flex items-center gap-3 border px-4 py-2 rounded-xl transition-all",
            theme === 'dark' ? "bg-white/[0.03] border-white/[0.05]" : "bg-white border-slate-100 shadow-sm"
          )}>
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t('system_live')}</span>
          </div>
        </div>
      </header>

      {isReportModalOpen && (
        <ReportPasswordModal 
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title={t('revenue_daily')} 
          value={summary.daily} 
          cash={summary.dailyCash}
          card={summary.dailyCard}
          icon={Zap}
          theme={theme}
          t={t}
        />
        <StatCard 
          title={t('revenue_monthly')} 
          value={summary.monthly} 
          cash={summary.monthlyCash}
          card={summary.monthlyCard}
          icon={TrendingUp}
          theme={theme}
          t={t}
        />
        <StatCard 
          title={t('revenue_total')} 
          value={summary.total} 
          cash={summary.totalCash}
          card={summary.totalCard}
          icon={BarChartIcon}
          theme={theme}
          t={t}
        />
        <StatCard 
          title={t('active_tables')} 
          value={activeTablesCount} 
          icon={Activity}
          isCurrency={false}
          theme={theme}
          t={t}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div 
          className={cn(
            "xl:col-span-2 border p-8 rounded-3xl shadow-sm transition-all duration-200",
            theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-100 shadow-slate-200/50"
          )}
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className={cn(
              "text-lg font-bold tracking-tight",
              theme === 'dark' ? "text-white" : "text-slate-900"
            )}>{t('revenue_analytics')}</h3>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? "#ffffff" : "#000000"} strokeOpacity={0.03} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#52525b" 
                  fontSize={10} 
                  fontWeight={600}
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                />
                <YAxis 
                  stroke="#52525b" 
                  fontSize={10} 
                  fontWeight={600}
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `₼${value}`}
                />
                <Tooltip 
                  isAnimationActive={false}
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#141414' : '#ffffff', 
                    border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)', 
                    borderRadius: '12px', 
                    padding: '8px 12px',
                  }}
                  itemStyle={{ color: theme === 'dark' ? '#fff' : '#0f172a', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke={theme === 'dark' ? "#ffffff" : "#2563eb"}
                  strokeWidth={2}
                  fillOpacity={0.1} 
                  fill={theme === 'dark' ? "#ffffff" : "#2563eb"}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div 
          className={cn(
            "border p-8 rounded-3xl shadow-sm flex flex-col transition-all duration-200",
            theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-100 shadow-slate-200/50"
          )}
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className={cn(
              "text-lg font-bold tracking-tight",
              theme === 'dark' ? "text-white" : "text-slate-900"
            )}>{t('recent_activity')}</h3>
            <button 
              onClick={() => navigate('/reports')}
              className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-blue-500 transition-colors"
            >
              {t('view_all')}
            </button>
          </div>
          <div className="space-y-5 flex-1">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-zinc-600">
                <Activity className="w-10 h-10 mb-4 opacity-10" />
                <p className="text-sm font-medium">{t('no_activity')}</p>
              </div>
            ) : (
              transactions.map((tx: any) => {
                let itemCount = 0;
                try {
                  itemCount = JSON.parse(tx.products_json || '[]').reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
                } catch {}
                return (
                  <div 
                    key={tx.id} 
                    onClick={() => navigate('/reports')}
                    className="flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 border rounded-xl flex items-center justify-center transition-all",
                        theme === 'dark' ? "bg-white/[0.03] border-white/[0.05] group-hover:bg-white/[0.08]" : "bg-slate-50 border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100"
                      )}>
                        <UtensilsCrossed className={cn(
                          "w-4 h-4 transition-colors",
                          theme === 'dark' ? "text-zinc-400 group-hover:text-white" : "text-slate-400 group-hover:text-blue-600"
                        )} />
                      </div>
                      <div>
                        <p className={cn(
                          "text-xs font-bold transition-colors",
                          theme === 'dark' ? "text-white group-hover:text-blue-400" : "text-slate-900 group-hover:text-blue-600"
                        )}>{tx.table_name}</p>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider tabular-nums">
                          {itemCount} {t('items_count')} • {tx.payment_type === 'unpaid' ? t('unpaid_closed') : t(tx.payment_type || 'cash')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-xs font-bold tabular-nums",
                        theme === 'dark' ? "text-white" : "text-slate-900"
                      )}>
                        <FinancialValue>{formatCurrency(tx.total_cost)}</FinancialValue>
                      </p>
                      <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-tighter tabular-nums">
                        {formatDateTime(tx.created_at).split(' ')[1]}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
