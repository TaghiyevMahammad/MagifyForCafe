import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Globe, Percent, Shield, Info, KeyRound, Sun, Moon, Bell, Volume2 } from 'lucide-react';
import { Settings as SettingsType } from '../types';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { useSessions } from '../contexts/SessionContext';
import { cn } from '../lib/utils';
import ChangeReportPasswordModal from '../components/ChangeReportPasswordModal';

const DEFAULT_REMINDER_MSG = 'Təyin olunan vaxt tamam oldu! Zəhmət olmasa masa ilə maraqlanın.';

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { refreshReminderConfig, testReminderSound } = useSessions();
  const [isReportPasswordModalOpen, setIsReportPasswordModalOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsType>({
    language: 'az',
    service_fee: '0',
    reminder_minutes: '40',
    reminder_message: DEFAULT_REMINDER_MSG
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('/api/settings');
      const data = await res.json();
      setSettings({
        language: data.language || 'az',
        service_fee: data.service_fee ?? '0',
        reminder_minutes: data.reminder_minutes ?? '40',
        reminder_message: data.reminder_message ?? DEFAULT_REMINDER_MSG
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const normalizedFee = Math.max(0, Math.min(100, parseFloat(settings.service_fee || '0') || 0)).toString();
      const normalizedMinutes = Math.max(1, Math.min(720, parseInt(settings.reminder_minutes || '40', 10) || 40)).toString();
      const normalizedMessage = (settings.reminder_message || '').trim() || DEFAULT_REMINDER_MSG;

      const updatedSettings: SettingsType = {
        ...settings,
        service_fee: normalizedFee,
        reminder_minutes: normalizedMinutes,
        reminder_message: normalizedMessage
      };

      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updatedSettings })
      });
      if (res.ok) {
        setSettings(updatedSettings);
        await refreshReminderConfig();
        toast.success(t('success_update'));
        i18n.changeLanguage(updatedSettings.language);
      }
    } catch (error) {
      toast.error(t('error_update'));
    }
  };

  return (
    <div className="space-y-6">
      <ChangeReportPasswordModal 
        isOpen={isReportPasswordModalOpen}
        onClose={() => setIsReportPasswordModalOpen(false)}
      />
      <header className="flex justify-between items-end">
        <div>
          <h1 className={cn("text-2xl sm:text-3xl font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>{t('settings')}</h1>
          <p className="text-zinc-500 text-sm mt-1">{t('manage_settings_desc')}</p>
        </div>
        <button 
          onClick={handleSaveSettings}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-colors duration-150 shadow-sm cursor-pointer whitespace-nowrap"
        >
          <Save className="w-4 h-4" />
          {t('save')}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Time Reminder Configuration Section */}
          <section className={cn("border rounded-2xl p-6 space-y-5", theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-200")}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <h2 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t('reminder_settings_title')}</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">{t('reminder_settings_desc')}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={testReminderSound}
                className={cn(
                  "self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap",
                  theme === 'dark'
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                    : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                )}
              >
                <Volume2 className="w-4 h-4" />
                <span>{t('test_sound')}</span>
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <label className="text-xs font-semibold text-zinc-500 block">
                {t('reminder_duration_label')}
              </label>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {['15', '30', '40', '45', '60'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSettings({ ...settings, reminder_minutes: preset })}
                      className={cn(
                        "px-3.5 py-2 rounded-xl font-mono font-bold text-sm border transition-colors tabular-nums cursor-pointer whitespace-nowrap",
                        settings.reminder_minutes === preset
                          ? "bg-amber-500 text-black border-amber-500 shadow-xs"
                          : (theme === 'dark' ? "bg-white/5 text-zinc-400 border-white/5 hover:text-white" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100")
                      )}
                    >
                      {preset} {t('min_short')}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-32">
                    <input
                      type="number"
                      min="1"
                      max="720"
                      step="1"
                      value={settings.reminder_minutes ?? '40'}
                      onChange={(e) => setSettings({ ...settings, reminder_minutes: e.target.value })}
                      className={cn(
                        "w-full border rounded-xl pl-3 pr-11 py-2 text-sm font-mono font-bold tabular-nums focus:outline-none focus:border-amber-500",
                        theme === 'dark' ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-xs">
                      {t('min_short')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={cn("space-y-2 pt-4 border-t", theme === 'dark' ? "border-white/5" : "border-slate-100")}>
              <label className="text-xs font-semibold text-zinc-500 block">
                {t('reminder_message_label')}
              </label>
              <textarea
                rows={2}
                value={settings.reminder_message ?? ''}
                onChange={(e) => setSettings({ ...settings, reminder_message: e.target.value })}
                placeholder={t('reminder_message_placeholder')}
                className={cn(
                  "w-full border rounded-xl px-3.5 py-2.5 text-sm font-medium resize-none focus:outline-none focus:border-amber-500 transition-colors",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                )}
              />
              <p className="text-[11px] text-zinc-500">
                {t('reminder_message_hint')}
              </p>
            </div>
          </section>

          {/* Service Fee Configuration Section */}
          <section className={cn("border rounded-2xl p-6 space-y-6", theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-200")}>
            <div className="flex items-center gap-3">
              <Percent className="w-5 h-5 text-blue-500" />
              <div>
                <h2 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t('pricing_config')}</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{t('service_fee_desc')}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="flex flex-wrap gap-2">
                {['0', '5', '10', '15'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSettings({ ...settings, service_fee: preset })}
                    className={cn(
                      "px-4 py-2.5 rounded-xl font-mono font-bold text-sm border transition-colors tabular-nums cursor-pointer",
                      settings.service_fee === preset
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : (theme === 'dark' ? "bg-white/5 text-zinc-400 border-white/5 hover:text-white" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100")
                    )}
                  >
                    {preset}%
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-zinc-500">{t('service_fee')}:</label>
                <div className="relative w-28">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={settings.service_fee ?? '0'}
                    onChange={(e) => setSettings({ ...settings, service_fee: e.target.value })}
                    className={cn(
                      "w-full border rounded-xl pl-3 pr-8 py-2 text-sm font-mono font-bold tabular-nums focus:outline-none focus:border-blue-500",
                      theme === 'dark' ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-xs">%</span>
                </div>
              </div>
            </div>
          </section>

          <section className={cn("border rounded-2xl p-6 space-y-6", theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-200")}>
            <div className="flex items-center gap-3">
              <Sun className="w-5 h-5 text-amber-500" />
              <h2 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t('theme')}</h2>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => setTheme('light')}
                className={cn(
                  "flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-colors duration-150 border cursor-pointer",
                  theme === 'light' 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : (theme === 'dark' ? 'bg-white/5 text-zinc-400 border-transparent hover:text-white' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100')
                )}
              >
                <Sun className="w-4 h-4" />
                {t('light')}
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={cn(
                  "flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-colors duration-150 border cursor-pointer",
                  theme === 'dark' 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                )}
              >
                <Moon className="w-4 h-4" />
                {t('dark')}
              </button>
            </div>
          </section>

          <section className={cn("border rounded-2xl p-6 space-y-6", theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-200")}>
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-emerald-500" />
              <h2 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t('report_password')}</h2>
            </div>
            <button
              onClick={() => setIsReportPasswordModalOpen(true)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors duration-150 text-xs border cursor-pointer",
                theme === 'dark' ? "bg-emerald-600/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-600/20" : "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100"
              )}
            >
              <KeyRound className="w-4 h-4" />
              {t('change_password')}
            </button>
          </section>

          <section className={cn("border rounded-2xl p-6 space-y-6", theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-200")}>
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-blue-500" />
              <h2 className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{t('language')}</h2>
            </div>
            
            <div className="flex flex-wrap gap-4">
              {['az', 'en', 'ru'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSettings({...settings, language: lang})}
                  className={cn(
                    "px-6 py-2.5 rounded-xl font-bold transition-colors duration-150 border cursor-pointer",
                    settings.language === lang 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : (theme === 'dark' ? 'bg-white/5 text-zinc-400 border-transparent hover:text-white' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100')
                  )}
                >
                  {lang === 'az' ? 'Azərbaycan' : lang === 'en' ? 'English' : 'Русский'}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <div className={cn(
            "border rounded-2xl p-6 space-y-4",
            theme === 'dark' ? "bg-blue-600/10 border-blue-600/20" : "bg-blue-50/50 border-blue-200"
          )}>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-blue-500" />
              <h3 className={cn("font-bold text-sm", theme === 'dark' ? "text-white" : "text-blue-900")}>{t('license_info')}</h3>
            </div>
            <p className={cn("text-xs leading-relaxed", theme === 'dark' ? "text-zinc-400" : "text-slate-600")}>
              {t('license_desc')}
            </p>
            <div className="pt-2">
              <span className="text-xs font-semibold text-blue-500">{t('system_live')}</span>
            </div>
          </div>

          <div className={cn(
            "border rounded-2xl p-6 space-y-4",
            theme === 'dark' ? "bg-[#141414] border-white/5" : "bg-white border-slate-200"
          )}>
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-zinc-500" />
              <h3 className={cn("font-bold text-sm", theme === 'dark' ? "text-white" : "text-slate-900")}>{t('about')}</h3>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Magify {t('version')} 2.0.0<br />
              {t('magify_desc')}<br />
              © 2026 {t('developer')}: Professional Management Systems.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
