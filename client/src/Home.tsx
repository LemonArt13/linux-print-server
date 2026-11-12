import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Grid, IconButton, Paper, Snackbar, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { api } from './api';
import { displayFileName } from './fileName';
import type { JobStatus, PrintJob, PrinterState } from './types';

const statusMap: Record<JobStatus, [string, 'warning' | 'primary' | 'success' | 'error' | 'default']> = {
  queued: ['У черзі', 'warning'], printing: ['Друкується', 'primary'], completed: ['Завершено', 'success'], error: ['Помилка', 'error'], cancelled: ['Скасовано', 'default'],
};
const formatDate = (date: string): string => new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [printer, setPrinter] = useState<PrinterState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const load = useCallback(async (): Promise<void> => {
    try { setJobs(await api.jobs()); setPrinter(await api.health()); }
    catch { setPrinter({ printer: 'offline', message: 'Сервер недоступний' }); }
  }, []);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 1500); return () => clearInterval(timer); }, [load]);

  const chooseFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const selected = Array.from(event.target.files || []);
    if (selected.length > 10) { setNotice({ type: 'warning', text: 'Можна вибрати максимум 10 файлів.' }); return; }
    setFiles(selected);
  };
  const removeFile = (index: number): void => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  const submit = async (): Promise<void> => {
    if (!files.length) { setNotice({ type: 'warning', text: 'Оберіть хоча б один PDF-файл.' }); return; }
    setBusy(true);
    try { const result = await api.upload(files); setFiles([]); await load(); setNotice({ type: 'success', text: `До черги додано документів: ${result.jobs.length}.` }); }
    catch (error) { setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Сталася помилка.' }); }
    finally { setBusy(false); }
  };
  const cancel = async (id: string): Promise<void> => {
    try { await api.cancel(id); await load(); }
    catch (error) { setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Сталася помилка.' }); }
  };
  const activeJobs = jobs.filter((job) => ['queued', 'printing'].includes(job.status)).length;
  const printerReady = printer?.printer === 'ready';

  return <>
    <Box className="page-header"><Box><Typography variant="h4" className="page-title">Черга друку</Typography><Typography className="page-subtitle">Додайте документи та відстежуйте їхній стан у реальному часі.</Typography></Box><Chip className="status-chip" icon={<PrintOutlinedIcon />} label={printerReady ? 'Принтер готовий' : 'Принтер недоступний'} color={printerReady ? 'success' : 'default'} variant="outlined" /></Box>
    <Grid container spacing={2.5} className="home-grid">
      <Grid size={{ xs: 12, md: 7 }}><Paper className="panel"><Typography variant="h6" className="panel-title">Нові документи</Typography><Typography variant="body2" className="panel-description">Оберіть до 10 PDF-файлів розміром до 10 МБ кожен.</Typography>
        <Box className="upload-zone"><CloudUploadOutlinedIcon className="upload-icon" /><Typography className="upload-title">Оберіть PDF-файли</Typography><Typography variant="body2" className="upload-note">Файли будуть послідовно додані до черги.</Typography><Button component="label" variant="contained">Вибрати файли<input hidden type="file" accept="application/pdf,.pdf" multiple onChange={chooseFiles} /></Button></Box>
        {files.length > 0 && <Stack className="file-list">{files.map((file, index) => <Box className="file-item" key={`${file.name}-${file.lastModified}`}><DescriptionOutlinedIcon color="action" fontSize="small" /><Typography variant="body2" className="file-name">{file.name}</Typography><IconButton size="small" onClick={() => removeFile(index)} aria-label="Прибрати файл"><CloseRoundedIcon fontSize="small" /></IconButton></Box>)}</Stack>}
        <Button className="queue-submit" variant="contained" size="large" disabled={busy || !files.length} onClick={() => void submit()}>{busy ? <CircularProgress size={20} color="inherit" /> : `Додати до черги${files.length ? ` (${files.length})` : ''}`}</Button>
      </Paper></Grid>
      <Grid size={{ xs: 12, md: 5 }}><Paper className="panel system-panel"><Box><Typography variant="overline" className="system-label">СТАН СИСТЕМИ</Typography><Typography variant="h3" className="system-value">{activeJobs}</Typography><Typography className="system-description">активних завдань у черзі</Typography></Box><Box className="system-bottom"><Box className={`status-track${printerReady ? '' : ' offline'}`}><Box className="status-indicator" /></Box><Typography variant="body2" className="system-description">{printer?.message || 'Перевірка стану сервера…'}</Typography></Box></Paper></Grid>
    </Grid>
    <Paper className="panel panel-table"><Box className="table-heading"><Typography variant="h6" className="panel-title">Поточні завдання</Typography><Typography variant="body2" className="table-subheading">Оновлюється автоматично.</Typography></Box><Box className="table-scroll"><Table className="jobs-table"><TableHead><TableRow><TableCell>Документ</TableCell><TableCell>Додано</TableCell><TableCell>Статус</TableCell><TableCell align="right">Дія</TableCell></TableRow></TableHead><TableBody>
      {jobs.length ? jobs.map((job) => { const [label, color] = statusMap[job.status]; return <TableRow key={job.id} hover><TableCell><Box className="file-cell"><DescriptionOutlinedIcon color="action" fontSize="small" />{displayFileName(job.fileName)}</Box></TableCell><TableCell>{formatDate(job.createdAt)}</TableCell><TableCell><Chip label={label} color={color} size="small" variant="outlined" /></TableCell><TableCell align="right">{['queued', 'printing'].includes(job.status) && <Button size="small" color="error" onClick={() => void cancel(job.id)}>Скасувати</Button>}</TableCell></TableRow>; }) : <TableRow><TableCell colSpan={4} align="center" className="empty-cell">У черзі ще немає завдань.</TableCell></TableRow>}
    </TableBody></Table></Box></Paper>
    <Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice(null)}>{notice ? <Alert severity={notice.type} onClose={() => setNotice(null)}>{notice.text}</Alert> : undefined}</Snackbar>
  </>;
}
