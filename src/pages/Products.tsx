import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { Plus, Trash2, Package, X, Edit2, Layers, ShoppingBag } from 'lucide-react';
import { motion } from 'motion/react';
import { Product, InventoryItem, ProductSet } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';
import ConfirmModal from '../components/ConfirmModal';
import ActionPasswordModal from '../components/ActionPasswordModal';

const Products: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'products' | 'sets'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sets, setSets] = useState<ProductSet[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSetModalOpen, setIsSetModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingSet, setEditingSet] = useState<ProductSet | null>(null);
  
  const [formData, setFormData] = useState({ name: '', price: '', category: '', inventory_id: '' });
  const [productSetFormData, setProductSetFormData] = useState<{ 
    name: string, 
    total_price: string, 
    items: { inventory_id: number, quantity_required: number }[]
  }>({ 
    name: '', 
    total_price: '', 
    items: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pRes, iRes, sRes] = await Promise.all([
        apiFetch('/api/products'),
        apiFetch('/api/inventory'),
        apiFetch('/api/product_sets')
      ]);
      setProducts(await pRes.json());
      setInventory(await iRes.json());
      setSets(await sRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({ name: '', price: '', category: '', inventory_id: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setPendingAction({ type: 'edit', data: product });
    setIsPasswordModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum < 0) return;

    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';
      
      await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData, 
          price: priceNum,
          inventory_id: formData.inventory_id ? parseInt(formData.inventory_id) : null
        })
      });
      
      toast.success(t('success_update'));
      fetchData();
      setIsModalOpen(false);
    } catch (error) {
      toast.error(t('error_update'));
    }
  };

  const handleOpenAddSet = () => {
    setEditingSet(null);
    setProductSetFormData({ name: '', total_price: '', items: [{ inventory_id: 0, quantity_required: 1 }] });
    setIsSetModalOpen(true);
  };

  const handleOpenEditSet = (set: ProductSet) => {
    setPendingAction({ type: 'editSet', data: set });
    setIsPasswordModalOpen(true);
  };

  const handleSetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(productSetFormData.total_price);
    if (isNaN(priceNum) || priceNum < 0) return;

    if (productSetFormData.items.some(i => i.inventory_id === 0)) {
      toast.error(t('error_select_item'));
      return;
    }

    try {
      const url = editingSet ? `/api/product_sets/${editingSet.id}` : '/api/product_sets';
      const method = editingSet ? 'PUT' : 'POST';
      
      await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...productSetFormData, total_price: priceNum })
      });
      
      toast.success(t('success_update'));
      fetchData();
      setIsSetModalOpen(false);
    } catch (error) {
      toast.error(t('error_update'));
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: number, type: 'product' | 'set' } | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'edit' | 'delete' | 'editSet', data?: any } | null>(null);

  const handlePasswordSuccess = () => {
    if (!pendingAction) return;

    if (pendingAction.type === 'edit') {
      const product = pendingAction.data as Product;
      setEditingProduct(product);
      setFormData({ 
        name: product.name, 
        price: product.price.toString(), 
        category: product.category || '',
        inventory_id: product.inventory_id?.toString() || ''
      });
      setIsModalOpen(true);
    } else if (pendingAction.type === 'editSet') {
      const set = pendingAction.data as ProductSet;
      setEditingSet(set);
      setProductSetFormData({
        name: set.name,
        total_price: set.total_price.toString(),
        items: set.items.map(i => ({ inventory_id: i.inventory_id, quantity_required: i.quantity_required }))
      });
      setIsSetModalOpen(true);
    } else if (pendingAction.type === 'delete') {
      setItemToDelete(pendingAction.data);
      setIsDeleteModalOpen(true);
    }
    setPendingAction(null);
  };

  const handleDeleteClick = (id: number, type: 'product' | 'set') => {
    setPendingAction({ type: 'delete', data: { id, type } });
    setIsPasswordModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const url = itemToDelete.type === 'product' ? `/api/products/${itemToDelete.id}` : `/api/product_sets/${itemToDelete.id}`;
      await apiFetch(url, { method: 'DELETE' });
      toast.success(t('success_delete'));
      fetchData();
      setIsDeleteModalOpen(false);
    } catch (error) {
      toast.error(t('error_delete'));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <ActionPasswordModal 
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={handlePasswordSuccess}
      />
      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        title={t('delete')}
        message={t('confirm_delete')}
        onConfirm={confirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={cn(
            "text-4xl font-bold tracking-tight",
            theme === 'dark' ? "text-white" : "text-slate-900"
          )}>{t('products')}</h1>
          <p className="text-zinc-500 mt-2">{t('manage_products_desc')}</p>
        </div>
        <div className={cn(
          "flex items-center gap-3 p-1.5 rounded-2xl border transition-colors",
          theme === 'dark' ? "bg-white/[0.03] border-white/[0.05]" : "bg-slate-100 border-slate-200 shadow-sm"
        )}>
          <button 
            onClick={() => setActiveTab('products')}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
              activeTab === 'products' 
                ? (theme === 'dark' ? "bg-white text-black shadow-lg" : "bg-white text-slate-900 shadow-xl border border-slate-200") 
                : (theme === 'dark' ? "text-zinc-500 hover:text-white hover:bg-white/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200")
            )}
          >
            <ShoppingBag className="w-4 h-4" />
            {t('products')}
          </button>
          <button 
            onClick={() => setActiveTab('sets')}
            className={cn(
              "px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
              activeTab === 'sets' 
                ? (theme === 'dark' ? "bg-white text-black shadow-lg" : "bg-white text-slate-900 shadow-xl border border-slate-200") 
                : (theme === 'dark' ? "text-zinc-500 hover:text-white hover:bg-white/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200")
            )}
          >
            <Layers className="w-4 h-4" />
            {t('product_sets')}
          </button>
        </div>
      </header>

      <div className="flex justify-end">
        <button 
          onClick={activeTab === 'products' ? handleOpenAdd : handleOpenAddSet}
          className={cn(
            "px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95",
            theme === 'dark' ? "bg-white text-black hover:bg-zinc-200 shadow-white/5" : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
          )}
        >
          <Plus className="w-5 h-5" />
          {activeTab === 'products' ? t('add_product') : t('add_set')}
        </button>
      </div>

      {activeTab === 'products' ? (
        <div className={cn(
          "border rounded-[40px] overflow-hidden shadow-2xl transition-colors duration-500",
          theme === 'dark' ? "bg-[#0A0A0A] border-white/[0.05]" : "bg-white border-slate-100"
        )}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn(
                "border-b transition-colors",
                theme === 'dark' ? "border-white/[0.05] bg-white/[0.01]" : "border-slate-100 bg-slate-50/50"
              )}>
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{t('name')}</th>
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{t('category')}</th>
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{t('stock')}</th>
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{t('price')}</th>
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className={cn(
              "divide-y",
              theme === 'dark' ? "divide-white/[0.02]" : "divide-slate-100"
            )}>
              {products.map(product => {
                const invItem = inventory.find(i => i.id === product.inventory_id);
                return (
                  <tr key={product.id} className={cn(
                    "transition-colors group",
                    theme === 'dark' ? "hover:bg-white/[0.02]" : "hover:bg-slate-50/50"
                  )}>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center border transition-colors",
                          theme === 'dark' ? "bg-white/[0.03] border-white/[0.05]" : "bg-slate-50 border-slate-100"
                        )}>
                          <Package className="w-5 h-5 text-zinc-500" />
                        </div>
                        <span className={cn(
                          "font-bold transition-colors",
                          theme === 'dark' ? "text-white" : "text-slate-900"
                        )}>{product.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors",
                        theme === 'dark' ? "bg-white/[0.03] text-zinc-500 border-white/[0.05]" : "bg-slate-100 text-slate-500 border-slate-200"
                      )}>
                        {product.category || t('general')}
                      </span>
                    </td>
                  <td className="px-8 py-6">
                    {invItem ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-widest",
                            invItem.is_stockless ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"
                          )}>
                            {invItem.is_stockless ? t('stockless') : t('stock')}
                          </span>
                        </div>
                        {!invItem.is_stockless ? (
                          <div className="flex items-center gap-3 text-left">
                            <div className={cn(
                              "px-4 py-1.5 rounded-xl flex items-center gap-1.5 border shadow-sm transition-all",
                              invItem.stock_quantity === 0 
                                ? (theme === 'dark' ? "bg-rose-500/10 border-rose-500/30 text-rose-500" : "bg-rose-50 border-rose-200 text-rose-600") :
                              invItem.stock_quantity <= 5 
                                ? (theme === 'dark' ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-amber-50 border-amber-200 text-amber-600") :
                                (theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600")
                            )}>
                              <span className="text-[13px] font-black tabular-nums">{invItem.stock_quantity}</span>
                              {(invItem.original_quantity || 0) > 0 && (
                                <span className="text-[10px] font-bold opacity-40 tabular-nums">/ {invItem.original_quantity}</span>
                              )}
                            </div>
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest opacity-60">{t('unit')}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500 italic text-[11px] font-medium tracking-widest uppercase opacity-40">—</span>
                        )}
                        <span className="text-[10px] text-zinc-500 font-mono opacity-60">
                          {t('purchase_price')}: {formatCurrency(invItem.purchase_price)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-zinc-600 text-xs">—</span>
                    )}
                  </td>
                    <td className={cn(
                      "px-8 py-6 font-mono font-bold",
                      theme === 'dark' ? "text-white" : "text-slate-900"
                    )}>{formatCurrency(product.price)}</td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEdit(product)}
                          className={cn(
                            "p-2 rounded-xl transition-all",
                            theme === 'dark' ? "text-zinc-500 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          )}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(product.id, 'product')}
                          className={cn(
                            "p-2 rounded-xl transition-all",
                            theme === 'dark' ? "text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10" : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          )}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sets.map(set => (
            <motion.div 
              key={set.id}
              layout
              className={cn(
                "border p-8 rounded-[40px] space-y-6 group transition-all shadow-2xl",
                theme === 'dark' ? "bg-[#0A0A0A] border-white/[0.05] hover:border-white/10" : "bg-white border-slate-100 hover:border-blue-200"
              )}
            >
              <div className="flex justify-between items-start">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center border transition-colors",
                  theme === 'dark' ? "bg-white/[0.03] border-white/[0.05]" : "bg-slate-50 border-slate-100 shadow-sm"
                )}>
                  <Layers className={cn("w-7 h-7", theme === 'dark' ? "text-zinc-400" : "text-blue-600")} />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenEditSet(set)} className={cn(
                    "p-2 rounded-xl transition-all",
                    theme === 'dark' ? "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white" : "bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-200"
                  )}>
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteClick(set.id, 'set')} className={cn(
                    "p-2 rounded-xl transition-all",
                    theme === 'dark' ? "bg-rose-500/5 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-500" : "bg-rose-50 hover:bg-rose-100 text-slate-400 hover:text-rose-600 border border-rose-100"
                  )}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <h3 className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? "text-white" : "text-slate-900"
                )}>{set.name}</h3>
                <p className={cn(
                  "text-3xl font-black mt-2 font-mono",
                  theme === 'dark' ? "text-white" : "text-blue-600"
                )}>{formatCurrency(set.total_price)}</p>
              </div>
              <div className={cn(
                "space-y-4 pt-4 border-t",
                theme === 'dark' ? "border-white/5" : "border-slate-100"
              )}>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('included_products')}</p>
                  <div className="space-y-2">
                    {set.items.map((item, idx) => (
                      <div key={idx} className={cn(
                        "flex justify-between items-center p-3 rounded-xl border transition-colors",
                        theme === 'dark' ? "bg-white/[0.02] border-white/[0.03]" : "bg-slate-50 border-slate-100"
                      )}>
                        <span className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-zinc-300" : "text-slate-700 font-medium"
                        )}>{item.inventory_name}</span>
                        <span className={cn(
                          "text-xs font-bold px-2 py-1 rounded-lg transition-colors",
                          theme === 'dark' ? "text-white bg-white/5" : "text-slate-900 bg-white shadow-sm border border-slate-100"
                        )}>x{item.quantity_required}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "border w-full max-w-md rounded-3xl overflow-hidden shadow-2xl transition-colors duration-500",
              theme === 'dark' ? "bg-[#0f0f0f] border-white/10" : "bg-white border-slate-200"
            )}
          >
            <div className={cn(
              "p-6 border-b flex justify-between items-center transition-colors",
              theme === 'dark' ? "border-white/5 bg-white/5" : "border-slate-100 bg-slate-50"
            )}>
              <h2 className={cn(
                "text-xl font-bold",
                theme === 'dark' ? "text-white" : "text-slate-900"
              )}>{editingProduct ? t('edit_product') : t('add_new_product')}</h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className={cn(
                  "p-2 rounded-full transition-colors",
                  theme === 'dark' ? "hover:bg-white/10 text-zinc-400" : "hover:bg-slate-200 text-slate-500"
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500" htmlFor="product-name">{t('name')}</label>
                <input 
                  id="product-name"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className={cn(
                    "w-full border rounded-2xl px-4 py-3 transition-all font-medium focus:outline-none focus:ring-2",
                    theme === 'dark' ? "bg-zinc-900 border-white/10 text-white focus:ring-white/20" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-500/20"
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{t('category')}</label>
                  <input 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className={cn(
                      "w-full border rounded-2xl px-4 py-3 transition-all font-medium focus:outline-none focus:ring-2",
                      theme === 'dark' ? "bg-zinc-900 border-white/10 text-white focus:ring-white/20" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-500/20"
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{t('price')}</label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value})}
                    className={cn(
                      "w-full border rounded-2xl px-4 py-3 transition-all font-medium focus:outline-none focus:ring-2",
                      theme === 'dark' ? "bg-zinc-900 border-white/10 text-white focus:ring-white/20" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-500/20"
                    )}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500" htmlFor="product-inventory">{t('select_inventory_item')} ({t('optional')})</label>
                <div className="relative">
                  <select 
                    id="product-inventory"
                    value={formData.inventory_id}
                    onChange={e => setFormData({...formData, inventory_id: e.target.value})}
                    className={cn(
                      "w-full border rounded-2xl px-4 py-3 transition-all appearance-none cursor-pointer focus:outline-none focus:ring-2",
                      theme === 'dark' ? "bg-zinc-900 border-white/10 text-white focus:ring-white/20" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-500/20"
                    )}
                  >
                    <option value="" className={theme === 'dark' ? "bg-[#1A1A1A] text-white" : "bg-white text-slate-900"}>—</option>
                    {inventory.map(item => (
                      <option key={item.id} value={item.id} className={theme === 'dark' ? "bg-[#1A1A1A] text-white" : "bg-white text-slate-900"}>
                        {item.name} ({item.is_stockless ? t('stockless') : `${t('stock')}: ${item.stock_quantity}`})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold transition-all",
                    theme === 'dark' ? "text-zinc-400 hover:bg-white/5" : "bg-slate-100 text-slate-500 hover:bg-slate-200 font-medium border border-slate-200"
                  )}
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit" 
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg",
                    theme === 'dark' ? "bg-white text-black hover:bg-zinc-200" : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
                  )}
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isSetModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "border w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl transition-colors duration-500",
              theme === 'dark' ? "bg-[#0f0f0f] border-white/10" : "bg-white border-slate-200"
            )}
          >
            <div className={cn(
              "p-6 border-b flex justify-between items-center transition-colors",
              theme === 'dark' ? "border-white/5 bg-white/5" : "border-slate-100 bg-slate-50"
            )}>
              <h2 className={cn(
                "text-xl font-bold",
                theme === 'dark' ? "text-white" : "text-slate-900"
              )}>{editingSet ? t('edit_set') : t('add_set')}</h2>
              <button 
                onClick={() => setIsSetModalOpen(false)} 
                className={cn(
                  "p-2 rounded-full transition-colors",
                  theme === 'dark' ? "hover:bg-white/10 text-zinc-400" : "hover:bg-slate-200 text-slate-500"
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSetSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500" htmlFor="set-name">{t('name')}</label>
                <input 
                  id="set-name"
                  required
                  value={productSetFormData.name}
                  onChange={e => setProductSetFormData({...productSetFormData, name: e.target.value})}
                  className={cn(
                    "w-full border rounded-2xl px-4 py-3 transition-all font-medium focus:outline-none focus:ring-2",
                    theme === 'dark' ? "bg-zinc-900 border-white/10 text-white focus:ring-white/20" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-500/20"
                  )}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500" htmlFor="set-price">{t('set_price')}</label>
                <input 
                  id="set-price"
                  required
                  type="number"
                  step="0.1"
                  value={productSetFormData.total_price}
                  onChange={e => setProductSetFormData({...productSetFormData, total_price: e.target.value})}
                  className={cn(
                    "w-full border rounded-2xl px-4 py-3 transition-all font-medium focus:outline-none focus:ring-2",
                    theme === 'dark' ? "bg-zinc-900 border-white/10 text-white focus:ring-white/20" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-500/20"
                  )}
                />
              </div>

              <div className={cn(
                "space-y-4 pt-4 border-t",
                theme === 'dark' ? "border-white/5" : "border-slate-100"
              )}>
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{t('included_products')}</label>
                  <button 
                    type="button"
                    onClick={() => setProductSetFormData({...productSetFormData, items: [...productSetFormData.items, { inventory_id: 0, quantity_required: 1 }]})}
                    className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:text-blue-400 transition-colors"
                  >
                    + {t('add')}
                  </button>
                </div>
                <div className="space-y-3">
                  {productSetFormData.items.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-end">
                      <div className="flex-1 space-y-1">
                        <select 
                          required
                          value={item.inventory_id}
                          onChange={e => {
                            const newItems = [...productSetFormData.items];
                            newItems[idx].inventory_id = parseInt(e.target.value);
                            setProductSetFormData({...productSetFormData, items: newItems});
                          }}
                          className={cn(
                            "w-full border rounded-xl px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 cursor-pointer",
                            theme === 'dark' ? "bg-zinc-900 border-white/10 text-white focus:ring-white/20" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-500/20"
                          )}
                        >
                          <option value="0" className={theme === 'dark' ? "bg-[#1A1A1A]" : "bg-white"}>{t('select_inventory_item')}</option>
                          {inventory.map(inv => (
                            <option key={inv.id} value={inv.id} className={theme === 'dark' ? "bg-[#1A1A1A]" : "bg-white"}>{inv.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24 space-y-1">
                        <input 
                          type="number"
                          min="1"
                          value={isNaN(item.quantity_required) ? '' : item.quantity_required}
                          onChange={e => {
                            const newItems = [...productSetFormData.items];
                            newItems[idx].quantity_required = parseInt(e.target.value);
                            setProductSetFormData({...productSetFormData, items: newItems});
                          }}
                          className={cn(
                            "w-full border rounded-xl px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2",
                            theme === 'dark' ? "bg-zinc-900 border-white/10 text-white focus:ring-white/20" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-500/20"
                          )}
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          const newItems = productSetFormData.items.filter((_, i) => i !== idx);
                          setProductSetFormData({...productSetFormData, items: newItems});
                        }}
                        className={cn(
                          "p-2 transition-colors",
                          theme === 'dark' ? "text-zinc-500 hover:text-rose-500" : "text-slate-400 hover:text-rose-600"
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsSetModalOpen(false)} 
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold transition-all",
                    theme === 'dark' ? "text-zinc-400 hover:bg-white/5" : "bg-slate-100 text-slate-500 hover:bg-slate-200 font-medium border border-slate-200"
                  )}
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit" 
                  className={cn(
                    "flex-1 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg",
                    theme === 'dark' ? "bg-white text-black hover:bg-zinc-200" : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
                  )}
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Products;
