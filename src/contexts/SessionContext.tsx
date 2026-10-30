import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Bell, RotateCcw, X, Crown, UtensilsCrossed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActiveSession, Table } from '../types';
import { apiFetch } from '../lib/api';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface ReminderConfig {
  minutes: number;
  message: string;
}

interface SessionContextType {
  sessions: Record<number, ActiveSession>;
  now: number;
  reminderConfig: ReminderConfig;
  startSession: (session: ActiveSession) => Promise<void>;
  updateSession: (session: ActiveSession) => Promise<void>;
  endSession: (tableId: number) => Promise<void>;
  refreshSessions: () => Promise<void>;
  refreshReminderConfig: () => Promise<void>;
  restartReminder: (tableId: number, customMinutes?: number) => Promise<void>;
  stopReminder: (tableId: number) => Promise<void>;
  testReminderSound: () => void;
  loading: boolean;
}

const DEFAULT_REMINDER_MESSAGE = 'Təyin olunan vaxt tamam oldu! Zəhmət olmasa masa ilə maraqlanın.';

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function formatCountdownMs(diffMs: number): string {
  const clampedSeconds = Math.max(0, Math.ceil(diffMs / 1000));
  const hrs = Math.floor(clampedSeconds / 3600);
  const mins = Math.floor((clampedSeconds % 3600) / 60);
  const secs = clampedSeconds % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();

  const [sessions, setSessions] = useState<Record<number, ActiveSession>>({});
  const [tablesMap, setTablesMap] = useState<Record<number, Table>>({});
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>({
    minutes: 40,
    message: DEFAULT_REMINDER_MESSAGE
  });
  const [now, setNow] = useState<number>(() => Date.now());
  const [loading, setLoading] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Unlock Web Audio API on first user interaction so timer chimes are never blocked
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContextClass();
        }
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      } catch {}
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const playReminderChime = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const notes = [587.33, 783.99, 1046.5, 783.99, 1046.5]; // D5 -> G5 -> C6 pleasant restaurant chime
      const startBase = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startBase + idx * 0.16);

        gain.gain.setValueAtTime(0.0001, startBase + idx * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.24, startBase + idx * 0.16 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, startBase + idx * 0.16 + 0.36);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startBase + idx * 0.16);
        osc.stop(startBase + idx * 0.16 + 0.38);
      });
    } catch (err) {
      console.error('Audio chime error:', err);
    }
  }, []);

  const refreshReminderConfig = useCallback(async () => {
    try {
      const [settingsRes, tablesRes] = await Promise.all([
        apiFetch('/api/settings'),
        apiFetch('/api/tables')
      ]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        const parsedMinutes = Math.max(1, parseInt(data.reminder_minutes || '40', 10) || 40);
        setReminderConfig({
          minutes: parsedMinutes,
          message: (data.reminder_message && String(data.reminder_message).trim()) || DEFAULT_REMINDER_MESSAGE
        });
      }
      if (tablesRes.ok) {
        const tablesData: Table[] = await tablesRes.json();
        const map: Record<number, Table> = {};
        tablesData.forEach(tb => {
          map[tb.id] = tb;
        });
        setTablesMap(map);
      }
    } catch (error) {
      console.error('Failed to fetch reminder config:', error);
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const res = await apiFetch('/api/active_sessions');
      if (res.ok) {
        const data: ActiveSession[] = await res.json();
        const sessionMap: Record<number, ActiveSession> = {};
        data.forEach(s => {
          sessionMap[s.tableId] = s;
        });
        setSessions(sessionMap);
      }
    } catch (error) {
      console.error('Failed to fetch active table orders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    refreshReminderConfig();
    refreshSessions();
  }, [isAuthenticated, refreshReminderConfig, refreshSessions]);

  const hasActiveReminders = React.useMemo(() => {
    return (Object.values(sessions) as ActiveSession[]).some(
      s => s.reminderEnabled && s.reminderEndTime && s.reminderEndTime > 0
    );
  }, [sessions]);

  useEffect(() => {
    if (!hasActiveReminders) return;
    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [hasActiveReminders]);

  const startSession = useCallback(async (session: ActiveSession) => {
    const res = await apiFetch('/api/active_sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
    if (res.ok) {
      setNow(Date.now());
      setSessions(prev => ({ ...prev, [session.tableId]: session }));
      refreshReminderConfig();
    } else {
      throw new Error('Failed to open table');
    }
  }, [refreshReminderConfig]);

  const updateSession = useCallback(async (session: ActiveSession) => {
    const res = await apiFetch(`/api/active_sessions/${session.tableId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
    if (res.ok) {
      setSessions(prev => ({ ...prev, [session.tableId]: session }));
    } else {
      throw new Error('Failed to update table order');
    }
  }, []);

  const endSession = useCallback(async (tableId: number) => {
    const res = await apiFetch(`/api/active_sessions/${tableId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      setSessions(prev => {
        const next = { ...prev };
        delete next[tableId];
        return next;
      });
    } else {
      throw new Error('Failed to close table order');
    }
  }, []);

  const restartReminder = useCallback(async (tableId: number, customMinutes?: number) => {
    const targetSession = sessions[tableId];
    if (!targetSession) return;
    const durationMins = customMinutes || reminderConfig.minutes || targetSession.reminderMinutes || 40;
    const updated: ActiveSession = {
      ...targetSession,
      reminderEnabled: true,
      reminderMinutes: durationMins,
      reminderEndTime: Date.now() + durationMins * 60 * 1000,
      reminderNotified: false
    };
    setNow(Date.now());
    await updateSession(updated);
    const tableName = tablesMap[tableId]?.name || `#${tableId}`;
    toast.success(t('reminder_restarted_toast', { table: tableName, minutes: durationMins }));
  }, [sessions, reminderConfig.minutes, updateSession, tablesMap, t]);

  const stopReminder = useCallback(async (tableId: number) => {
    const targetSession = sessions[tableId];
    if (!targetSession) return;
    const updated: ActiveSession = {
      ...targetSession,
      reminderEnabled: false,
      reminderEndTime: 0,
      reminderNotified: true
    };
    await updateSession(updated);
  }, [sessions, updateSession]);

  // Expired reminders that haven't been acknowledged yet
  const expiredSessions = React.useMemo(() => {
    return (Object.values(sessions) as ActiveSession[]).filter(
      s => s.reminderEnabled && s.reminderEndTime && s.reminderEndTime > 0 && now >= s.reminderEndTime && !s.reminderNotified
    );
  }, [sessions, now]);

  // Play repeating audio alert while at least one reminder is expired and unacknowledged
  useEffect(() => {
    if (expiredSessions.length === 0) return;
    playReminderChime();
    const repeatInterval = setInterval(() => {
      playReminderChime();
    }, 4000);
    return () => clearInterval(repeatInterval);
  }, [expiredSessions.length, playReminderChime]);

  const formatAlertMessage = (tableName: string, mins: number) => {
    const raw = reminderConfig.message || DEFAULT_REMINDER_MESSAGE;
    return raw
      .replace(/\{masa\}/gi, tableName)
      .replace(/\{table\}/gi, tableName)
      .replace(/\{deqiqe\}/gi, String(mins))
      .replace(/\{minutes\}/gi, String(mins));
  };

  const contextValue = React.useMemo(() => ({
    sessions,
    now,
    reminderConfig,
    startSession,
    updateSession,
    endSession,
    refreshSessions,
    refreshReminderConfig,
    restartReminder,
    stopReminder,
    testReminderSound: playReminderChime,
    loading
  }), [
    sessions,
    now,
    reminderConfig,
    startSession,
    updateSession,
    endSession,
    refreshSessions,
    refreshReminderConfig,
    restartReminder,
    stopReminder,
    playReminderChime,
    loading
  ]);

  const activeAlertSession = expiredSessions[0];
  const activeAlertTable = activeAlertSession ? tablesMap[activeAlertSession.tableId] : undefined;
  const activeAlertName = activeAlertTable?.name || (activeAlertSession ? `Masa #${activeAlertSession.tableId}` : '');
  const activeAlertMinutes = activeAlertSession?.reminderMinutes || reminderConfig.minutes || 40;
  const restartMinutes = reminderConfig.minutes || activeAlertMinutes;

  return (
    <SessionContext.Provider value={contextValue}>
      {children}

      {activeAlertSession && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className={cn(
            "w-full max-w-md rounded-3xl border p-6 shadow-2xl space-y-5 transition-colors",
            theme === 'dark' ? "bg-[#121214] border-amber-500/40 text-white" : "bg-white border-amber-300 text-slate-900"
          )}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  theme === 'dark' ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-600"
                )}>
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-500">
                    {t('reminder_alert_title')} · {activeAlertMinutes} {t('min_short')}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {activeAlertTable?.type === 'kabinet' ? (
                      <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : (
                      <UtensilsCrossed className="w-4 h-4 text-blue-500 shrink-0" />
                    )}
                    <h3 className="text-xl font-bold tracking-tight">{activeAlertName}</h3>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => stopReminder(activeAlertSession.tableId)}
                className={cn(
                  "p-2 rounded-xl transition-colors cursor-pointer",
                  theme === 'dark' ? "hover:bg-white/10 text-zinc-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                )}
                title={t('dismiss')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={cn(
              "p-4 rounded-2xl border text-sm font-medium leading-relaxed",
              theme === 'dark' ? "bg-white/[0.03] border-white/10 text-zinc-200" : "bg-slate-50 border-slate-200 text-slate-700"
            )}>
              {formatAlertMessage(activeAlertName, activeAlertMinutes)}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => restartReminder(activeAlertSession.tableId, restartMinutes)}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t('reminder_restart', { minutes: restartMinutes })}</span>
              </button>
              <button
                type="button"
                onClick={() => stopReminder(activeAlertSession.tableId)}
                className={cn(
                  "py-3 px-5 rounded-xl font-bold text-sm border transition-colors cursor-pointer whitespace-nowrap",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white"
                    : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                )}
              >
                {t('dismiss')}
              </button>
            </div>
          </div>
        </div>
      )}
    </SessionContext.Provider>
  );
};

export const useSessions = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSessions must be used within a SessionProvider');
  }
  return context;
};
