import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Banknote, CreditCard, Layers, ArrowRight, Ban } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { formatCurrency, cn } from '../lib/utils';

interface PaymentModalProps {
  total: number;
  usageTotal?: number;
  billingMode?: 'adi' | 'depozit';
  depositAmount?: number;
  onClose: () => void;
  onConfirm: (paymentData: { 
    payment_type: 'cash' | 'card' | 'mixed' | 'unpaid', 
    cash_amount: number, 
    card_amount: number 
  }) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ total, usageTotal, billingMode, depositAmount, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [paymentType, setPaymentType] = useState<'cash' | 'card' | 'mixed' | 'unpaid'>('cash');
  const [cashAmount, setCashAmount] = useState<string>(total.toString());
  const [error, setError] = useState<string | null>(null);

  const isDepositApplied = billingMode === 'depozit' && depositAmount && (usageTotal || 0) < depositAmount;

  const handleConfirm = () => {
    let cash = 0;
    let card = 0;

    if (paymentType === 'cash') {
      cash = total;
      card = 0;
    } else if (paymentType === 'card') {
      cash = 0;
      card = total;
    } else if (paymentType === 'unpaid') {
      cash = 0;
      card = 0;
    } else {
      cash = parseFloat(cashAmount) || 0;
      if (cash > total) {
        setError(t('error_cash_exceeds_total'));
        return;
      }
      card = total - cash;
    }

    onConfirm({
      payment_type: paymentType,
      cash_amount: cash,
      card_amount: card
    });
  };

  const calculatedCardAmount = paymentType === 'mixed' 
    ? Math.max(0, total - (parseFloat(cashAmount) || 0)) 
    : 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
      <div 
        className={cn(
          "w-full max-w-md rounded-2xl overflow-hidden shadow-xl flex flex-col border transition-colors duration-200",
          theme === 'dark' ? "bg-[#0f0f0f] border-white/10" : "bg-white border-slate-200"
        )}
      >
        <div className={cn(
          "p-6 border-b flex justify-between items-center",
          theme === 'dark' ? "border-white/5 bg-white/5" : "border-slate-100 bg-slate-50"
        )}>
          <h2 className={cn(
            "text-xl font-bold tracking-tight",
            theme === 'dark' ? "text-white" : "text-slate-900"
          )}>{t('payment_method')}</h2>
          <button onClick={onClose} className={cn("p-2 rounded-full transition-colors duration-150", theme === 'dark' ? "hover:bg-white/10" : "hover:bg-slate-200")}>
            <X className={cn("w-6 h-6", theme === 'dark' ? "text-zinc-400" : "text-slate-400")} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="text-center space-y-4">
            {billingMode === 'depozit' && (
              <div className={cn(
                "space-y-2 mb-4 p-4 rounded-xl border transition-colors",
                theme === 'dark' ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"
              )}>
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-zinc-500">
                  <span>{t('usage_amount')}</span>
                  <span className={theme === 'dark' ? "text-zinc-300" : "text-slate-700"}>{formatCurrency(usageTotal || 0)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-zinc-500">
                  <span>{t('depozit')}</span>
                  <span className={theme === 'dark' ? "text-zinc-300" : "text-slate-700"}>{formatCurrency(depositAmount || 0)}</span>
                </div>
                {isDepositApplied && (
                  <div className={cn(
                    "pt-2 border-t mt-2",
                    theme === 'dark' ? "border-white/5" : "border-slate-100"
                  )}>
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                      {t('min_deposit_applied')}
                    </p>
                  </div>
                )}
              </div>
            )}
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">{t('final_payment')}</p>
            <p className={cn(
              "text-5xl font-bold tracking-tighter",
              theme === 'dark' ? "text-white" : "text-slate-900"
            )}>{formatCurrency(total)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setPaymentType('cash');
                setError(null);
              }}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-colors duration-150",
                paymentType === 'cash' 
                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-sm" 
                  : theme === 'dark'
                    ? "bg-white/5 border-transparent text-zinc-500 hover:bg-white/10"
                    : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
              )}
            >
              <Banknote className={cn("w-6 h-6", paymentType === 'cash' ? "text-emerald-500" : "text-zinc-500")} />
              <span className="text-xs font-bold uppercase tracking-wider">{t('cash')}</span>
            </button>
            <button
              onClick={() => {
                setPaymentType('card');
                setError(null);
              }}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-colors duration-150",
                paymentType === 'card' 
                  ? "bg-blue-500/10 border-blue-500 text-blue-500 shadow-sm" 
                  : theme === 'dark'
                    ? "bg-white/5 border-transparent text-zinc-500 hover:bg-white/10"
                    : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
              )}
            >
              <CreditCard className={cn("w-6 h-6", paymentType === 'card' ? "text-blue-500" : "text-zinc-500")} />
              <span className="text-xs font-bold uppercase tracking-wider">{t('card')}</span>
            </button>
            <button
              onClick={() => {
                setPaymentType('mixed');
                setCashAmount((total / 2).toString());
                setError(null);
              }}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-colors duration-150",
                paymentType === 'mixed' 
                  ? "bg-purple-500/10 border-purple-500 text-purple-500 shadow-sm" 
                  : theme === 'dark'
                    ? "bg-white/5 border-transparent text-zinc-500 hover:bg-white/10"
                    : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
              )}
            >
              <Layers className={cn("w-6 h-6", paymentType === 'mixed' ? "text-purple-500" : "text-zinc-500")} />
              <span className="text-xs font-bold uppercase tracking-wider">{t('mixed')}</span>
            </button>
            <button
              onClick={() => {
                setPaymentType('unpaid');
                setError(null);
              }}
              className={cn(
                "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-colors duration-150",
                paymentType === 'unpaid' 
                  ? "bg-rose-500/10 border-rose-500 text-rose-500 shadow-sm" 
                  : theme === 'dark'
                    ? "bg-white/5 border-transparent text-zinc-500 hover:bg-white/10"
                    : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
              )}
            >
              <Ban className={cn("w-6 h-6", paymentType === 'unpaid' ? "text-rose-500" : "text-zinc-500")} />
              <span className="text-xs font-bold uppercase tracking-wider">{t('unpaid_close')}</span>
            </button>
          </div>

          {paymentType === 'mixed' && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">{t('cash_amount')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Banknote className="w-4 h-4 text-emerald-500" />
                  </div>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => {
                      setCashAmount(e.target.value);
                      setError(null);
                    }}
                    className={cn(
                      "w-full rounded-xl pl-11 pr-4 py-3 font-bold focus:outline-none focus:border-purple-500/50 transition-colors duration-150 border",
                      theme === 'dark' 
                        ? "bg-white/5 border-white/10 text-white" 
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">{t('card_amount')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <CreditCard className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className={cn(
                    "w-full border rounded-xl pl-11 pr-4 py-3 font-bold",
                    theme === 'dark' 
                      ? "bg-white/[0.02] border-white/5 text-zinc-400" 
                      : "bg-slate-50/50 border-slate-100 text-slate-500"
                  )}>
                    {formatCurrency(calculatedCardAmount)}
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-rose-500 text-[11px] font-bold ml-1">{error}</p>
              )}
            </div>
          )}
        </div>

        <div className={cn(
          "p-6 border-t transition-colors duration-200",
          theme === 'dark' ? "border-white/5 bg-white/5" : "border-slate-100 bg-slate-50"
        )}>
          <button
            onClick={handleConfirm}
            className={cn(
              "w-full font-bold py-4 rounded-xl transition-colors duration-150 flex items-center justify-center gap-2 group",
              theme === 'dark' 
                ? "bg-white text-black hover:bg-zinc-200" 
                : "bg-slate-900 text-white hover:bg-slate-800"
            )}
          >
            <span>{t('confirm')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
