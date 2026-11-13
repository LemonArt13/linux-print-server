import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Grid, IconButton, Paper, Snackbar, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { api } from './api';
import { commonStyles as s } from './styles';
import { displayFileName } from './fileName';
import { statusLabels, type PrintJob, type PrinterState } from './types';
const formatDate = (date: string): string => new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
const idsKey = 'printflow-document-ids';
function savedIds(): string[] {
  try { const value: unknown = JSON.parse(sessionStorage.getItem(idsKey) || '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(-100) : []; }
  catch { return []; }
}
export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [ids, setIds] = useState(savedIds);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [server, setServer] = useState<PrinterState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const load = useCallback(async (): Promise<void> => {
    try { const [records, health] = await Promise.all([api.jobs(ids), api.health()]); setJobs(records); setServer(health); }
    catch { setServer({ status: 'offline', printingEnabled: false, message: 'Сервер недоступний' }); }
  }, [ids]);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 15000); return () => clearInterval(timer); }, [load]);
  const chooseFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (selected.length > 10) { setNotice({ type: 'warning', text: 'Можна вибрати максимум 10 файлів.' }); return; }
    if (selected.some((file) => file.size > 10 * 1024 * 1024)) { setNotice({ type: 'warning', text: 'Розмір файлу не може перевищувати 10 МБ.' }); return; }
    if (selected.some((file) => file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) { setNotice({ type: 'warning', text: 'Дозволено лише PDF-файли.' }); return; }
    setFiles(selected);
  };
  const submit = async (): Promise<void> => {
    if (!files.length || busy) return;
    setBusy(true);
    try {
      const result = await api.upload(files);
      const nextIds = [...ids, ...result.jobs.map((job) => job.id)].slice(-100);
      sessionStorage.setItem(idsKey, JSON.stringify(nextIds)); setIds(nextIds); setFiles([]);
      setNotice({ type: 'success', text: `Документів збережено: ${result.jobs.length}. Фізичний друк не виконується.` });
    } catch (error) { setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Сталася помилка.' }); }
    finally { setBusy(false); }
  };
  return <>
    <Box sx={s.pageHeader}><Box><Typography variant="h4" sx={s.pageTitle}>Завантаження документів</Typography><Typography sx={s.pageSubtitle}>Збережіть PDF на сервері для майбутнього друку.</Typography></Box><Chip sx={s.statusChip} label={server?.status === 'ready' ? 'Сервер доступний' : 'Немає зв’язку'} color={server?.status === 'ready' ? 'success' : 'default'} variant="outlined" /></Box>
    <Grid container spacing={2.5} sx={s.homeGrid}>
      <Grid size={{ xs: 12, md: 7 }}><Paper sx={s.panel}><Typography variant="h6" sx={s.panelTitle}>Нові документи</Typography><Typography variant="body2" sx={s.panelDescription}>Оберіть до 10 PDF-файлів розміром до 10 МБ кожен.</Typography>
        <Box sx={s.uploadZone}><CloudUploadOutlinedIcon sx={s.uploadIcon} /><Typography sx={s.uploadTitle}>Оберіть PDF-файли</Typography><Typography variant="body2" sx={s.uploadNote}>Файли буде збережено й зареєстровано в історії.</Typography><Button component="label" variant="contained" disabled={busy}>Вибрати файли<input hidden type="file" accept="application/pdf,.pdf" multiple onChange={chooseFiles} /></Button></Box>
        {files.length > 0 && <Stack sx={s.fileList}>{files.map((file, index) => <Box sx={s.fileItem} key={`${file.name}-${index}`}><DescriptionOutlinedIcon color="action" fontSize="small" /><Typography variant="body2" sx={s.fileName}>{file.name}</Typography><IconButton size="small" disabled={busy} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} aria-label="Прибрати файл"><CloseRoundedIcon fontSize="small" /></IconButton></Box>)}</Stack>}
        <Button sx={s.queueSubmit} variant="contained" size="large" disabled={busy || !files.length} onClick={() => void submit()}>{busy ? <CircularProgress size={20} color="inherit" /> : `Завантажити${files.length ? ` (${files.length})` : ''}`}</Button>
      </Paper></Grid>
      <Grid size={{ xs: 12, md: 5 }}><Paper sx={[s.panel, s.systemPanel]}><Box><Typography variant="overline" sx={s.systemLabel}>СТАН СИСТЕМИ</Typography><Typography variant="h3" sx={s.systemValue}>{jobs.filter((job) => job.status === 'awaiting_setup').length}</Typography><Typography sx={s.systemDescription}>ваших документів очікують налаштування друку</Typography></Box><Box sx={s.systemBottom}><Alert severity="info">Фізичний принтер ще не підключено. Документи не надсилаються на друк.</Alert><Typography variant="body2" sx={s.systemDescription}>{server?.message || 'Перевірка стану сервера…'}</Typography></Box></Paper></Grid>
    </Grid>
    <Paper sx={[s.panel, s.panelTable]}><Box sx={s.tableHeading}><Typography variant="h6" sx={s.panelTitle}>Ваші документи</Typography><Typography variant="body2" sx={s.tableSubheading}>Останні 100 документів цієї вкладки. Повна історія доступна адміністратору.</Typography></Box><Box sx={s.tableScroll}><Table sx={s.jobsTable}><TableHead><TableRow><TableCell>Документ</TableCell><TableCell>Завантажено</TableCell><TableCell>Статус</TableCell></TableRow></TableHead><TableBody>
      {jobs.length ? jobs.map((job) => <TableRow key={job.id} hover><TableCell><Box sx={s.fileCell}><DescriptionOutlinedIcon color="action" fontSize="small" />{displayFileName(job.fileName)}</Box></TableCell><TableCell>{formatDate(job.createdAt)}</TableCell><TableCell><Chip label={statusLabels[job.status] || 'Невідомий статус'} color={job.status === 'error' ? 'error' : 'warning'} size="small" variant="outlined" /></TableCell></TableRow>) : <TableRow><TableCell colSpan={3} align="center" sx={s.emptyCell}>Ви ще не завантажили документи в цій вкладці.</TableCell></TableRow>}
    </TableBody></Table></Box></Paper>
    <Snackbar open={Boolean(notice)} autoHideDuration={5000} onClose={() => setNotice(null)}>{notice ? <Alert severity={notice.type} onClose={() => setNotice(null)}>{notice.text}</Alert> : undefined}</Snackbar>
  </>;
}
