import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Save, 
  Check, 
  Download, 
  RotateCcw, 
  Calendar as CalendarIcon,
  Clock,
  FileText,
  Table as TableIcon,
  CheckSquare,
  Square
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { cn, getBakuBusinessDayDate, shiftBusinessDay, getBusinessDayRange } from '../lib/utils';
import { apiFetch } from '../lib/api';
import { DailyNoteRecord, DailyNoteRow } from '../types';
import { toast } from 'sonner';

export const DailyNotes: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();

  // Current active business day
  const todayBusinessDate = useMemo(() => getBakuBusinessDayDate(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayBusinessDate);

  // Data states
  const [generalNotes, setGeneralNotes] = useState<string>('');
  const [rows, setRows] = useState<DailyNoteRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  // Debounced auto-save timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const shiftRange = useMemo(() => getBusinessDayRange(selectedDate), [selectedDate]);
  const isToday = selectedDate === todayBusinessDate;

  // Format date display (Black & White style)
  const formatDateTitle = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      const locale = i18n.language === 'az' ? 'az-AZ' : i18n.language === 'ru' ? 'ru-RU' : 'en-US';
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'long',
        timeZone: 'UTC'
      }).format(dateObj);
    } catch {
      return dateStr;
    }
  };

  // Load notes for selected date
  const loadDailyNotes = useCallback(async (dateToLoad: string) => {
    setLoading(true);
    setHasUnsavedChanges(false);
    try {
      const res = await apiFetch(`/api/daily-notes?date=${dateToLoad}`);
      if (res.ok) {
        const data: DailyNoteRecord = await res.json();
        setGeneralNotes(data.general_notes || '');
        setRows(Array.isArray(data.rows) ? data.rows : []);
        setUpdatedAt(data.updated_at || null);
      } else {
        setGeneralNotes('');
        setRows([]);
        setUpdatedAt(null);
      }
    } catch (err) {
      console.error("Error fetching daily notes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDailyNotes(selectedDate);
  }, [selectedDate, loadDailyNotes]);

  // Save notes handler
  const saveNotes = async (customNotes?: string, customRows?: DailyNoteRow[], showToast = true) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    setIsSaving(true);
    const notesToSave = customNotes !== undefined ? customNotes : generalNotes;
    const rowsToSave = customRows !== undefined ? customRows : rows;

    try {
      const res = await apiFetch('/api/daily-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          general_notes: notesToSave,
          rows: rowsToSave
        })
      });

      if (res.ok) {
        setHasUnsavedChanges(false);
        setUpdatedAt(new Date().toISOString());
        if (showToast) {
          toast.success(t('all_changes_saved'));
        }
      }
    } catch (e) {
      console.error("Failed to save daily notes:", e);
      toast.error(t('error_update'));
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save trigger
  const triggerAutoSave = (updatedNotes: string, updatedRows: DailyNoteRow[]) => {
    setHasUnsavedChanges(true);
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      saveNotes(updatedNotes, updatedRows, false);
    }, 1000);
  };

  // Add new table row
  const handleAddRow = () => {
    const now = new Date();
    const bakuDate = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const hours = String(bakuDate.getUTCHours()).padStart(2, '0');
    const minutes = String(bakuDate.getUTCMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;

    const newRow: DailyNoteRow = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      time: currentTimeStr,
      category: 'general',
      title: '',
      note: '',
      amount: '',
      is_important: false,
      is_done: false,
      created_at: new Date().toISOString()
    };

    const newRows = [...rows, newRow];
    setRows(newRows);
    triggerAutoSave(generalNotes, newRows);
  };

  // Update specific row
  const handleUpdateRow = (id: string, updates: Partial<DailyNoteRow>) => {
    const newRows = rows.map(r => r.id === id ? { ...r, ...updates } : r);
    setRows(newRows);
    triggerAutoSave(generalNotes, newRows);
  };

  // Delete row
  const handleDeleteRow = (id: string) => {
    const newRows = rows.filter(r => r.id !== id);
    setRows(newRows);
    triggerAutoSave(generalNotes, newRows);
  };

  // Update general notes text
  const handleGeneralNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setGeneralNotes(val);
    triggerAutoSave(val, rows);
  };

  // Clear all notes for current day
  const handleClearDay = () => {
    setGeneralNotes('');
    setRows([]);
    setConfirmClear(false);
    saveNotes('', [], true);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [t('col_num'), t('col_time'), t('col_title'), t('col_note'), t('col_amount'), t('col_status')];
    const csvRows = rows.map((r, idx) => [
      idx + 1,
      r.time,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${(r.note || '').replace(/"/g, '""')}"`,
      `"${(r.amount || '').replace(/"/g, '""')}"`,
      r.is_done ? 'Bəli' : 'Xeyr'
    ]);

    const content = [
      `Gundelik Qeydler - ${selectedDate} (${shiftRange.startDate} 09:00 - ${shiftRange.endDate} 09:00)`,
      '',
      `[Umumi Qeydler / Notepad]:`,
      `"${(generalNotes || '').replace(/"/g, '""')}"`,
      '',
      `[Cedvel / Table]:`,
      headers.join(','),
      ...csvRows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob(["\ufeff" + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Daily_Notes_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isDark = theme === 'dark';

  return (
    <div id="daily-notes-page" className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Top Header & Business Day Navigation (Clean Black & White) */}
      <div className={cn(
        "border rounded-2xl p-5 md:p-6 transition-colors",
        isDark ? "bg-black border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900 shadow-xs"
      )}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Date & Shift Info */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight capitalize">
                {formatDateTitle(selectedDate)}
              </h1>
              {isToday && (
                <span className={cn(
                  "text-[11px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider",
                  isDark ? "border-zinc-700 bg-zinc-900 text-white" : "border-zinc-300 bg-zinc-100 text-zinc-800"
                )}>
                  {t('active_shift')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {shiftRange.startDate} 09:00 → {shiftRange.endDate} 09:00
              </span>
              <span>•</span>
              <span className={cn(
                "flex items-center gap-1",
                isSaving ? "text-zinc-400 italic" : hasUnsavedChanges ? "text-zinc-400" : "text-zinc-500"
              )}>
                {isSaving ? t('saving') : hasUnsavedChanges ? t('unsaved_changes') : (
                  <>
                    <Check className="w-3 h-3" />
                    {t('all_changes_saved')}
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Date Selector & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Prev Day */}
            <button
              type="button"
              id="btn-prev-day"
              title={t('prev_day')}
              onClick={() => setSelectedDate(prev => shiftBusinessDay(prev, -1))}
              className={cn(
                "p-2 rounded-xl border text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer",
                isDark ? "border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white" : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-900"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Today Button */}
            <button
              type="button"
              id="btn-today"
              onClick={() => setSelectedDate(todayBusinessDate)}
              className={cn(
                "px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer",
                isToday 
                  ? (isDark ? "bg-white text-black border-white" : "bg-black text-white border-black")
                  : (isDark ? "border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300" : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700")
              )}
            >
              {t('today_button')}
            </button>

            {/* Next Day */}
            <button
              type="button"
              id="btn-next-day"
              title={t('next_day')}
              onClick={() => setSelectedDate(prev => shiftBusinessDay(prev, 1))}
              className={cn(
                "p-2 rounded-xl border text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer",
                isDark ? "border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white" : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-900"
              )}
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Date Picker Input */}
            <input
              type="date"
              id="daily-notes-date-picker"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                }
              }}
              className={cn(
                "px-3 py-2 rounded-xl border text-xs font-mono font-medium outline-none cursor-pointer",
                isDark ? "bg-zinc-900 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-900"
              )}
            />

            {/* Save Button */}
            <button
              type="button"
              id="btn-save-notes"
              onClick={() => saveNotes(generalNotes, rows, true)}
              disabled={isSaving}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer",
                isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-black text-white hover:bg-zinc-800"
              )}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t('save_notes')}</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              id="btn-export-csv"
              onClick={handleExportCSV}
              title={t('export_excel')}
              className={cn(
                "p-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer",
                isDark ? "border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300" : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700"
              )}
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Clear Button */}
            {confirmClear ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleClearDay}
                  className="px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/15 text-red-500 hover:bg-red-500 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {t('delete')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className={cn(
                    "px-2.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer",
                    isDark ? "border-zinc-800 bg-zinc-900 text-zinc-400" : "border-zinc-200 bg-zinc-50 text-zinc-600"
                  )}
                >
                  {t('cancel')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                id="btn-clear-notes"
                onClick={() => setConfirmClear(true)}
                title={t('clear_day_notes')}
                className={cn(
                  "p-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer",
                  isDark ? "border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white" : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 hover:text-black"
                )}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: Split View (Table + Notepad) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side: Clean Excel-Style Notes Table */}
        <div className="lg:col-span-8 space-y-3">
          <div className={cn(
            "border rounded-2xl p-4 md:p-5 transition-colors",
            isDark ? "bg-black border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900 shadow-xs"
          )}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
              <div className="flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider">{t('notes_table_title')}</h2>
                <span className="text-xs text-zinc-500 font-mono">({rows.length})</span>
              </div>

              <button
                type="button"
                id="btn-add-table-row"
                onClick={handleAddRow}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer",
                  isDark ? "border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white" : "border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-900"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('add_row')}</span>
              </button>
            </div>

            {/* Minimal Spreadsheet Grid */}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={cn(
                    "border-b text-[11px] uppercase tracking-wider",
                    isDark ? "border-zinc-800 text-zinc-500" : "border-zinc-200 text-zinc-500"
                  )}>
                    <th className="py-2.5 px-2 w-8 text-center font-mono">#</th>
                    <th className="py-2.5 px-2 w-20">{t('col_time')}</th>
                    <th className="py-2.5 px-2 w-40">{t('col_title')}</th>
                    <th className="py-2.5 px-2">{t('col_note')}</th>
                    <th className="py-2.5 px-2 w-28">{t('col_amount')}</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                    <th className="py-2.5 px-2 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody className={cn("divide-y", isDark ? "divide-zinc-900" : "divide-zinc-100")}>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500">
                        <p className="text-xs">{t('no_entries_yet')}</p>
                        <button
                          type="button"
                          onClick={handleAddRow}
                          className={cn(
                            "mt-2.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer",
                            isDark ? "border-zinc-700 hover:bg-zinc-900 text-white" : "border-zinc-300 hover:bg-zinc-100 text-zinc-900"
                          )}
                        >
                          + {t('add_row')}
                        </button>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => (
                      <tr 
                        key={row.id}
                        className={cn(
                          "transition-colors",
                          row.is_done 
                            ? (isDark ? "opacity-40" : "opacity-50")
                            : (isDark ? "hover:bg-zinc-950" : "hover:bg-zinc-50")
                        )}
                      >
                        {/* Index */}
                        <td className="py-2 px-2 text-center font-mono text-zinc-500 text-[11px]">
                          {index + 1}
                        </td>

                        {/* Time */}
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={row.time}
                            onChange={(e) => handleUpdateRow(row.id, { time: e.target.value })}
                            placeholder="09:00"
                            className={cn(
                              "w-16 px-1.5 py-1 rounded border text-xs font-mono outline-none",
                              isDark ? "bg-zinc-900 border-zinc-800 text-white focus:border-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-zinc-400"
                            )}
                          />
                        </td>

                        {/* Title / Topic */}
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={row.title}
                            onChange={(e) => handleUpdateRow(row.id, { title: e.target.value })}
                            placeholder={t('col_title')}
                            className={cn(
                              "w-full px-2 py-1 rounded border text-xs font-medium outline-none",
                              row.is_done && "line-through text-zinc-500",
                              isDark ? "bg-zinc-900 border-zinc-800 text-white focus:border-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-zinc-400"
                            )}
                          />
                        </td>

                        {/* Note / Details */}
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => handleUpdateRow(row.id, { note: e.target.value })}
                            placeholder={t('col_note')}
                            className={cn(
                              "w-full px-2 py-1 rounded border text-xs outline-none",
                              row.is_done && "line-through text-zinc-500",
                              isDark ? "bg-zinc-900 border-zinc-800 text-white focus:border-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-zinc-400"
                            )}
                          />
                        </td>

                        {/* Amount / Extra */}
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={row.amount || ''}
                            onChange={(e) => handleUpdateRow(row.id, { amount: e.target.value })}
                            placeholder="0 AZN"
                            className={cn(
                              "w-full px-2 py-1 rounded border text-xs font-mono outline-none",
                              isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300 focus:border-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-zinc-400"
                            )}
                          />
                        </td>

                        {/* Status Checkbox */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleUpdateRow(row.id, { is_done: !row.is_done })}
                            className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
                            title={row.is_done ? "Tamamlandı" : "İcrada"}
                          >
                            {row.is_done ? (
                              <CheckSquare className="w-4 h-4 text-zinc-300" />
                            ) : (
                              <Square className="w-4 h-4 text-zinc-600" />
                            )}
                          </button>
                        </td>

                        {/* Delete Row */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
                            title={t('delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Add Row */}
            {rows.length > 0 && (
              <div className="pt-3 border-t border-zinc-800/40 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className={cn(
                    "text-xs font-medium text-zinc-500 hover:text-white transition-colors flex items-center gap-1 cursor-pointer",
                    !isDark && "text-zinc-600 hover:text-black"
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('add_row')}</span>
                </button>

                <span className="text-[11px] text-zinc-600 font-mono">
                  {updatedAt ? `${t('last_saved')}: ${new Date(updatedAt).toLocaleTimeString()}` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Digital Notebook Memo */}
        <div className="lg:col-span-4 space-y-3">
          <div className={cn(
            "border rounded-2xl p-4 md:p-5 transition-colors flex flex-col h-full min-h-[420px]",
            isDark ? "bg-black border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900 shadow-xs"
          )}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider">{t('general_memo_title')}</h3>
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {generalNotes.length} simvol
              </span>
            </div>

            {/* Digital Notebook Text Area */}
            <textarea
              value={generalNotes}
              onChange={handleGeneralNotesChange}
              placeholder={t('memo_placeholder')}
              className={cn(
                "w-full flex-1 mt-3 p-3 rounded-xl border text-xs font-sans leading-relaxed outline-none resize-none min-h-[340px]",
                isDark 
                  ? "bg-zinc-950 border-zinc-800/80 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-700" 
                  : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyNotes;
