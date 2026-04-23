import React, { useState, useRef, useEffect, useCallback, memo, createContext, useContext } from 'react'
import { AppProvider, useApp } from './store/AppContext'
import CommitPanel from './components/CommitPanel'
import IssuePanel from './components/IssuePanel'
import StatusPanel from './components/StatusPanel'
import TokenUsagePanel from './components/TokenUsagePanel'
import CodeReviewModal from './components/CodeReviewModal'
import SettingsPage from './pages/SettingsPage'
import SchedulePage from './pages/SchedulePage'
import WeeklySummaryPage from './pages/WeeklySummaryPage'
import NotificationPanel from './components/NotificationPanel'
import GmailPanel from './components/GmailPanel'
import GmailPreviewPanel from './components/GmailPreviewPanel'

// 패널에서 페이지 이동에 사용할 Context
export const NavContext = createContext(null)

// ─── 상수 ─────────────────────────────────────────────────────────
const SNAP_THRESHOLD = 14   // px — 이 거리 이내면 스냅
const GRID            = 20  // px — 스냅 없을 때 그리드 정렬
const MIN_W           = 240 // 최소 패널 너비
const MIN_H           = 160 // 최소 패널 높이

// ─── 스냅 계산 ────────────────────────────────────────────────────
// rawX/Y: 드래그 중 마우스 위치에서 계산한 패널 좌상단
// 반환: 스냅된 x/y + 가이드라인 목록
function computeSnap(rawX, rawY, w, h, canvasEl, others) {
  if (!canvasEl) return { x: rawX, y: rawY, guides: [] }
  const cW = canvasEl.clientWidth
  const cH = canvasEl.clientHeight
  const guides = []

  // X 스냅 후보: [스냅될_값, 가이드라인_위치]
  const xTargets = [
    [0,       0  ],   // 캔버스 왼쪽 끝
    [cW - w,  cW ],   // 캔버스 오른쪽 끝
    ...others.flatMap(p => [
      [p.x,           p.x          ],  // 왼쪽 끝 정렬
      [p.x + p.w - w, p.x + p.w   ],  // 오른쪽 끝 정렬
      [p.x + p.w,     p.x + p.w   ],  // 오른쪽에 붙이기
      [p.x - w,       p.x          ],  // 왼쪽에 붙이기
    ]),
  ]
  let x = rawX
  let snappedX = false
  for (const [val, gl] of xTargets) {
    if (Math.abs(rawX - val) <= SNAP_THRESHOLD) {
      x = val
      guides.push({ type: 'v', pos: gl })
      snappedX = true
      break
    }
  }
  if (!snappedX) x = Math.round(rawX / GRID) * GRID

  // Y 스냅 후보
  const yTargets = [
    [0,       0  ],
    [cH - h,  cH ],
    ...others.flatMap(p => [
      [p.y,           p.y          ],
      [p.y + p.h - h, p.y + p.h   ],
      [p.y + p.h,     p.y + p.h   ],
      [p.y - h,       p.y          ],
    ]),
  ]
  let y = rawY
  let snappedY = false
  for (const [val, gl] of yTargets) {
    if (Math.abs(rawY - val) <= SNAP_THRESHOLD) {
      y = val
      guides.push({ type: 'h', pos: gl })
      snappedY = true
      break
    }
  }
  if (!snappedY) y = Math.round(rawY / GRID) * GRID

  return {
    x: Math.max(0, Math.min(x, cW - w)),
    y: Math.max(0, Math.min(y, cH - h)),
    guides,
  }
}

// ─── 패널 메타데이터 ──────────────────────────────────────────────
const PANEL_META = {
  commits:       { icon: '⎇', label: '커밋 로그',      hint: '우클릭 → AI 코드 리뷰' },
  issues:        { icon: '◈', label: '이슈',            hint: '' },
  tokens:        { icon: '◉', label: 'AI 사용량',      hint: '' },
  status:        { icon: '◎', label: '연결 상태',      hint: '' },
  'gmail-preview': { icon: '✉', label: 'Gmail 미리보기', hint: '클릭 → Gmail 탭 이동' },
}

const NAV_ITEMS = [
  { id: 'commits',         ...PANEL_META.commits          },
  { id: 'issues',          ...PANEL_META.issues           },
  { id: 'tokens',          ...PANEL_META.tokens           },
  { id: 'status',          ...PANEL_META.status           },
  { id: 'gmail-preview',   ...PANEL_META['gmail-preview'] },
  { id: 'schedule',      icon: '▦', label: '일정표',    page: true },
  { id: 'summary',       icon: '☰', label: '주간 요약', page: true },
  { id: 'notifications', icon: '◉', label: '알림',  page: true },
  { id: 'gmail',         icon: '✉', label: 'Gmail', page: true },
  { id: 'settings',      icon: '⚙', label: '설정',  page: true, bottom: true },
]

const DEFAULT_PANELS = [
  { id: 'commits', x: 16,  y: 16,  w: 480, h: 320 },
  { id: 'issues',  x: 512, y: 16,  w: 380, h: 320 },
  { id: 'tokens',  x: 16,  y: 352, w: 480, h: 280 },
  { id: 'status',  x: 512, y: 352, w: 380, h: 280 },
]

// 패널 컨텐츠 — React.memo로 위치 변경 시 리마운트 방지
const PanelContent = memo(function PanelContent({ id }) {
  switch (id) {
    case 'commits':       return <CommitPanel />
    case 'issues':        return <IssuePanel />
    case 'tokens':        return <TokenUsagePanel />
    case 'status':        return <StatusPanel />
    case 'gmail-preview': return <GmailPreviewPanel />
    default: return null
  }
})

// ─── 스냅 가이드라인 ──────────────────────────────────────────────
function SnapGuides({ guides }) {
  return guides.map((g, i) => (
    <div key={i} style={{
      position: 'absolute', pointerEvents: 'none', zIndex: 200,
      background: 'rgba(80, 160, 255, 0.55)',
      ...(g.type === 'v'
        ? { left: g.pos - 0.5, top: 0,     width: 1,   height: '100%' }
        : { top:  g.pos - 0.5, left: 0,    height: 1,  width: '100%'  }),
    }} />
  ))
}

// ─── 리사이즈 핸들 정의 ───────────────────────────────────────────
// id: 방향 (n/s/e/w/ne/nw/se/sw), style: 위치/크기/커서
const RESIZE_HANDLES = [
  { id: 'n',  style: { top: 0,    left: 8,    right: 8,   height: 6,  cursor: 'n-resize'  } },
  { id: 's',  style: { bottom: 0, left: 8,    right: 8,   height: 6,  cursor: 's-resize'  } },
  { id: 'e',  style: { right: 0,  top: 8,     bottom: 8,  width: 6,   cursor: 'e-resize'  } },
  { id: 'w',  style: { left: 0,   top: 8,     bottom: 8,  width: 6,   cursor: 'w-resize'  } },
  { id: 'nw', style: { top: 0,    left: 0,    width: 12,  height: 12, cursor: 'nw-resize' } },
  { id: 'ne', style: { top: 0,    right: 0,   width: 12,  height: 12, cursor: 'ne-resize' } },
  { id: 'sw', style: { bottom: 0, left: 0,    width: 12,  height: 12, cursor: 'sw-resize' } },
  { id: 'se', style: { bottom: 0, right: 0,   width: 16,  height: 16, cursor: 'se-resize' } },
]

// ─── 플로팅 패널 ──────────────────────────────────────────────────
// 위치는 부모(DashboardCanvas)가 관리 — 이 컴포넌트는 순수하게 렌더링만
const FloatingPanel = memo(function FloatingPanel({
  panel, zIndex, isTop, onClose, onHeaderMouseDown, onResizeStart,
}) {
  const meta = PANEL_META[panel.id] || {}
  return (
    <div
      style={{
        position: 'absolute',
        left: panel.x, top: panel.y,
        width: panel.w, height: panel.h,
        zIndex,
        background: '#1c2030',
        borderRadius: 12,
        border: `1px solid ${isTop ? '#3d5080' : '#252830'}`,
        boxShadow: isTop ? '0 12px 40px rgba(0,0,0,.7)' : '0 4px 16px rgba(0,0,0,.4)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transition: 'border-color .15s, box-shadow .15s',
      }}
    >
      {/* 리사이즈 핸들 (8방향) */}
      {RESIZE_HANDLES.map(h => (
        <div
          key={h.id}
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart(h.id, e) }}
          style={{
            position: 'absolute', zIndex: 10,
            ...h.style,
            // se 핸들만 시각적 표시
            ...(h.id === 'se' ? {
              background: 'linear-gradient(135deg, transparent 40%, #3a4a6a 40%)',
              borderRadius: '0 0 12px 0',
            } : {}),
          }}
        />
      ))}

      {/* 헤더 — 드래그 핸들 */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          padding: '9px 12px',
          background: '#212535',
          borderBottom: '1px solid #2a2e3a',
          display: 'flex', alignItems: 'center', gap: 8,
          cursor: 'grab', flexShrink: 0, userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 14, opacity: .85 }}>{meta.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#d0d8e8', letterSpacing: '.04em' }}>
          {meta.label}
        </span>
        {meta.hint && (
          <span style={{ fontSize: 10, color: '#667', marginLeft: 6 }}>{meta.hint}</span>
        )}
        <button
          onClick={onClose}
          style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: '#667', fontSize: 13, cursor: 'pointer',
            padding: '2px 6px', borderRadius: 4, lineHeight: 1,
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#bbb'}
          onMouseLeave={e => e.currentTarget.style.color = '#667'}
        >✕</button>
      </div>
      {/* 바디 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PanelContent id={panel.id} />
      </div>
    </div>
  )
})

// ─── 대시보드 캔버스 ──────────────────────────────────────────────
// ─── 레이아웃 영속화 헬퍼 ────────────────────────────────────────
const LAYOUT_KEY = 'yngtool-panel-layout-v1'

function loadSavedLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return null
    const { panels, zOrder } = JSON.parse(raw)
    // 현재 유효한 패널 ID만 허용
    const validIds = new Set(Object.keys(PANEL_META))
    return {
      panels: panels.filter(p => validIds.has(p.id)),
      zOrder: zOrder.filter(id => validIds.has(id)),
    }
  } catch { return null }
}

function persistLayout(panels, zOrder) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify({ panels, zOrder })) } catch {}
}

function DashboardCanvas({ onReady, onPanelIdsChange }) {
  const saved = useRef(loadSavedLayout())  // 최초 1회만 읽음

  const [panels,     setPanels    ] = useState(() => saved.current?.panels ?? DEFAULT_PANELS)
  const [zOrder,     setZOrder    ] = useState(() => saved.current?.zOrder ?? DEFAULT_PANELS.map(p => p.id))
  const [snapGuides, setSnapGuides] = useState([])

  const canvasRef  = useRef(null)
  const dragRef    = useRef(null)   // { panelId, offsetX, offsetY }
  const saveTimer  = useRef(null)   // 레이아웃 저장 디바운스

  // 패널 이동/리사이즈/추가/삭제 시 500ms 디바운스로 저장
  useEffect(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persistLayout(panels, zOrder), 500)
    return () => clearTimeout(saveTimer.current)
  }, [panels, zOrder])

  // 외부(사이드바)에서 addPanel을 호출할 수 있도록 ref 등록
  const addPanelRef = useRef(null)

  const addPanel = useCallback((id, dropX, dropY) => {
    if (!PANEL_META[id]) return
    setPanels(prev => {
      // 이미 열려있으면 최상위로만
      if (prev.find(p => p.id === id)) {
        setZOrder(zo => [...zo.filter(i => i !== id), id])
        return prev
      }
      // 드롭 위치가 없으면 캐스케이드 배치
      let x, y
      if (dropX != null && dropY != null) {
        x = Math.max(0, dropX)
        y = Math.max(0, dropY)
      } else {
        const n = prev.length
        x = 24 + (n * 30) % 260
        y = 24 + (n * 30) % 180
      }
      return [...prev, { id, x, y, w: 460, h: 320 }]
    })
    setZOrder(prev => [...prev.filter(i => i !== id), id])
  }, [])

  // addPanel을 최신 상태로 ref에 유지 + 최초 1회 onReady 등록
  addPanelRef.current = addPanel
  useEffect(() => {
    onReady((id) => addPanelRef.current(id, null, null))
  }, []) // eslint-disable-line

  // 열린 패널 ID 목록을 상위로 보고
  useEffect(() => {
    onPanelIdsChange(panels.map(p => p.id))
  }, [panels, onPanelIdsChange])

  const bringToFront = useCallback((id) => {
    setZOrder(prev => [...prev.filter(i => i !== id), id])
  }, [])

  const closePanel = useCallback((id) => {
    setPanels(prev => prev.filter(p => p.id !== id))
    setZOrder(prev => prev.filter(i => i !== id))
  }, [])

  // 드래그 시작 (FloatingPanel 헤더 mousedown)
  const startDrag = useCallback((panelId, e) => {
    if (e.target.closest('button')) return
    const panel = panels.find(p => p.id === panelId)
    if (!panel) return
    dragRef.current = {
      type: 'drag',
      panelId,
      offsetX: e.clientX - panel.x,
      offsetY: e.clientY - panel.y,
    }
    bringToFront(panelId)
    e.preventDefault()
  }, [panels, bringToFront])

  // 리사이즈 시작 (핸들 mousedown)
  const startResize = useCallback((panelId, handle, e) => {
    const panel = panels.find(p => p.id === panelId)
    if (!panel) return
    dragRef.current = {
      type: 'resize',
      panelId, handle,
      startMouseX: e.clientX, startMouseY: e.clientY,
      startX: panel.x,  startY: panel.y,
      startW: panel.w,  startH: panel.h,
    }
    bringToFront(panelId)
    e.preventDefault()
  }, [panels, bringToFront])

  // 전역 mousemove / mouseup
  useEffect(() => {
    const onMove = (e) => {
      const ref = dragRef.current
      if (!ref) return

      if (ref.type === 'drag') {
        const { panelId, offsetX, offsetY } = ref
        const canvas = canvasRef.current
        if (!canvas) return
        const rawX = e.clientX - offsetX
        const rawY = e.clientY - offsetY
        setPanels(prev => {
          const panel = prev.find(p => p.id === panelId)
          if (!panel) return prev
          const others = prev.filter(p => p.id !== panelId)
          const { x, y, guides } = computeSnap(rawX, rawY, panel.w, panel.h, canvas, others)
          setSnapGuides(guides)
          return prev.map(p => p.id === panelId ? { ...p, x, y } : p)
        })

      } else if (ref.type === 'resize') {
        const { panelId, handle, startMouseX, startMouseY, startX, startY, startW, startH } = ref
        const dx = e.clientX - startMouseX
        const dy = e.clientY - startMouseY

        let x = startX, y = startY, w = startW, h = startH

        if (handle.includes('e')) w = Math.max(MIN_W, startW + dx)
        if (handle.includes('s')) h = Math.max(MIN_H, startH + dy)
        if (handle.includes('w')) {
          w = Math.max(MIN_W, startW - dx)
          x = startX + startW - w
        }
        if (handle.includes('n')) {
          h = Math.max(MIN_H, startH - dy)
          y = startY + startH - h
        }

        setPanels(prev => prev.map(p => p.id === panelId ? { ...p, x, y, w, h } : p))
        setSnapGuides([])
      }
    }
    const onUp = () => {
      dragRef.current = null
      setSnapGuides([])
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  // 드롭 (사이드바에서 드래그 앤 드롭)
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('panelId')
    if (!id) return
    const rect = e.currentTarget.getBoundingClientRect()
    addPanel(id, e.clientX - rect.left - 230, e.clientY - rect.top - 20)
  }, [addPanel])

  return (
    <div
      ref={canvasRef}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      style={{ position: 'relative', flex: 1, overflow: 'hidden', background: '#13151c' }}
    >
      <SnapGuides guides={snapGuides} />

      {zOrder.map((id, idx) => {
        const panel = panels.find(p => p.id === id)
        if (!panel) return null
        return (
          <FloatingPanel
            key={id}
            panel={panel}
            zIndex={idx + 1}
            isTop={idx === zOrder.length - 1}
            onClose={() => closePanel(id)}
            onHeaderMouseDown={(e) => startDrag(id, e)}
            onResizeStart={(handle, e) => startResize(id, handle, e)}
          />
        )
      })}

      {panels.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 30, opacity: .12 }}>⊞</span>
          <span style={{ fontSize: 13, color: '#334' }}>
            사이드바 항목을 드래그하거나 더블클릭하세요
          </span>
        </div>
      )}
    </div>
  )
}

// ─── 사이드바 ──────────────────────────────────────────────────────
const Sidebar = memo(function Sidebar({ activePage, setActivePage, openPanelIds, onOpenPanel, unreadCount }) {
  const topItems = NAV_ITEMS.filter(n => !n.bottom)
  const botItems = NAV_ITEMS.filter(n => n.bottom)

  const renderItem = (item) => {
    const isPage   = !!item.page
    const isActive = activePage === item.id
    const isOpen   = !isPage && openPanelIds.includes(item.id)

    const handleClick = () => {
      if (isPage) setActivePage(item.id)
      else setActivePage(null)
    }

    const handleDoubleClick = () => {
      if (isPage) return
      onOpenPanel(item.id)
      setActivePage(null)
    }

    return (
      <div
        key={item.id}
        draggable={!isPage}
        onDragStart={!isPage ? (e) => {
          e.dataTransfer.setData('panelId', item.id)
          e.dataTransfer.effectAllowed = 'copy'
        } : undefined}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={{
          ...styles.navItem,
          ...(isActive ? styles.navItemActive : {}),
          cursor: isPage ? 'pointer' : 'grab',
          position: 'relative',
        }}
        onMouseEnter={e => {
          if (!isActive) e.currentTarget.style.background = '#151a26'
        }}
        onMouseLeave={e => {
          if (!isActive) e.currentTarget.style.background = ''
        }}
      >
        <span style={{ fontSize: 15, opacity: isActive ? 1 : .65 }}>{item.icon}</span>
        <span style={{ ...styles.navLabel, color: isActive ? '#9ec' : '#8a9ab0' }}>
          {item.label}
        </span>
        {/* 알림 배지 */}
        {item.id === 'notifications' && unreadCount > 0 && (
          <span style={{
            marginLeft: 'auto',
            background: '#e05050', color: '#fff',
            fontSize: 9, fontWeight: 700,
            minWidth: 16, height: 16, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {/* 열려있는 패널 표시 점 */}
        {isOpen && (
          <span style={{
            position: 'absolute', right: 10, top: '50%',
            transform: 'translateY(-50%)',
            width: 5, height: 5, borderRadius: '50%', background: '#4a9',
          }} />
        )}
        {/* 패널 항목에 드래그 힌트 */}
        {!isPage && (
          <span style={{ fontSize: 9, color: '#445', marginLeft: 'auto', paddingRight: isOpen ? 18 : 0 }}>
            ⠿
          </span>
        )}
      </div>
    )
  }

  return (
    <div style={styles.sidebar}>
      {/* 로고 */}
      <div style={styles.sidebarLogo}>
        <span style={{ fontSize: 16 }}>🛠</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#c0cce0', letterSpacing: '.04em' }}>
          YngTool
        </span>
      </div>

      {/* 패널 섹션 */}
      <div style={styles.sidebarSection}>
        <div style={styles.sidebarSectionLabel}>패널 — 드래그 또는 더블클릭</div>
        {topItems.filter(i => !i.page).map(renderItem)}
      </div>

      {/* 페이지 섹션 */}
      <div style={styles.sidebarSection}>
        <div style={styles.sidebarSectionLabel}>페이지</div>
        {topItems.filter(i => i.page).map(renderItem)}
      </div>

      {/* 하단 (설정) */}
      <div style={{ marginTop: 'auto' }}>
        {botItems.map(renderItem)}
      </div>
    </div>
  )
})

// ─── 커스텀 타이틀바 ──────────────────────────────────────────────
const TitleBar = memo(function TitleBar() {
  return (
    <div style={styles.titlebar}>
      <div style={{ flex: 1, WebkitAppRegion: 'drag', height: '100%' }} />
      <div style={styles.winControls}>
        <button style={styles.winBtn} onClick={() => window.electronAPI?.windowMinimize()}>─</button>
        <button style={styles.winBtn} onClick={() => window.electronAPI?.windowMaximize()}>□</button>
        <button
          style={{ ...styles.winBtn, ...styles.winBtnClose }}
          onClick={() => window.electronAPI?.windowClose()}
        >✕</button>
      </div>
    </div>
  )
})

// ─── 메인 앱 ─────────────────────────────────────────────────────
function AppShell() {
  const { state } = useApp()
  const [activePage,   setActivePage  ] = useState(null)
  const [openPanelIds, setOpenPanelIds] = useState(DEFAULT_PANELS.map(p => p.id))

  // DashboardCanvas가 등록해주는 addPanel 함수 (사이드바 더블클릭용)
  const openPanelFnRef = useRef(null)
  const handleReady    = useCallback((fn) => { openPanelFnRef.current = fn }, [])
  const handleOpenPanel = useCallback((id) => { openPanelFnRef.current?.(id) }, [])

  const renderMain = () => {
    switch (activePage) {
      case 'schedule':      return <SchedulePage />
      case 'summary':       return <WeeklySummaryPage />
      case 'settings':      return <SettingsPage />
      case 'notifications': return <NotificationPanel />
      case 'gmail':         return <GmailPanel />
      default:
        return (
          <DashboardCanvas
            onReady={handleReady}
            onPanelIdsChange={setOpenPanelIds}
          />
        )
    }
  }

  return (
    <NavContext.Provider value={{ setActivePage }}>
      <div style={styles.shell}>
        <TitleBar />
        <div style={styles.body}>
          <Sidebar
            activePage={activePage}
            setActivePage={setActivePage}
            openPanelIds={openPanelIds}
            onOpenPanel={handleOpenPanel}
            unreadCount={state.notifications.unreadCount}
          />
          <main style={styles.main}>
            {renderMain()}
          </main>
        </div>
        <CodeReviewModal />
      </div>
    </NavContext.Provider>
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
    background: '#13151c', color: '#c8d0e0',
    fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif",
    userSelect: 'none',
  },
  titlebar: {
    height: 34, background: '#0f1118',
    borderBottom: '1px solid #1e2130',
    display: 'flex', alignItems: 'center', flexShrink: 0,
  },
  winControls: { display: 'flex', WebkitAppRegion: 'no-drag' },
  winBtn: {
    width: 40, height: 34, background: 'none', border: 'none',
    color: '#556', fontSize: 12, cursor: 'pointer',
  },
  winBtnClose: { color: '#855' },

  body: { display: 'flex', flex: 1, overflow: 'hidden' },

  sidebar: {
    width: 172, background: '#0f1118',
    borderRight: '1px solid #1a1e2a',
    display: 'flex', flexDirection: 'column',
    padding: '0 0 12px', flexShrink: 0, overflowY: 'auto',
  },
  sidebarLogo: {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '14px 16px 12px',
    borderBottom: '1px solid #191d28', marginBottom: 8,
  },
  sidebarSection: { marginBottom: 4 },
  sidebarSectionLabel: {
    fontSize: 9, color: '#334', letterSpacing: '.07em',
    textTransform: 'uppercase', padding: '8px 16px 4px',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '7px 14px', borderRadius: 7, margin: '1px 8px',
    transition: 'background .12s', WebkitAppRegion: 'no-drag',
  },
  navItemActive: { background: '#182030' },
  navLabel: { fontSize: 13, fontWeight: 500 },

  main: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
}
