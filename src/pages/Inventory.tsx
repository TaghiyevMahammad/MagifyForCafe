import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Warehouse, 
  AlertCircle,
  Package,
  ArrowUpDown
} from 'lucide-react';
import { InventoryItem } from '../types';
import { apiFetch } from '../lib/api';
import { formatCurrency, cn } from '../lib/utils';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';
import ActionPasswordModal from '../components/ActionPasswordModal';

const Inventory: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<InventoryItem> | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'edit' | 'delete', data?: any } | null>(null);

  const handlePasswordSuccess = () => {
    if (!pendingAction) return;

    if (pendingAction.type === 'edit') {
      setCurrentItem(pendingAction.data);
      setIsModalOpen(true);
    } else if (pendingAction.type === 'delete') {
      setItemToDelete(pendingAction.data);
      setIsDeleteModalOpen(true);
    }
    setPendingAction(null);
  };

  const fetchItems = async () => {
    try {
      const res = await apiFetch('/api/inventory');
      const data = await res.json();
      setItems(data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem?.name) return;

    try {
      const method = currentItem.id ? 'PUT' : 'POST';
      const url = currentItem.id ? `/api/inventory/${currentItem.id}` : '/api/inventory';
      
      await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentItem)
      });

      toast.success(t('success_update'));
      setIsModalOpen(false);
      fetchItems();
    } catch (error) {
      toast.error(t('error_update'));
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await apiFetch(`/api/inventory/${itemToDelete}`, { method: 'DELETE' });
      toast.success(t('success_delete'));
      setIsDeleteModalOpen(false);
      fetchItems();
    } catch (error) {
      toast.error(t('error_delete'));
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <ActionPasswordModal 
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={handlePasswordSuccess}
      />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={cn(
            "text-3xl font-bold tracking-tight",
            theme === 'dark' ? "text-white" : "text-slate-900"
          )}>{t('inventory')}</h1>
          <p className="text-zinc-500 mt-1">{t('warehouse')}</p>
        </div>
        <button 
          onClick={() => {
            setCurrentItem({ name: '', stock_quantity: 0, purchase_price: 0 });
            setIsModalOpen(true);
          }}
          className={cn(
            "px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors",
            theme === 'dark' ? "bg-white text-black hover:bg-zinc-200" : "bg-blue-600 text-white hover:bg-blue-700"
          )}
        >
          <Plus className="w-5 h-5" />
          {t('add')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={cn(
          "border p-6 rounded-2xl flex items-center gap-4",
          theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-100 shadow-sm"
        )}>
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            theme === 'dark' ? "bg-blue-500/10" : "bg-blue-50"
          )}>
            <Package className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('total')}</p>
            <p className={cn(
              "text-xl font-bold",
              theme === 'dark' ? "text-white" : "text-slate-900"
            )}>{items.length}</p>
          </div>
        </div>
        <div className={cn(
          "border p-6 rounded-2xl flex items-center gap-4",
          theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-100 shadow-sm"
        )}>
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            theme === 'dark' ? "bg-amber-500/10" : "bg-amber-50"
          )}>
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('low_stock')}</p>
            <p className={cn(
              "text-xl font-bold tabular-nums",
              theme === 'dark' ? "text-white" : "text-slate-900"
            )}>{items.filter(i => !i.is_stockless && i.stock_quantity > 0 && i.stock_quantity <= 5).length}</p>
          </div>
        </div>
        <div className={cn(
          "border p-6 rounded-2xl flex items-center gap-4",
          theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-100 shadow-sm"
        )}>
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            theme === 'dark' ? "bg-rose-500/10" : "bg-rose-50"
          )}>
            <Warehouse className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('out_of_stock')}</p>
            <p className={cn(
              "text-xl font-bold tabular-nums",
              theme === 'dark' ? "text-white" : "text-slate-900"
            )}>{items.filter(i => !i.is_stockless && i.stock_quantity === 0).length}</p>
          </div>
        </div>
      </div>

      <div className={cn(
        "border rounded-2xl overflow-hidden shadow-sm",
        theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-100"
      )}>
        <div className={cn(
          "p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4",
          theme === 'dark' ? "border-white/[0.05]" : "border-slate-100 bg-slate-50/50"
        )}>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder={t('search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-full border rounded-xl py-2 pl-10 pr-4 transition-colors focus:outline-none focus:border-blue-500",
                theme === 'dark' ? "bg-transparent border-white/10 text-white placeholder:text-zinc-600" : "bg-white border-slate-200 text-slate-900 placeholder:text-zinc-400"
              )}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn(
                "border-b",
                theme === 'dark' ? "border-white/[0.05] bg-white/[0.01]" : "border-slate-100 bg-slate-50/50"
              )}>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t('name')}</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t('type')}</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t('stock')}</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t('purchase_price')}</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className={cn(
                  "border-b transition-colors group",
                  theme === 'dark' ? "border-white/[0.02] hover:bg-white/[0.02]" : "border-slate-50 hover:bg-slate-50/50"
                )}>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "font-bold text-sm",
                      theme === 'dark' ? "text-white" : "text-slate-900"
                    )}>{item.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                      item.is_stockless ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"
                    )}>
                      {item.is_stockless ? t('stockless') : t('stock')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {!item.is_stockless ? (
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "px-3 py-1 rounded-lg flex items-center gap-1.5 border tabular-nums",
                          item.stock_quantity === 0 
                            ? (theme === 'dark' ? "bg-rose-500/10 border-rose-500/30 text-rose-500" : "bg-rose-50 border-rose-200 text-rose-600") :
                          item.stock_quantity <= 5 
                            ? (theme === 'dark' ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-amber-50 border-amber-200 text-amber-600") :
                            (theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600")
                        )}>
                          <span className="text-sm font-black">{item.stock_quantity}</span>
                          {(item.original_quantity || 0) > 0 && (
                            <span className="text-[10px] font-bold opacity-40">/ {item.original_quantity}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-zinc-500 italic text-[10px] font-medium tracking-widest uppercase opacity-30">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "font-mono text-xs",
                      theme === 'dark' ? "text-zinc-400" : "text-zinc-600"
                    )}>{formatCurrency(item.purchase_price || 0)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => {
                          setPendingAction({ type: 'edit', data: item });
                          setIsPasswordModalOpen(true);
                        }}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          theme === 'dark' ? "hover:bg-white/10 text-zinc-500 hover:text-white" : "hover:bg-blue-50 text-slate-400 hover:text-blue-600"
                        )}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setPendingAction({ type: 'delete', data: item.id });
                          setIsPasswordModalOpen(true);
                        }}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          theme === 'dark' ? "hover:bg-rose-500/10 text-zinc-500 hover:text-rose-500" : "hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60">
          <div 
            className={cn(
              "border w-full max-w-md rounded-2xl overflow-hidden shadow-xl",
              theme === 'dark' ? "bg-[#0f0f0f] border-white/10" : "bg-white border-slate-200"
            )}
          >
            <form onSubmit={handleSave}>
              <div className={cn(
                "p-4 border-b flex justify-between items-center",
                theme === 'dark' ? "border-white/5 bg-white/5" : "border-slate-100 bg-slate-50"
              )}>
                <h2 className={cn(
                  "text-lg font-bold",
                  theme === 'dark' ? "text-white" : "text-slate-900"
                )}>{currentItem?.id ? t('edit_inventory_item') : t('add_inventory_item')}</h2>
              </div>
              <div className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('name')}</label>
                  <input 
                    type="text"
                    required
                    value={currentItem?.name || ''}
                    onChange={(e) => setCurrentItem({ ...currentItem, name: e.target.value })}
                    className={cn(
                      "w-full border rounded-xl py-2 px-3 transition-colors font-medium focus:outline-none focus:border-blue-500",
                      theme === 'dark' ? "bg-zinc-900 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  />
                </div>
                <div className="pt-1">
                  <div 
                    onClick={() => setCurrentItem({ ...currentItem, is_stockless: !currentItem?.is_stockless })}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors",
                      currentItem?.is_stockless 
                        ? (theme === 'dark' ? "bg-purple-500/10 border-purple-500/30" : "bg-purple-50 border-purple-200") 
                        : (theme === 'dark' ? "bg-zinc-900 border-white/10" : "bg-slate-50 border-slate-100")
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        currentItem?.is_stockless ? "bg-purple-500/20 text-purple-500" : (theme === 'dark' ? "bg-zinc-800 text-zinc-500" : "bg-slate-200 text-zinc-500")
                      )}>
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <p className={cn(
                          "text-xs font-bold",
                          theme === 'dark' ? "text-white" : "text-slate-900"
                        )}>{t('stockless')}</p>
                        <p className="text-[9px] text-zinc-500">{t('stockless_desc')}</p>
                      </div>
                    </div>
                    <div className={cn(
                      "w-10 h-5 rounded-full relative transition-colors",
                      currentItem?.is_stockless ? "bg-purple-600" : (theme === 'dark' ? "bg-zinc-700" : "bg-slate-300")
                    )}>
                      <div className={cn(
                        "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                        currentItem?.is_stockless ? "left-6" : "left-1"
                      )} />
                    </div>
                  </div>
                </div>

                {!currentItem?.is_stockless && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('quantity')}</label>
                    <input 
                      type="number"
                      required
                      min="0"
                      value={isNaN(currentItem?.stock_quantity as number) ? '' : currentItem?.stock_quantity}
                      onChange={(e) => setCurrentItem({ ...currentItem, stock_quantity: parseInt(e.target.value) })}
                      className={cn(
                        "w-full border rounded-xl py-2 px-3 transition-colors font-medium focus:outline-none focus:border-blue-500",
                        theme === 'dark' ? "bg-zinc-900 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('purchase_price')}</label>
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      value={isNaN(currentItem?.purchase_price as number) ? '' : currentItem?.purchase_price}
                      onChange={(e) => setCurrentItem({ ...currentItem, purchase_price: parseFloat(e.target.value) })}
                      className={cn(
                        "w-full border rounded-xl py-2 px-3 transition-colors font-medium focus:outline-none focus:border-blue-500",
                        theme === 'dark' ? "bg-zinc-900 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      )}
                    />
                  </div>
                </div>
                )}
              </div>
              <div className={cn(
                "p-4 border-t flex justify-end gap-3",
                theme === 'dark' ? "border-white/5 bg-white/5" : "border-slate-100 bg-slate-50"
              )}>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={cn(
                    "px-4 py-2 rounded-lg font-bold transition-colors text-xs",
                    theme === 'dark' ? "text-zinc-400 hover:bg-white/5" : "text-slate-500 hover:bg-slate-200/50"
                  )}
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  className={cn(
                    "px-6 py-2 rounded-lg font-bold transition-colors text-xs",
                    theme === 'dark' ? "bg-white text-black hover:bg-zinc-200" : "bg-blue-600 text-white hover:bg-blue-700"
                  )}
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        title={t('confirm_delete')}
        message={t('confirm_delete')}
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
};

export default Inventory;
