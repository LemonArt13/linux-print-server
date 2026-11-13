import type { CSSObject } from '@mui/styled-engine';
import { createTheme, type Theme } from '@mui/material/styles';

export const theme = createTheme({
  palette: { primary: { main: '#4f46e5' }, background: { default: '#f8fafc', paper: '#ffffff' }, text: { primary: '#0f172a', secondary: '#64748b' } },
  shape: { borderRadius: 14 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 10, textTransform: 'none', fontWeight: 600 } } },
    MuiTableCell: { styleOverrides: { head: { color: '#64748b', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', backgroundColor: '#f8fafc' } } },
  },
});

export const globalStyles: CSSObject = { body: { margin: 0, minWidth: 320 }, '*': { boxSizing: 'border-box' } };

export const commonStyles = {
  adminGrid: (theme: Theme) => ({ marginBottom: theme.spacing(4) }),
  appHeader: (theme: Theme) => ({ background: '#0f172a', borderBottom: '1px solid rgba(255, 255, 255, .08)', boxShadow: 'none' }),
  appToolbar: (theme: Theme) => ({ minHeight: '68px', gap: '6px' }),
  brandMark: (theme: Theme) => ({ width: 34, height: 34, display: 'grid', placeItems: 'center', marginRight: '10px', borderRadius: '2px', background: theme.palette.primary.main }),
  brandName: (theme: Theme) => ({ flexGrow: 1, fontWeight: '700', letterSpacing: '-.01em' }),
  navButton: (theme: Theme) => ({ minWidth: '0', padding: '6px 12px', color: '#fff', '&.active': { background: 'rgba(255,255,255,.12)' } }),
  mainContainer: (theme: Theme) => ({ paddingTop: '40px', paddingBottom: '40px', [theme.breakpoints.down('sm')]: { paddingTop: '24px', paddingBottom: '24px' } }),
  pageHeader: (theme: Theme) => ({ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', marginBottom: '32px' }),
  pageTitle: (theme: Theme) => ({ marginBottom: '6px', fontWeight: '750', letterSpacing: '-.04em', [theme.breakpoints.down('sm')]: { fontSize: '2rem' } }),
  pageSubtitle: (theme: Theme) => ({ color: theme.palette.text.secondary }),
  statusChip: (theme: Theme) => ({ marginBottom: '2px' }),
  homeGrid: (theme: Theme) => ({ marginBottom: '32px' }),
  panel: (theme: Theme) => ({ height: '100%', padding: '24px', border: '1px solid #e8edf3', borderRadius: '16px', boxShadow: '0 1px 2px rgba(15, 23, 42, .03)', [theme.breakpoints.down('sm')]: { padding: '18px' } }),
  panelTitle: (theme: Theme) => ({ fontWeight: '700' }),
  panelDescription: (theme: Theme) => ({ marginTop: '4px', marginBottom: '20px', color: theme.palette.text.secondary }),
  uploadZone: (theme: Theme) => ({ padding: '28px', textAlign: 'center', border: '1.5px dashed #a5b4fc', borderRadius: '3px', background: '#f7f7ff' }),
  uploadIcon: (theme: Theme) => ({ marginBottom: '8px', fontSize: '32px', color: theme.palette.primary.main }),
  uploadTitle: (theme: Theme) => ({ fontWeight: '650' }),
  uploadNote: (theme: Theme) => ({ marginTop: '4px', marginBottom: '14px', color: theme.palette.text.secondary }),
  fileList: (theme: Theme) => ({ display: 'grid', gap: '8px', marginTop: '16px' }),
  fileItem: (theme: Theme) => ({ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: theme.palette.background.default, borderRadius: '2px' }),
  fileName: (theme: Theme) => ({ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
  queueSubmit: (theme: Theme) => ({ width: '100%', marginTop: '20px' }),
  systemPanel: (theme: Theme) => ({ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }),
  systemLabel: (theme: Theme) => ({ color: theme.palette.text.secondary, fontWeight: '700' }),
  systemValue: (theme: Theme) => ({ marginTop: '8px', fontWeight: '750', letterSpacing: '-.05em' }),
  systemDescription: (theme: Theme) => ({ color: theme.palette.text.secondary }),
  systemBottom: (theme: Theme) => ({ paddingTop: '24px' }),
  statusTrack: (theme: Theme) => ({ height: 6, marginBottom: '10px', overflow: 'hidden', borderRadius: '99px', background: '#dcfce7' }),
  statusIndicator: (theme: Theme) => ({ width: '38%', height: '100%', borderRadius: 'inherit', background: '#22c55e' }),
  panelTable: (theme: Theme) => ({ overflow: 'hidden', padding: '0px' }),
  tableHeading: (theme: Theme) => ({ padding: '20px 24px 12px', [theme.breakpoints.down('sm')]: { padding: '18px 18px 10px' } }),
  tableSubheading: (theme: Theme) => ({ marginTop: '2px', color: theme.palette.text.secondary }),
  tableScroll: (theme: Theme) => ({ overflowX: 'auto' }),
  jobsTable: (theme: Theme) => ({ minWidth: 620 }),
  fileCell: (theme: Theme) => ({ display: 'flex', alignItems: 'center', gap: '8px' }),
  emptyCell: (theme: Theme) => ({ padding: '48px', color: theme.palette.text.secondary }),
  adminLogin: (theme: Theme) => ({ maxWidth: 430, margin: '48px auto 0', [theme.breakpoints.down('sm')]: { marginTop: '16px' } }),
  adminLoginPanel: (theme: Theme) => ({ padding: '32px', [theme.breakpoints.down('sm')]: { padding: '24px' } }),
  adminCardActions: (theme: Theme) => ({ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }),
  adminLogout: (theme: Theme) => ({ alignSelf: 'flex-start' }),
  adminTable: (theme: Theme) => ({ minWidth: 650 }),
};
