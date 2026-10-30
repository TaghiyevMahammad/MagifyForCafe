import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Plus, 
  Minus, 
  ShoppingCart, 
  UtensilsCrossed,
  Crown,
  Receipt,
  Layers,
  CheckCircle2,
  Search,
  FileText,
  Trash2,
  Bell,
  BellOff,
  RotateCcw
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { Table, ActiveSession, Product, SessionProduct, Settings, InventoryItem, ProductSet } from '../types';
import { useSessions, formatCountdownMs } from '../contexts/SessionContext';
import { formatCurrency, cn, formatDateTime } from '../lib/utils';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';

import PaymentModal from './PaymentModal';

interface SessionModalProps {
  table: Table;
  session?: ActiveSession;
  onClose: () => void;
  onStart: (session: ActiveSession) => void;
  onEnd: (transaction: any) => void;
}

const SessionModal: React.FC<SessionModalProps> = ({ 
  table, 
  session, 
  onClose, 
  onStart, 
  onEnd
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { updateSession, endSession, now, reminderConfig, restartReminder, stopReminder } = useSessions();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allSets, setAllSets] = useState<ProductSet[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [productTab, setProductTab] = useState<'products' | 'sets'>('products');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const [billingMode, setBillingMode] = useState<'adi' | 'depozit'>('adi');
  const [depositAmount, setDepositAmount] = useState<number>(30);
  const [isAlreadyPaid, setIsAlreadyPaid] = useState<boolean>(false);
  const [activateReminder, setActivateReminder] = useState<boolean>(false);
  const [guestNote, setGuestNote] = useState<string>(session?.guestNote || '');

  useEffect(() => {
    setGuestNote(session?.guestNote || '');
  }, [session?.guestNote]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pRes, sRes, iRes, setRes] = await Promise.all([
          apiFetch('/api/products'),
          apiFetch('/api/product_sets'),
          apiFetch('/api/inventory'),
          apiFetch('/api/settings')
        ]);
        const [productsData, setsData, inventoryData, settingsData] = await Promise.all([
          pRes.json(),
          sRes.json(),
          iRes.json(),
          setRes.json()
        ]);

        setAllProducts(productsData);
        setAllSets(setsData);
        setInventory(inventoryData);
        setSettings(settingsData);
      } catch (error) {
        console.error('Error fetching menu data:', error);
      }
    };
    fetchData();
  }, []);

  const configuredMinutes = useMemo(() => {
    const fromSettings = parseInt(settings?.reminder_minutes || '', 10);
    if (!isNaN(fromSettings) && fromSettings > 0) return fromSettings;
    return reminderConfig.minutes || 40;
  }, [settings?.reminder_minutes, reminderConfig.minutes]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean)));
    return unique;
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    return allProducts.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesSearch = !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allProducts, selectedCategory, searchQuery]);

  const filteredSets = useMemo(() => {
    return allSets.filter(s => {
      return !searchQuery.trim() || s.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [allSets, searchQuery]);

  const handleStart = () => {
    const openedAt = Date.now();
    const newSession: ActiveSession = {
      tableId: table.id,
      startTime: openedAt,
      products: [],
      billingMode,
      depositAmount: billingMode === 'depozit' ? Math.max(0, depositAmount || 0) : undefined,
      isAlreadyPaid,
      guestNote: guestNote.trim() || undefined,
      reminderEnabled: activateReminder,
      reminderMinutes: activateReminder ? configuredMinutes : 0,
      reminderEndTime: activateReminder ? openedAt + configuredMinutes * 60 * 1000 : 0,
      reminderNotified: false
    };
    onStart(newSession);
  };

  const handleCloseEmptyTable = async () => {
    if (!session) return;
    await endSession(table.id);
    toast.info(t('empty_table_closed'));
    onClose();
  };

  const checkStock = (productId: number, isSet: boolean, quantity: number = 1): boolean => {
    if (isSet) {
      const set = allSets.find(s => s.id === productId);
      if (!set) return false;
      for (const item of set.items) {
        const invItem = inventory.find(i => i.id === item.inventory_id);
        if (invItem && !invItem.is_stockless && invItem.stock_quantity < item.quantity_required * quantity) {
          toast.error(`${t('insufficient_stock')}: ${item.inventory_name}`);
          return false;
        }
      }
    } else {
      const product = allProducts.find(p => p.id === productId);
      if (product?.inventory_id) {
        const invItem = inventory.find(i => i.id === product.inventory_id);
        if (invItem && !invItem.is_stockless && invItem.stock_quantity < quantity) {
          toast.error(t('insufficient_stock'));
          return false;
        }
      }
    }
    return true;
  };

  const addProductToSession = (product: Product) => {
    if (!session) return;

    const existing = session.products.find(p => p.id === product.id && !p.is_set);
    const currentQty = existing ? existing.quantity : 0;

    if (!checkStock(product.id, false, currentQty + 1)) return;

    const newProducts = existing
      ? session.products.map(p =>
          (p.id === product.id && !p.is_set) ? { ...p, quantity: p.quantity + 1 } : p
        )
      : [...session.products, { ...product, quantity: 1, is_set: false }];

    updateSession({ ...session, products: newProducts });
  };

  const addSetToSession = (set: ProductSet) => {
    if (!session) return;

    const existing = session.products.find(p => p.set_id === set.id && p.is_set);
    const currentQty = existing ? existing.quantity : 0;

    if (!checkStock(set.id, true, currentQty + 1)) return;

    let newProducts: SessionProduct[];
    if (existing) {
      newProducts = session.products.map(p =>
        (p.set_id === set.id && p.is_set) ? { ...p, quantity: p.quantity + 1 } : p
      );
    } else {
      const setAsProduct: SessionProduct = {
        id: -set.id,
        name: set.name,
        price: set.total_price,
        category: 'Kombo Set',
        quantity: 1,
        is_set: true,
        set_id: set.id
      };
      newProducts = [...session.products, setAsProduct];
    }
    updateSession({ ...session, products: newProducts });
  };

  const removeProductFromSession = (productId: number, isSet: boolean) => {
    if (!session) return;
    const existing = session.products.find(p => isSet ? p.set_id === productId : (p.id === productId && !p.is_set));
    if (!existing) return;

    const newProducts = existing.quantity > 1
      ? session.products.map(p =>
          (isSet ? p.set_id === productId : (p.id === productId && !p.is_set)) ? { ...p, quantity: p.quantity - 1 } : p
        )
      : session.products.filter(p => !(isSet ? p.set_id === productId : (p.id === productId && !p.is_set)));

    updateSession({ ...session, products: newProducts });
  };

  const handleSaveNote = async () => {
    if (!session) return;
    if ((session.guestNote || '') === guestNote.trim()) return;
    await updateSession({ ...session, guestNote: guestNote.trim() || undefined });
  };

  const serviceFeePercent = parseFloat(settings?.service_fee || '0') || 0;

  const calculateCosts = () => {
    if (!session) return { productCost: 0, serviceFee: 0, total: 0, finalPayable: 0 };

    const productCost = session.products.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    const serviceFee = Math.round(productCost * (serviceFeePercent / 100) * 100) / 100;
    const total = Math.round((productCost + serviceFee) * 100) / 100;
    let finalPayable = total;

    if (session.billingMode === 'depozit' && session.depositAmount) {
      finalPayable = Math.max(total, session.depositAmount);
    }

    return {
      productCost,
      serviceFee,
      total,
      finalPayable
    };
  };

  const confirmEnd = (paymentData: any) => {
    const { productCost, serviceFee, finalPayable } = calculateCosts();
    const transaction = {
      table_id: table.id,
      table_name: table.name,
      start_time: new Date(session!.startTime).toISOString(),
      end_time: new Date().toISOString(),
      product_cost: productCost,
      service_fee: serviceFee,
      total_cost: finalPayable,
      products_json: JSON.stringify(session?.products || []),
      ...paymentData
    };
    onEnd(transaction);
    setIsPaymentModalOpen(false);
  };

  const { productCost, serviceFee, total, finalPayable } = calculateCosts();
  const HeaderIcon = table.type === 'kabinet' ? Crown : UtensilsCrossed;

  const remainingMs = session?.reminderEnabled && session?.reminderEndTime
    ? Math.max(0, session.reminderEndTime - now)
    : 0;
  const isReminderExpired = !!(session?.reminderEnabled && session?.reminderEndTime && remainingMs === 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
      {isPaymentModalOpen && (
        <PaymentModal 
          total={finalPayable}
          usageTotal={total}
          billingMode={session?.billingMode}
          depositAmount={session?.depositAmount}
          onClose={() => setIsPaymentModalOpen(false)}
          onConfirm={confirmEnd}
        />
      )}
      <div className={cn(
        "w-full rounded-3xl overflow-hidden shadow-xl flex flex-col max-h-[90vh] border transition-colors duration-200",
        session ? "max-w-5xl" : "max-w-lg",
        theme === 'dark' ? "bg-[#0A0A0A] border-white/10" : "bg-white border-slate-200"
      )}>
        <div className={cn(
          "p-6 border-b flex justify-between items-center",
          theme === 'dark' ? "border-white/5 bg-white/[0.03]" : "border-slate-100 bg-slate-50"
        )}>
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
              table.type === 'kabinet'
                ? (theme === 'dark' ? "bg-amber-500/20 text-amber-500" : "bg-amber-500/10 text-amber-600")
                : (theme === 'dark' ? "bg-blue-600/20 text-blue-500" : "bg-blue-600/10 text-blue-600")
            )}>
              <HeaderIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className={cn(
                "text-xl font-bold tracking-tight",
                theme === 'dark' ? "text-white" : "text-slate-900"
              )}>{table.name}</h2>
              <p className="text-xs font-medium text-zinc-500">
                {table.type === 'kabinet' ? t('vip_kabinet') : t('standard')}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className={cn(
              "p-2 rounded-full transition-colors cursor-pointer",
              theme === 'dark' ? "hover:bg-white/10 text-zinc-400 hover:text-white" : "hover:bg-slate-200 text-slate-400 hover:text-slate-900"
            )}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-4 sm:gap-6">
          {!session ? (
            <div className="flex-1 space-y-5">
              {/* Billing Mode Selector */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-semibold text-zinc-500">{t('select_mode')}</h3>
                <div className={cn(
                  "flex p-1 rounded-xl border transition-colors",
                  theme === 'dark' ? "bg-white/5 border-white/5" : "bg-slate-100 border-slate-200"
                )}>
                  <button 
                    type="button"
                    onClick={() => setBillingMode('adi')}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl font-bold text-xs transition-colors duration-150 cursor-pointer",
                      billingMode === 'adi' 
                        ? (theme === 'dark' ? "bg-white text-black" : "bg-white text-slate-900 shadow-sm") 
                        : "text-zinc-500"
                    )}
                  >
                    {t('adi')}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setBillingMode('depozit')}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl font-bold text-xs transition-colors duration-150 cursor-pointer",
                      billingMode === 'depozit' 
                        ? (theme === 'dark' ? "bg-white text-black" : "bg-white text-slate-900 shadow-sm") 
                        : "text-zinc-500"
                    )}
                  >
                    {t('depozit')}
                  </button>
                </div>

                {billingMode === 'depozit' && (
                  <div className={cn(
                    "p-4 rounded-xl flex items-center justify-between border transition-colors",
                    theme === 'dark' ? "bg-amber-500/10 border-amber-500/20 text-white" : "bg-amber-50 border-amber-200 text-slate-900"
                  )}>
                    <span className="text-sm font-bold">{t('min_payment')}</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="0"
                        step="1"
                        value={isNaN(depositAmount) ? '' : depositAmount}
                        onChange={(e) => setDepositAmount(Number(e.target.value))}
                        className={cn(
                          "w-24 rounded-lg px-3 py-1.5 text-right font-mono font-bold tabular-nums focus:outline-none focus:border-amber-500 border transition-all",
                          theme === 'dark' 
                            ? "bg-black/40 border-white/10 text-white" 
                            : "bg-white border-slate-200 text-slate-900"
                        )}
                      />
                      <span className="text-zinc-500 font-bold">₼</span>
                    </div>
                  </div>
                )}
              </section>

              {/* Time Reminder Activation Selector on Opening */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t('reminder_toggle_label')} ({configuredMinutes} {t('min_short')})</span>
                  </h3>
                </div>
                <div className={cn(
                  "flex p-1 rounded-xl border transition-colors",
                  theme === 'dark' ? "bg-white/5 border-white/5" : "bg-slate-100 border-slate-200"
                )}>
                  <button
                    type="button"
                    onClick={() => setActivateReminder(false)}
                    className={cn(
                      "flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap",
                      !activateReminder
                        ? (theme === 'dark' ? "bg-white text-black" : "bg-white text-slate-900 shadow-sm")
                        : "text-zinc-500"
                    )}
                  >
                    <BellOff className="w-3.5 h-3.5" />
                    <span>{t('reminder_dont_activate')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivateReminder(true)}
                    className={cn(
                      "flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer whitespace-nowrap",
                      activateReminder
                        ? "bg-amber-500 text-black shadow-sm"
                        : "text-zinc-500"
                    )}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>{t('reminder_activate')} ({configuredMinutes} {t('min_short')})</span>
                  </button>
                </div>
              </section>

              {/* Guest Note */}
              <section className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 block">
                  {t('guest_note')} ({t('optional')})
                </label>
                <input
                  type="text"
                  value={guestNote}
                  onChange={(e) => setGuestNote(e.target.value)}
                  placeholder={t('guest_note_placeholder')}
                  className={cn(
                    "w-full rounded-xl px-4 py-3 text-sm font-medium border focus:outline-none focus:border-blue-500 transition-colors",
                    theme === 'dark'
                      ? "bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                  )}
                />
              </section>

              {/* Already Paid Toggle */}
              <section className="space-y-3">
                <div 
                  onClick={() => setIsAlreadyPaid(!isAlreadyPaid)}
                  className={cn(
                    "p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between",
                    isAlreadyPaid
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-md shadow-emerald-500/10"
                      : (theme === 'dark' ? "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100")
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className={cn("w-5 h-5", isAlreadyPaid ? "text-emerald-500" : "text-zinc-500")} />
                    <div>
                      <p className="text-xs font-bold">{t('already_paid')}</p>
                      <p className="text-[10px] opacity-75">{t('mark_as_already_paid')}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-lg border flex items-center justify-center transition-colors",
                    isAlreadyPaid ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-500"
                  )}>
                    {isAlreadyPaid && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-6 min-w-0">
                <section className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className={cn(
                      "flex p-1 rounded-xl border transition-colors self-start",
                      theme === 'dark' ? "bg-white/5 border-white/5" : "bg-slate-100 border-slate-200"
                    )}>
                      <button 
                        onClick={() => setProductTab('products')}
                        className={cn(
                          "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer", 
                          productTab === 'products' 
                            ? (theme === 'dark' ? "bg-white text-black shadow-md" : "bg-white text-slate-900 shadow-sm") 
                            : "text-zinc-500"
                        )}
                      >
                        {t('add_products')}
                      </button>
                      <button 
                        onClick={() => setProductTab('sets')}
                        className={cn(
                          "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer", 
                          productTab === 'sets' 
                            ? (theme === 'dark' ? "bg-white text-black shadow-md" : "bg-white text-slate-900 shadow-sm") 
                            : "text-zinc-500"
                        )}
                      >
                        {t('product_sets')}
                      </button>
                    </div>

                    <div className="relative flex-1 sm:max-w-[220px]">
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('search')}
                        className={cn(
                          "w-full pl-8 pr-3 py-1.5 rounded-xl text-xs font-medium border focus:outline-none focus:border-blue-500",
                          theme === 'dark'
                            ? "bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
                            : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                        )}
                      />
                    </div>
                  </div>

                  {productTab === 'products' && categories.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <button
                        onClick={() => setSelectedCategory('all')}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors border cursor-pointer",
                          selectedCategory === 'all'
                            ? "bg-blue-600 border-blue-600 text-white"
                            : (theme === 'dark' ? "bg-white/5 border-white/5 text-zinc-400 hover:text-white" : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200")
                        )}
                      >
                        {t('all_categories')}
                      </button>
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={cn(
                            "px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors border cursor-pointer",
                            selectedCategory === cat
                              ? "bg-blue-600 border-blue-600 text-white"
                              : (theme === 'dark' ? "bg-white/5 border-white/5 text-zinc-400 hover:text-white" : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200")
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[280px] overflow-y-auto pr-1">
                    {productTab === 'products' ? (
                      filteredProducts.map(product => {
                        const invItem = inventory.find(i => i.id === product.inventory_id);
                        const isOutOfStock = !!(invItem && !invItem.is_stockless && invItem.stock_quantity === 0);
                        return (
                          <button
                            key={product.id}
                            disabled={isOutOfStock}
                            onClick={() => addProductToSession(product)}
                            className={cn(
                              "p-3 border rounded-xl transition-all text-left group relative overflow-hidden cursor-pointer",
                              theme === 'dark' ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:border-blue-500 hover:bg-slate-50 shadow-sm",
                              isOutOfStock && "opacity-50 grayscale cursor-not-allowed"
                            )}
                          >
                            <p className={cn(
                              "text-xs font-bold transition-colors line-clamp-1",
                              theme === 'dark' ? "text-white group-hover:text-blue-400" : "text-slate-900 group-hover:text-blue-600"
                            )}>{product.name}</p>
                            <div className="flex justify-between items-center mt-1.5">
                              <p className="text-[11px] font-mono font-bold text-zinc-500 tabular-nums">{formatCurrency(product.price)}</p>
                              {invItem && !invItem.is_stockless && (
                                <span className={cn(
                                  "text-[10px] font-mono font-bold tabular-nums",
                                  invItem.stock_quantity <= 5 ? "text-amber-500" : "text-emerald-500"
                                )}>
                                  {invItem.stock_quantity}
                                </span>
                              )}
                            </div>
                            {isOutOfStock && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-white bg-rose-600 px-2 py-1 rounded">{t('out_of_stock')}</span>
                              </div>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      filteredSets.map(set => {
                        const isOutOfStock = set.items.some(item => {
                          const invItem = inventory.find(i => i.id === item.inventory_id);
                          return invItem && !invItem.is_stockless && invItem.stock_quantity < item.quantity_required;
                        });
                        return (
                          <button
                            key={set.id}
                            disabled={isOutOfStock}
                            onClick={() => addSetToSession(set)}
                            className={cn(
                              "p-3.5 border rounded-2xl transition-all text-left group relative overflow-hidden col-span-1 sm:col-span-2 cursor-pointer",
                              theme === 'dark' ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:border-blue-500 hover:bg-slate-50 shadow-sm",
                              isOutOfStock && "opacity-50 grayscale cursor-not-allowed"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className={cn(
                                "text-sm font-bold transition-colors",
                                theme === 'dark' ? "text-white group-hover:text-blue-400" : "text-slate-900 group-hover:text-blue-600"
                              )}>{set.name}</p>
                              <p className="text-xs font-mono font-bold text-blue-500 tabular-nums shrink-0">{formatCurrency(set.total_price)}</p>
                            </div>
                            <p className="mt-1.5 text-[11px] text-zinc-500 truncate">
                              {set.items.map(item => `${item.inventory_name} ×${item.quantity_required}`).join(' · ')}
                            </p>
                            {isOutOfStock && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-white bg-rose-600 px-2 py-1 rounded">{t('out_of_stock')}</span>
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-xs font-semibold text-zinc-500">{t('active_products')}</h3>
                  <div className="space-y-1.5">
                    {session.products.length === 0 ? (
                      <div className={cn(
                        "p-6 border border-dashed rounded-xl text-center text-zinc-500 text-xs transition-colors",
                        theme === 'dark' ? "border-white/10" : "border-slate-200"
                      )}>
                        {t('no_products_added')}
                      </div>
                    ) : (
                      session.products.map(p => (
                        <div key={p.is_set ? `set-${p.set_id}-${p.id}` : `prod-${p.id}`} className={cn(
                          "flex items-center justify-between p-3 rounded-xl transition-colors",
                          theme === 'dark' ? "bg-white/5" : "bg-slate-50"
                        )}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0",
                              theme === 'dark' ? "bg-blue-600/20" : "bg-blue-600/10"
                            )}>
                              {p.is_set ? <Layers className="w-3.5 h-3.5 text-blue-500" /> : <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />}
                            </div>
                            <div className="min-w-0">
                              <p className={cn(
                                "text-xs font-bold truncate",
                                theme === 'dark' ? "text-white" : "text-slate-900"
                              )}>{p.name}</p>
                              <p className="text-[10px] text-zinc-500 font-mono tabular-nums">{formatCurrency(p.price)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className={cn(
                              "flex items-center rounded-lg p-0.5",
                              theme === 'dark' ? "bg-black/30" : "bg-slate-200"
                            )}>
                              <button
                                onClick={() => removeProductFromSession(p.is_set ? p.set_id! : p.id, !!p.is_set)}
                                className={cn("p-1 rounded-md transition-colors cursor-pointer", theme === 'dark' ? "hover:bg-white/10 text-zinc-400" : "hover:bg-white text-slate-600")}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className={cn(
                                "w-6 text-center text-xs font-bold tabular-nums",
                                theme === 'dark' ? "text-white" : "text-slate-900"
                              )}>{p.quantity}</span>
                              <button 
                                onClick={() => {
                                  if (p.is_set) {
                                    const targetSet = allSets.find(s => s.id === p.set_id);
                                    if (targetSet) addSetToSession(targetSet);
                                  } else {
                                    addProductToSession(p);
                                  }
                                }}
                                className={cn("p-1 rounded-md transition-colors cursor-pointer", theme === 'dark' ? "hover:bg-white/10 text-zinc-400" : "hover:bg-white text-slate-600")}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className={cn(
                              "text-xs font-mono font-bold w-16 text-right tabular-nums",
                              theme === 'dark' ? "text-white" : "text-slate-900"
                            )}>
                              {formatCurrency(p.price * p.quantity)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>

              <div className="w-full lg:w-72 space-y-4 shrink-0">
                {/* Bill Summary Card */}
                <div className={cn(
                  "border rounded-2xl p-4 space-y-4 transition-colors",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-sm"
                )}>
                  <h3 className="text-xs font-semibold text-zinc-500 flex items-center gap-2">
                    <Receipt className="w-3.5 h-3.5 text-blue-500" />
                    {t('bill_summary')}
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">{t('start_time')}</span>
                      <span className={cn(
                        "font-bold tabular-nums",
                        theme === 'dark' ? "text-white" : "text-slate-900"
                      )}>{formatDateTime(session.startTime)}</span>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className={cn(
                        "font-medium",
                        theme === 'dark' ? "text-zinc-400" : "text-slate-500"
                      )}>{t('order_amount')}</span>
                      <span className={cn(
                        "font-mono font-bold tabular-nums",
                        theme === 'dark' ? "text-white" : "text-slate-900"
                      )}>{formatCurrency(productCost)}</span>
                    </div>

                    {serviceFeePercent > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className={cn(
                          "font-medium",
                          theme === 'dark' ? "text-zinc-400" : "text-slate-500"
                        )}>{t('service_fee_amount')} ({serviceFeePercent}%)</span>
                        <span className={cn(
                          "font-mono font-bold tabular-nums",
                          theme === 'dark' ? "text-white" : "text-slate-900"
                        )}>{formatCurrency(serviceFee)}</span>
                      </div>
                    )}

                    {session.billingMode === 'depozit' && (
                      <div className={cn(
                        "pt-3 border-t space-y-2",
                        theme === 'dark' ? "border-white/10" : "border-slate-200"
                      )}>
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">{t('usage_amount')}</span>
                          <span className={cn(
                            "font-mono font-medium tabular-nums",
                            theme === 'dark' ? "text-white" : "text-slate-900"
                          )}>{formatCurrency(total)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">{t('min_payment')}</span>
                          <span className={cn(
                            "font-mono font-medium tabular-nums",
                            theme === 'dark' ? "text-amber-400" : "text-amber-600"
                          )}>{formatCurrency(session.depositAmount || 0)}</span>
                        </div>
                      </div>
                    )}

                    <div className={cn(
                      "flex justify-between items-center pt-3 border-t",
                      theme === 'dark' ? "border-white/10" : "border-slate-200"
                    )}>
                      <span className="text-xs font-bold text-zinc-400">
                        {t('final_payment')}
                      </span>
                      <span className="text-2xl font-mono font-bold text-blue-500 tracking-tighter tabular-nums">
                        {formatCurrency(finalPayable)}
                      </span>
                    </div>

                    <div className={cn(
                      "pt-3 border-t",
                      theme === 'dark' ? "border-white/10" : "border-slate-200"
                    )}>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!session) return;
                          const updated = {
                            ...session,
                            isAlreadyPaid: !session.isAlreadyPaid
                          };
                          await updateSession(updated);
                          toast.success(updated.isAlreadyPaid ? t('already_paid') : t('success_update'));
                        }}
                        className={cn(
                          "w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer",
                          session.isAlreadyPaid
                            ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                            : (theme === 'dark' ? "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10" : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200")
                        )}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{session.isAlreadyPaid ? t('already_paid') : t('mark_as_already_paid')}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Reminder Control Card inside Open Table */}
                <div className={cn(
                  "border rounded-2xl p-4 space-y-3 transition-colors",
                  session.reminderEnabled
                    ? (isReminderExpired
                        ? (theme === 'dark' ? "bg-amber-500/15 border-amber-500/40" : "bg-amber-50 border-amber-300")
                        : (theme === 'dark' ? "bg-white/[0.04] border-amber-500/25" : "bg-amber-50/40 border-amber-200"))
                    : (theme === 'dark' ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200")
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-amber-500" />
                      {t('reminder_toggle_label')}
                    </span>
                    {session.reminderEnabled && (
                      <span className={cn(
                        "font-mono font-bold text-sm tabular-nums",
                        isReminderExpired ? "text-amber-500" : (theme === 'dark' ? "text-white" : "text-slate-900")
                      )}>
                        {isReminderExpired ? t('reminder_finished') : formatCountdownMs(remainingMs)}
                      </span>
                    )}
                  </div>

                  {session.reminderEnabled ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => restartReminder(table.id, configuredMinutes)}
                        className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t('reminder_restart', { minutes: configuredMinutes })}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => stopReminder(table.id)}
                        className={cn(
                          "p-2 rounded-xl border transition-colors cursor-pointer",
                          theme === 'dark'
                            ? "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                            : "bg-white border-slate-200 text-slate-500 hover:text-slate-900"
                        )}
                        title={t('reminder_stop')}
                      >
                        <BellOff className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => restartReminder(table.id, configuredMinutes)}
                      className={cn(
                        "w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap",
                        theme === 'dark'
                          ? "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-500" />
                      <span>{t('reminder_start_now', { minutes: configuredMinutes })}</span>
                    </button>
                  )}
                </div>

                {/* Guest Note */}
                <div className={cn(
                  "border rounded-2xl p-4 space-y-2.5 transition-colors",
                  theme === 'dark' ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200"
                )}>
                  <label className="text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    {t('guest_note')}
                  </label>
                  <textarea
                    rows={2}
                    value={guestNote}
                    onChange={(e) => setGuestNote(e.target.value)}
                    onBlur={handleSaveNote}
                    placeholder={t('guest_note_placeholder')}
                    className={cn(
                      "w-full rounded-xl px-3 py-2 text-xs font-medium border resize-none focus:outline-none focus:border-blue-500 transition-colors",
                      theme === 'dark'
                        ? "bg-black/30 border-white/10 text-white placeholder:text-zinc-600"
                        : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                    )}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className={cn(
          "p-4 border-t flex flex-wrap justify-between items-center gap-3 transition-colors",
          theme === 'dark' ? "border-white/5 bg-white/[0.03]" : "border-slate-100 bg-slate-50"
        )}>
          <div>
            {session && session.products.length === 0 && (
              <button
                type="button"
                onClick={handleCloseEmptyTable}
                className={cn(
                  "px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-colors cursor-pointer",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-zinc-400 hover:text-rose-400 hover:border-rose-500/30"
                    : "bg-white border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200"
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('close_empty_table')}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              className={cn(
                "px-5 py-2.5 rounded-xl font-bold transition-all text-sm cursor-pointer",
                theme === 'dark' ? "text-zinc-400 hover:bg-white/5" : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              )}
            >
              {t('dismiss')}
            </button>
            {!session ? (
              <button
                onClick={handleStart}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all text-sm cursor-pointer"
              >
                <UtensilsCrossed className="w-4 h-4" />
                {t('open_table')}
              </button>
            ) : (
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all text-sm cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                {t('end_bill')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionModal;
