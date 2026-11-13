import { commonStyles } from './styles';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, Grid, InputLabel, MenuItem, Paper, Select, Snackbar, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import LoginIcon from '@mui/icons-material/Login';
import { api, ApiError } from './api';
import { displayFileName } from './fileName';
import { statusLabels, type HistoryRecord, type Settings } from './types';

const tokenKey = 'print-admin-token';
const formatDate = (date: string): string => new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
const initialSettings: Settings = { autoCleanup: false, retentionDays: 30 };

export default function Admin() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(tokenKey));
  const [password, setPassword] = useState('');
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const load = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      const [recordsResponse, settingsResponse] = await Promise.all([api.admin('/history', token), api.admin('/settings', token)]);
      setHistory(await recordsResponse.json() as HistoryRecord[]);
      setSettings(await settingsResponse.json() as Settings);
    } catch (error) { if (error instanceof ApiError && error.status === 401) { sessionStorage.removeItem(tokenKey); setToken(null); } setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Сталася помилка.' }); }
  }, [token]);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 15000); return () => clearInterval(timer); }, [load]);
  const login = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    try { const result = await api.login(password); sessionStorage.setItem(tokenKey, result.token); setToken(result.token); setPassword(''); }
    catch (error) { setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Сталася помилка.' }); }
  };
  const logout = async (): Promise<void> => {
    if (!token) return;
    try { await api.admin('/logout', token, { method: 'POST' }); sessionStorage.removeItem(tokenKey); setToken(null); setHistory([]); }
    catch (error) { if (error instanceof ApiError && error.status === 401) { sessionStorage.removeItem(tokenKey); setToken(null); } else setNotice({ type: 'error', text: 'Не вдалося відкликати сесію. Спробуйте ще раз.' }); }
  };
  const saveSettings = async (next: Settings): Promise<void> => {
    if (!token) return;
    try { const response = await api.admin('/settings', token, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }); setSettings(await response.json() as Settings); setNotice({ type: 'success', text: 'Налаштування збережено.' }); }
    catch (error) { setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Сталася помилка.' }); }
  };
  const clear = async (): Promise<void> => {
    if (!token) return;
    try { await api.admin('/history', token, { method: 'DELETE' }); setHistory([]); setConfirm(false); setNotice({ type: 'success', text: 'Історію очищено.' }); }
    catch (error) { setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Сталася помилка.' }); }
  };
  const download = async (): Promise<void> => {
    if (!token) return;
    try { const response = await api.admin('/history/download', token); const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = 'print-history.txt'; link.click(); URL.revokeObjectURL(url); }
    catch (error) { setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Сталася помилка.' }); }
  };
  if (!token) return <Box sx={commonStyles.adminLogin}><Paper sx={[commonStyles.panel, commonStyles.adminLoginPanel]}><Typography variant="h5" sx={commonStyles.panelTitle} gutterBottom>Вхід адміністратора</Typography><Typography sx={commonStyles.panelDescription}>Введіть пароль для доступу до історії та налаштувань.</Typography><Box component="form" onSubmit={(event: FormEvent<HTMLFormElement>) => void login(event)}><TextField fullWidth autoFocus label="Пароль" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /><Button fullWidth type="submit" variant="contained" startIcon={<LoginIcon />} sx={commonStyles.queueSubmit}>Увійти</Button></Box></Paper><Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice(null)}>{notice ? <Alert severity={notice.type}>{notice.text}</Alert> : undefined}</Snackbar></Box>;
  return <>
    <Box sx={commonStyles.pageHeader}><Box><Typography variant="h4" sx={commonStyles.pageTitle}>Адміністрування</Typography><Typography sx={commonStyles.pageSubtitle}>Історія завдань та параметри зберігання даних.</Typography></Box><Button sx={commonStyles.adminLogout} size="small" onClick={() => void logout()}>Вийти</Button></Box>
    <Grid container spacing={2.5} sx={commonStyles.adminGrid}><Grid size={{ xs: 12, md: 6 }}><Paper sx={commonStyles.panel}><Typography variant="h6" sx={commonStyles.panelTitle}>Автоматичне очищення</Typography><Box sx={commonStyles.fileItem}><Typography variant="body2" sx={commonStyles.fileName}>Видаляти застарілі записи</Typography><Switch checked={settings.autoCleanup} onChange={(event) => void saveSettings({ ...settings, autoCleanup: event.target.checked })} /></Box><FormControl fullWidth disabled={!settings.autoCleanup}><InputLabel>Термін зберігання</InputLabel><Select label="Термін зберігання" value={settings.retentionDays} onChange={(event) => void saveSettings({ ...settings, retentionDays: Number(event.target.value) as Settings['retentionDays'] })}>{[7, 30, 90].map((days) => <MenuItem value={days} key={days}>{days} днів</MenuItem>)}</Select></FormControl></Paper></Grid>
    <Grid size={{ xs: 12, md: 6 }}><Paper sx={commonStyles.panel}><Typography variant="h6" sx={commonStyles.panelTitle}>Керування історією</Typography><Typography sx={commonStyles.panelDescription}>У файлі збережено: {history.length} записів</Typography><Box sx={commonStyles.adminCardActions}><Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => void download()}>Завантажити TXT</Button><Button color="error" variant="outlined" startIcon={<DeleteSweepIcon />} onClick={() => setConfirm(true)}>Очистити історію</Button></Box></Paper></Grid></Grid>
    <Paper sx={[commonStyles.panel, commonStyles.panelTable]}><Box sx={commonStyles.tableHeading}><Typography variant="h6" sx={commonStyles.panelTitle}>Історія документів</Typography></Box><Box sx={commonStyles.tableScroll}><Table sx={commonStyles.adminTable}><TableHead><TableRow><TableCell>Документ</TableCell><TableCell>Статус</TableCell><TableCell>Надіслано</TableCell><TableCell>Зареєстровано</TableCell></TableRow></TableHead><TableBody>{history.length ? history.map((record) => <TableRow key={`${record.id}-${record.finishedAt}`} hover><TableCell>{displayFileName(record.fileName)}</TableCell><TableCell>{statusLabels[record.status] || 'Невідомий статус'}{record.message && <Typography variant="caption" display="block">{record.message}</Typography>}</TableCell><TableCell>{formatDate(record.createdAt)}</TableCell><TableCell>{formatDate(record.finishedAt)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} align="center" sx={commonStyles.emptyCell}>Історія порожня.</TableCell></TableRow>}</TableBody></Table></Box></Paper>
    <Dialog open={confirm} onClose={() => setConfirm(false)}><DialogTitle>Очистити історію?</DialogTitle><DialogContent><DialogContentText>Будуть видалені всі записи історії документів. Збережені PDF-файли залишаться на сервері.</DialogContentText></DialogContent><DialogActions><Button onClick={() => setConfirm(false)}>Скасувати</Button><Button color="error" onClick={() => void clear()}>Очистити</Button></DialogActions></Dialog>
    <Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice(null)}>{notice ? <Alert severity={notice.type} onClose={() => setNotice(null)}>{notice.text}</Alert> : undefined}</Snackbar>
  </>;
}
