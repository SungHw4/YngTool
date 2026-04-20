import React from 'react'
import { AppProvider, useApp } from './store/AppContext'
import CommitPanel from './components/CommitPanel'
import IssuePanel from './components/IssuePanel'
import StatusPanel from './components/StatusPanel'
import TokenUsagePanel from './components/TokenUsagePanel'
import CodeReviewModal from './components/CodeReviewModal'
import SettingsPage from './pages/SettingsPage'
import SchedulePage from './pages/SchedulePage'
import WeeklySummaryPage from './pages/WeeklySummaryPage'

// ─── 사이드바 아이콘 ──────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard', icon: '⊞', label: '대시보드' },
  { id: 'commits',   icon: '⎇', label: '커밋 로그' },
  { id: 'issues',    icon: '◈', label: '이슈' },
  { id: 'tokens',    icon: '◉', label: 'AI 사용량' },
  { id: 'schedule',  icon: '▦', label: '일정표' },
  { id: 'summary',   icon: '☰', label: '주간 요약' },
  { id: 'settings',  icon: '⚙', label: '설정', bottom: true },
]

function Sidebar() {
  const { state, dispatch } = useApp()
  const top = NAV_ITEMS.filter(n => !n.bottom)
  const bot = NAV_ITEMS.filter(n => n.bottom)

  const btn = (item) => (
    <button
      key={item.id}
      title={item.label}
      style={{
        ...styles.navBtn,
        ...(state.activeTab === item.id ? styles.navBtnActive : {}),
      }}
      onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: item.id })}
    >
      {item.icon}
    </button>
  )

  return (
    <div style={styles.sidebar}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {top.map(btn)}
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {bot.map(btn)}
      </div>
    </div>
  )
}

// ─── 커스텀 타이틀바 ──────────────────────────────────────────────
function TitleBar() {
  return (
    <div style={styles.titlebar}>
      <span style={styles.appName}>YngTool</span>
      <div style={styles.winControls}>
        <button style={styles.winBtn} onClick={() => window.electronAPI?.windowMinimize()}>─</button>
        <button style={styles.winBtn} onClick={() => window.electronAPI?.windowMaximize()}>□</button>
        <button style={{ ...styles.winBtn, ...styles.winBtnClose }} onClick={() => window.electronAPI?.windowClose()}>✕</button>
      </div>
    </div>
  )
}

// ─── 대시보드 메인 뷰 ─────────────────────────────────────────────
function DashboardView() {
  return (
    <div style={styles.dashGrid}>
      <PanelCard title="SVN / Git 커밋 로그" hint="우클릭 → AI 코드 리뷰">
        <CommitPanel />
      </PanelCard>
      <PanelCard title="이슈">
        <IssuePanel />
      </PanelCard>
      <PanelCard title="AI 토큰 사용량">
        <TokenUsagePanel />
      </PanelCard>
      <PanelCard title="연결 상태">
        <StatusPanel />
      </PanelCard>
    </div>
  )
}

function PanelCard({ title, hint, children, span = 1 }) {
  return (
    <div style={{ ...styles.card, gridColumn: `span ${span}` }}>
      <div style={styles.cardHeader}>
        <span style={styles.cardTitle}>{title}</span>
        {hint && <span style={styles.cardHint}>{hint}</span>}
      </div>
      <div style={styles.cardBody}>{children}</div>
    </div>
  )
}

// ─── 메인 앱 ─────────────────────────────────────────────────────
function AppShell() {
  const { state } = useApp()

  const renderContent = () => {
    switch (state.activeTab) {
      case 'dashboard': return <DashboardView />
      case 'commits':   return <div style={styles.fullPanel}><CommitPanel /></div>
      case 'issues':    return <div style={styles.fullPanel}><IssuePanel /></div>
      case 'tokens':    return <div style={styles.fullPanel}><TokenUsagePanel /></div>
      case 'schedule':  return <SchedulePage />
      case 'summary':   return <WeeklySummaryPage />
      case 'settings':  return <SettingsPage />
      default:          return <DashboardView />
    }
  }

  return (
    <div style={styles.shell}>
      <TitleBar />
      <div style={styles.body}>
        <Sidebar />
        <main style={styles.main}>
          {renderContent()}
        </main>
      </div>
      <CodeReviewModal />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}

// ─── 스타일 ───────────────────────────────────────────────────────
const styles = {
  shell: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: '#141414', color: '#ccc',
    fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif",
    userSelect: 'none',
  },
  titlebar: {
    height: 38, background: '#1a1a1a', borderBottom: '1px solid #2a2a2a',
    display: 'flex', alignItems: 'center', paddingLeft: 14,
    WebkitAppRegion: 'drag',    // Electron: 드래그로 창 이동
    flexShrink: 0,
  },
  appName: { fontSize: 12, fontWeight: 600, color: '#666', letterSpacing: '.08em' },
  winControls: {
    marginLeft: 'auto', display: 'flex',
    WebkitAppRegion: 'no-drag', // 버튼은 클릭 가능
  },
  winBtn: {
    width: 40, height: 38, background: 'none', border: 'none',
    color: '#555', fontSize: 12, cursor: 'pointer',
  },
  winBtnClose: { color: '#844' },

  body: { display: 'flex', flex: 1, overflow: 'hidden' },

  sidebar: {
    width: 48, background: '#1a1a1a', borderRight: '1px solid #2a2a2a',
    display: 'flex', flexDirection: 'column', padding: '8px 0 8px',
    flexShrink: 0,
  },
  navBtn: {
    width: 40, height: 38, background: 'none', border: 'none',
    color: '#555', fontSize: 15, cursor: 'pointer', borderRadius: 6,
    margin: '0 4px', transition: '.15s', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnActive: { background: '#1a3050', color: '#7ac' },

  main: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },

  dashGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    gap: 1, flex: 1, background: '#2a2a2a', overflow: 'hidden',
  },
  card: {
    background: '#161616', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  cardHeader: {
    padding: '8px 12px', borderBottom: '1px solid #2a2a2a',
    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
  },
  cardTitle: { fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '.06em' },
  cardHint:  { fontSize: 10, color: '#3a3a3a', marginLeft: 'auto' },
  cardBody:  { flex: 1, overflow: 'hidden' },

  fullPanel: { flex: 1, overflow: 'hidden' },
}
