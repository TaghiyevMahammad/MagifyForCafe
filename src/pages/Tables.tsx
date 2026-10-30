import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CheckSquare, Square, X as CloseIcon, ChevronUp, ChevronDown, Receipt, CreditCard } from 'lucide-react';
import TableCard from '../components/TableCard';
import { Table, ActiveSession, Settings } from '../types';
import { useSessions } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';
import AddTableModal from '../components/AddTableModal';
import EditTableModal from '../components/EditTableModal';
import SessionModal from '../components/SessionModal';
import MultiPaymentModal, { SelectedTableDetail } from '../components/MultiPaymentModal';
import ConfirmModal from '../components/ConfirmModal';
import FinancialValue from '../components/FinancialValue';
import { apiFetch } from '../lib/api';
import { cn, formatCurrency } from '../lib/utils';

const Tables: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { sessions, startSession, endSession, loading: sessionsLoading } = useSessions();
  const [tables, setTables] = useState<Table[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tableSize, setTableSize] = useState<'small' | 'medium' | 'large'>(() => {
    return (localStorage.getItem('tableSize') as any) || 'medium';
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [tableToEdit, setTableToEdit] = useState<Table | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);

  // Multi-selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([]);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [isMultiPaymentModalOpen, setIsMultiPaymentModalOpen] = useState(false);

  const fetchTablesAndSettings = useCallback(async () => {
    try {
      const [tablesRes, settingsRes] = await Promise.all([
        apiFetch('/api/tables'),
        apiFetch('/api/settings')
      ]);
      const [tablesData, settingsData] = await Promise.all([
        tablesRes.json(),
        settingsRes.json()
      ]);
      setTables(tablesData);
      setSettings(settingsData);
    } catch (error) {
      toast.error(t('error_update'));
    }
  }, [t]);

  useEffect(() => {
    fetchTablesAndSettings();
  }, [fetchTablesAndSettings]);

  const serviceFeePercent = parseFloat(settings?.service_fee || '0') || 0;

  const toggleTableSelection = useCallback((tableId: number) => {
    setSelectedTableIds(prev => 
      prev.includes(tableId) ? prev.filter(id => id !== tableId) : [...prev, tableId]
    );
  }, []);

  const handleTableClick = useCallback((e: React.MouseEvent, table: Table) => {
    if (isSelectionMode || e?.shiftKey || e?.ctrlKey || e?.metaKey || selectedTableIds.length > 0) {
      toggleTableSelection(table.id);
    } else {
      setSelectedTable(table);
      setIsSessionModalOpen(true);
    }
  }, [isSelectionMode, selectedTableIds.length, toggleTableSelection]);

  const handleStartSession = useCallback(async (_tableId: number, session: ActiveSession) => {
    try {
      await startSession(session);
      setIsSessionModalOpen(true);
      toast.success(t('success_add'));
    } catch (error) {
      toast.error(t('error_add'));
    }
  }, [startSession, t]);

  const handleEndSession = useCallback(async (tableId: number, transactionData: any) => {
    try {
      const res = await apiFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData)
      });
      
      if (res.ok) {
        await endSession(tableId);
        setIsSessionModalOpen(false);
        toast.success(t('success_update'));
      }
    } catch (error) {
      toast.error(t('error_update'));
    }
  }, [endSession, t]);

  const handleEditClick = useCallback((e: React.MouseEvent, table: Table) => {
    e.stopPropagation();
    setTableToEdit(table);
    setIsEditModalOpen(true);
  }, []);

  const handleDeleteClick = useCallback((e: React.MouseEvent, table: Table) => {
    e.stopPropagation();
    if (sessions[table.id]) {
      toast.error(t('error_delete'));
      return;
    }
    setTableToDelete(table);
    setIsDeleteModalOpen(true);
  }, [sessions, t]);

  const handleSelectAll = () => {
    setSelectedTableIds(tables.map(t => t.id));
  };

  const handleClearSelection = () => {
    setSelectedTableIds([]);
    setIsSelectionMode(false);
  };

  const handleBatchEndAndBill = useCallback(async (
    paymentData: {
      payment_type: 'cash' | 'card' | 'mixed' | 'unpaid';
      cash_amount: number;
      card_amount: number;
    },
    activeItems: SelectedTableDetail[]
  ) => {
    const totalGrand = activeItems.reduce((acc, item) => acc + item.finalPayable, 0);
    let remainingCash = paymentData.cash_amount;

    for (let i = 0; i < activeItems.length; i++) {
      const item = activeItems[i];
      if (!item.session) continue;
      const isLast = i === activeItems.length - 1;
      let txCash = 0;
      let txCard = 0;

      if (paymentData.payment_type === 'cash') {
        txCash = item.finalPayable;
        txCard = 0;
      } else if (paymentData.payment_type === 'card') {
        txCash = 0;
        txCard = item.finalPayable;
      } else if (paymentData.payment_type === 'unpaid') {
        txCash = 0;
        txCard = 0;
      } else {
        if (isLast) {
          txCash = Math.max(0, Math.min(item.finalPayable, remainingCash));
          txCard = Math.max(0, item.finalPayable - txCash);
        } else {
          const ratio = totalGrand > 0 ? (item.finalPayable / totalGrand) : 0;
          txCash = Math.min(item.finalPayable, Math.round(paymentData.cash_amount * ratio * 100) / 100);
          txCard = Math.max(0, item.finalPayable - txCash);
          remainingCash -= txCash;
        }
      }

      const txPayload = {
        table_id: item.table.id,
        table_name: item.table.name,
        start_time: new Date(item.session.startTime).toISOString(),
        end_time: new Date().toISOString(),
        product_cost: item.productCost,
        service_fee: item.serviceFee,
        total_cost: item.finalPayable,
        products_json: JSON.stringify(item.session.products || []),
        payment_type: paymentData.payment_type,
        cash_amount: txCash,
        card_amount: txCard
      };

      const res = await apiFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txPayload)
      });

      if (res.ok) {
        await endSession(item.table.id);
      }
    }

    toast.success(t('batch_checkout_success'));
    setSelectedTableIds([]);
    setIsSelectionMode(false);
  }, [endSession, t]);

  const handleSizeChange = (size: 'small' | 'medium' | 'large') => {
    setTableSize(size);
    localStorage.setItem('tableSize', size);
  };

  const getGridClass = () => {
    switch (tableSize) {
      case 'small': return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4";
      case 'large': return "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8";
      default: return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6";
    }
  };

  const confirmDelete = async () => {
    if (!tableToDelete) return;
    try {
      const res = await apiFetch(`/api/tables/${tableToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setTables(prev => prev.filter(t => t.id !== tableToDelete.id));
        toast.success(t('success_delete'));
        setIsDeleteModalOpen(false);
        setTableToDelete(null);
      } else {
        toast.error(t('error_delete'));
      }
    } catch (error) {
      toast.error(t('error_delete'));
    }
  };

  const kabinetler = tables.filter(t => t.type === 'kabinet');
  const standardTables = tables.filter(t => t.type === 'table');

  const selectedTables = tables.filter(t => selectedTableIds.includes(t.id));
  const selectedActiveCount = selectedTables.filter(t => !!sessions[t.id]).length;
  const selectedAvailableCount = selectedTables.length - selectedActiveCount;

  const selectedTablesWithDetails = useMemo<SelectedTableDetail[]>(() => {
    return selectedTableIds.map(id => {
      const table = tables.find(t => t.id === id);
      const session = sessions[id];
      if (!table) return null;

      if (!session) {
        return {
          table,
          session: null,
          productCost: 0,
          serviceFee: 0,
          total: 0,
          finalPayable: 0,
          itemCount: 0,
          isActive: false
        };
      }

      const productCost = (session.products || []).reduce((acc, p) => acc + (p.price * p.quantity), 0);
      const itemCount = (session.products || []).reduce((acc, p) => acc + p.quantity, 0);
      const serviceFee = Math.round(productCost * (serviceFeePercent / 100) * 100) / 100;
      const total = Math.round((productCost + serviceFee) * 100) / 100;
      let finalPayable = total;

      if (session.billingMode === 'depozit' && session.depositAmount) {
        finalPayable = Math.max(total, session.depositAmount);
      }

      return {
        table,
        session,
        productCost,
        serviceFee,
        total,
        finalPayable,
        itemCount,
        isActive: true
      };
    }).filter(Boolean) as SelectedTableDetail[];
  }, [selectedTableIds, tables, sessions, serviceFeePercent]);

  const totalCommonBill = useMemo(() => {
    return selectedTablesWithDetails.reduce((acc, item) => acc + item.finalPayable, 0);
  }, [selectedTablesWithDetails]);

  if (sessionsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-12 font-sans pb-20">
      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        title={t('delete')}
        message={t('confirm_delete_table')}
        onConfirm={confirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
        <div className="space-y-1">
          <h1 className={cn(
            "text-3xl sm:text-4xl font-bold tracking-tighter",
            theme === 'dark' ? "text-white" : "text-slate-900"
          )}>{t('tables')}</h1>
          <p className="text-sm sm:text-base text-zinc-500 font-medium">{t('manage_tables_desc')}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <button
            onClick={() => {
              if (isSelectionMode && selectedTableIds.length > 0) {
                handleClearSelection();
              } else {
                setIsSelectionMode(!isSelectionMode);
              }
            }}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border",
              isSelectionMode || selectedTableIds.length > 0
                ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/30"
                : (theme === 'dark' ? "bg-white/5 border-white/10 text-zinc-300 hover:text-white hover:bg-white/10" : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200")
            )}
          >
            {isSelectionMode || selectedTableIds.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-white" />
            ) : (
              <Square className="w-4 h-4 text-zinc-400" />
            )}
            <span>{t('multi_select')}</span>
          </button>

          <div className={cn(
            "flex items-center gap-2 p-1 rounded-2xl border w-full sm:w-auto",
            theme === 'dark' ? "bg-white/5 border-white/5" : "bg-slate-100 border-slate-200"
          )}>
            {(['small', 'medium', 'large'] as const).map((size) => (
              <button
                key={size}
                onClick={() => handleSizeChange(size)}
                className={cn(
                  "flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors duration-150",
                  tableSize === size 
                    ? theme === 'dark' ? "bg-white text-black" : "bg-white text-slate-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {t(size)}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className={cn(
              "flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-colors duration-150 w-full sm:w-auto",
              theme === 'dark' 
                ? "bg-white text-black hover:bg-zinc-200" 
                : "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
            )}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            {t('add_table')}
          </button>
        </div>
      </header>

      <div className="space-y-16">
        {kabinetler.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className={cn(
                "w-1.5 h-8 rounded-full",
                theme === 'dark' ? "bg-amber-500" : "bg-amber-600"
              )} />
              <h2 className={cn(
                "text-2xl font-bold tracking-tight",
                theme === 'dark' ? "text-white" : "text-slate-900"
              )}>{t('kabinetler')}</h2>
            </div>
            <div className={getGridClass()}>
              {kabinetler.map(table => (
                <TableCard 
                  key={table.id} 
                  table={table} 
                  size={tableSize}
                  session={sessions[table.id]}
                  serviceFeePercent={serviceFeePercent}
                  isSelected={selectedTableIds.includes(table.id)}
                  onClick={(e: any) => handleTableClick(e, table)}
                  onEdit={(e) => handleEditClick(e, table)}
                  onDelete={(e) => handleDeleteClick(e, table)}
                />
              ))}
            </div>
          </section>
        )}

        {standardTables.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className={cn(
                "w-1.5 h-8 rounded-full",
                theme === 'dark' ? "bg-blue-500" : "bg-blue-600"
              )} />
              <h2 className={cn(
                "text-2xl font-bold tracking-tight",
                theme === 'dark' ? "text-white" : "text-slate-900"
              )}>{t('standard_tables')}</h2>
            </div>
            <div className={getGridClass()}>
              {standardTables.map(table => (
                <TableCard 
                  key={table.id} 
                  table={table} 
                  size={tableSize}
                  session={sessions[table.id]}
                  serviceFeePercent={serviceFeePercent}
                  isSelected={selectedTableIds.includes(table.id)}
                  onClick={(e: any) => handleTableClick(e, table)}
                  onEdit={(e) => handleEditClick(e, table)}
                  onDelete={(e) => handleDeleteClick(e, table)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Multi-Selection Dock Toolbar with Combined Bill */}
      {selectedTableIds.length > 0 && (
        <div className="fixed bottom-3 sm:bottom-6 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-40 w-auto max-w-[96vw] xl:max-w-5xl">
          {isDetailsExpanded && (
            <div className={cn(
              "mb-2.5 sm:mb-3 p-3.5 sm:p-4 rounded-2xl border shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200 max-h-60 sm:max-h-72 overflow-y-auto",
              theme === 'dark'
                ? "bg-[#141417]/95 border-white/10 text-white"
                : "bg-white/95 border-slate-200 text-slate-900 shadow-slate-300"
            )}>
              <div className={cn(
                "flex items-center justify-between pb-2.5 mb-2.5 border-b",
                theme === 'dark' ? "border-white/10" : "border-slate-200"
              )}>
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-500 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">{t('individual_bills')}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-500 font-bold tabular-nums">
                    {selectedTablesWithDetails.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {selectedActiveCount > 0 && (
                    <button
                      onClick={() => setIsMultiPaymentModalOpen(true)}
                      className="flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      <CreditCard className="w-3 h-3" />
                      <span>{t('end_and_bill_together')}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsDetailsExpanded(false)}
                    className="text-xs text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
                  >
                    <CloseIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5">
                {selectedTablesWithDetails.map(item => (
                  <div
                    key={item.table.id}
                    className={cn(
                      "p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between transition-all",
                      theme === 'dark' ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-bold text-xs truncate">{item.table.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate">
                          {item.table.type === 'kabinet' ? t('kabinet') : t('table')}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTableSelection(item.table.id);
                        }}
                        className="text-zinc-500 hover:text-rose-400 p-0.5 rounded transition-colors shrink-0"
                        title={t('cancel')}
                      >
                        <CloseIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className={cn(
                      "flex items-end justify-between pt-2 border-t",
                      theme === 'dark' ? "border-white/5" : "border-slate-200"
                    )}>
                      <div className="text-[10px] text-zinc-400 tabular-nums">
                        {item.isActive ? (
                          <span>{item.itemCount} {t('items_count')}</span>
                        ) : (
                          <span className="text-emerald-500 font-medium">{t('free_table')}</span>
                        )}
                      </div>
                      <div className="text-right shrink-0 pl-1">
                        <span className="text-xs font-black font-mono text-emerald-500 tabular-nums">
                          {item.isActive ? (
                            <FinancialValue>{formatCurrency(item.finalPayable)}</FinancialValue>
                          ) : (
                            formatCurrency(0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={cn(
            "p-2.5 sm:px-4 sm:py-3 rounded-2xl border shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 md:gap-4",
            theme === 'dark' 
              ? "bg-[#18181b]/95 border-white/15 text-white" 
              : "bg-white/95 border-slate-200 text-slate-900 shadow-slate-300"
          )}>
            <div className="flex items-center justify-between md:justify-start gap-2.5 sm:gap-3 shrink-0">
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs shadow-sm shadow-blue-600/30 tabular-nums">
                  {selectedTableIds.length}
                </span>
                <div className="text-xs">
                  <p className="font-bold whitespace-nowrap leading-tight">
                    {selectedTableIds.length} {t('selected_tables_count')}
                  </p>
                  <p className="text-[10px] text-zinc-400 whitespace-nowrap leading-tight tabular-nums">
                    {selectedActiveCount} {t('active')}, {selectedAvailableCount} {t('free_table')}
                  </p>
                </div>
              </div>

              <button
                onClick={handleClearSelection}
                className="md:hidden p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title={t('clear_selection')}
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className={cn(
              "flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl border shrink-0",
              theme === 'dark' ? "bg-emerald-950/30 border-emerald-500/30" : "bg-emerald-50 border-emerald-200"
            )}>
              <div className="flex items-center gap-2">
                <div className="p-1 sm:p-1.5 rounded-lg bg-emerald-500/20 text-emerald-500 shrink-0">
                  <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-black text-emerald-500 leading-tight">
                    {t('common_bill')}
                  </p>
                  <p className="text-sm sm:text-base font-black font-mono tracking-tight text-emerald-500 leading-tight tabular-nums">
                    <FinancialValue>{formatCurrency(totalCommonBill)}</FinancialValue>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-500 hover:text-emerald-400 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors cursor-pointer whitespace-nowrap ml-1"
                title={isDetailsExpanded ? t('hide_details') : t('view_details')}
              >
                <span>{isDetailsExpanded ? t('hide_details') : t('individual_bills')}</span>
                {isDetailsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-1.5">
              <button
                onClick={() => {
                  if (selectedActiveCount === 0) {
                    toast.error(t('no_active_sessions_to_bill'));
                    return;
                  }
                  setIsMultiPaymentModalOpen(true);
                }}
                disabled={selectedActiveCount === 0}
                className={cn(
                  "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                  selectedActiveCount > 0
                    ? "bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/30"
                    : "bg-zinc-700 opacity-60 cursor-not-allowed"
                )}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{t('end_and_bill_together')}</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSelectAll}
                  className={cn(
                    "px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap",
                    theme === 'dark' ? "bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300" : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700"
                  )}
                >
                  {t('select_all')}
                </button>

                <button
                  onClick={handleClearSelection}
                  className="hidden md:flex p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title={t('clear_selection')}
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <AddTableModal 
          onClose={() => setIsAddModalOpen(false)} 
          onSuccess={fetchTablesAndSettings} 
        />
      )}

      {isEditModalOpen && tableToEdit && (
        <EditTableModal 
          table={tableToEdit}
          onClose={() => setIsEditModalOpen(false)} 
          onSuccess={fetchTablesAndSettings} 
        />
      )}

      {isSessionModalOpen && selectedTable && (
        <SessionModal 
          table={selectedTable}
          session={sessions[selectedTable.id]}
          onClose={() => {
            setIsSessionModalOpen(false);
          }}
          onStart={(session) => handleStartSession(selectedTable.id, session)}
          onEnd={(tx) => handleEndSession(selectedTable.id, tx)}
        />
      )}

      {isMultiPaymentModalOpen && (
        <MultiPaymentModal 
          items={selectedTablesWithDetails}
          onClose={() => setIsMultiPaymentModalOpen(false)}
          onConfirm={handleBatchEndAndBill}
        />
      )}
    </div>
  );
};

export default Tables;
