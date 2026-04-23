import React, { useState, useEffect, useCallback, useContext } from 'react'
import { useApp } from '../store/AppContext'
import { NavContext } from '../App'
import dayjs from 'dayjs'

const MAX_ITEMS = 8  // 패널에 표시할 최대 메일 수

export default function GmailPreviewPanel() {
  const { state, dispatch } = useApp()
  const { setActivePage }   = useContext(NavContext) || {}
  const gmail = state.config?.gmail

  const [messages, setMessages] = useState([])
  const [loading,  setLoading ] = useState(false)
  const [error,    setError   ] = useState(null)

  const isConnected = !!(gmail?.refreshToken && gmail?.enabled)

  // ─── 토큰 갱신 ────────────────────────────────────────────────────
  const ensureToken = useCallback(async () => {
    if (!gmail?.refreshToken) return null
    const now = Date.now()
    if (gmail.accessToken && gmail.expiresAt && now < gmail.expiresAt) return gmail.accessToken

    const res = await window.electronAPI.gmailRefreshToken({
      clientId:     gmail.clientId,
      clientSecret: gmail.clientSecret,
      refreshToken: gmail.refreshToken,
    })
    if (res.error) return null

    const updated = { ...state.config, gmail: { ...gmail, accessToken: res.accessToken, expiresAt: res.expiresAt } }
    await window.electronAPI.saveConfig(updated)
    dispatch({ type: 'SET_CONFIG', payload: updated })
    return res.accessToken
  }, [gmail, state.config, dispatch])

  // ─── 메일 목록 조회 ───────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!isConnected) return
    setLoading(true)
    setError(null)
    try {
      const token = await ensureToken()
      if (!token) { setError('토큰 갱신 실패'); setLoading(false); return }

      const res = await window.electronAPI.gmailFetchMessages({ accessToken: token, maxResults: MAX_ITEMS })
      if (res.error) { setError(res.error); setLoading(false); return }
      setMessages(res.items || [])
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [isConnected, ensureToken])

  useEffect(() => {
    if (isConnected) fetchMessages()
  }, [isConnected]) // eslint-disable-line

  // ─── Gmail 탭으로 이동 ────────────────────────────────────────────
  const goToGmail = useCallback((e) => {
    e.stopPropagation()
    setActivePage?.('gmail')
  }, [setActivePage])

  // ─── 미연결 상태 ──────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div style={s.center}>
        <div style={s.emptyIcon}>✉</div>
        <div style={s.emptyText}>Gmail 미연결</div>
        <button style={s.linkBtn} onClick={() => setActivePage?.('settings')}>
          설정에서 연결하기
        </button>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      {/* 헤더 */}
      <div style={s.header}>
        <span style={s.headerTitle}>✉ 받은편지함</span>
        <button style={s.iconBtn} onClick={fetchMessages} disabled={loading} title="새로고침">↻</button>
        <button style={s.iconBtn} onClick={goToGmail} title="Gmail 탭으로">↗</button>
      </div>

      {/* 목록 */}
      <div style={s.list}>
        {loading && <div style={s.hint}>로딩 중...</div>}
        {!loading && error && <div style={s.errText}>{error}</div>}
        {!loading && !error && messages.length === 0 && (
          <div style={s.hint}>메일이 없습니다</div>
        )}
        {!loading && messages.map(msg => (
          <div
            key={msg.id}
            style={{ ...s.item, ...(msg.isUnread ? s.itemUnread : {}) }}
            onClick={goToGmail}
            title={msg.subject}
          >
            {/* 미읽음 표시 */}
            {msg.isUnread && <span style={s.dot} />}

            <div style={s.itemInner}>
              {/* 발신자 + 날짜 */}
              <div style={s.itemTop}>
                <span style={{ ...s.sender, fontWeight: msg.isUnread ? 700 : 400 }}>
                  {formatFrom(msg.from)}
                </span>
                <span style={s.date}>{formatDate(msg.date)}</span>
              </div>
              {/* 제목 */}
              <div style={{ ...s.subject, fontWeight: msg.isUnread ? 600 : 400 }}>
                {msg.subject || '(제목 없음)'}
              </div>
              {/* 본문 미리보기 */}
              {msg.snippet && (
                <div style={s.snippet}>{msg.snippet}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 하단 더보기 */}
      {messages.length > 0 && (
        <div style={s.footer}>
          <button style={s.moreBtn} onClick={goToGmail}>
            Gmail에서 전체 보기 →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────
function formatFrom(from = '') {
  const m = from.match(/^"?([^"<]+)"?\s*</)
  return m ? m[1].trim() : from.split('@')[0] || from
}

function formatDate(dateStr = '') {
  if (!dateStr) return ''
  try {
    const d = dayjs(dateStr)
    return d.isToday?.() ? d.format('HH:mm') : d.format('MM/DD')
  } catch { return '' }
}

// ─── 스타일 ───────────────────────────────────────────────────────
const s = {
  wrap: {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: '#1c2030', overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '8px 12px', borderBottom: '1px solid #252a38', flexShrink: 0,
  },
  headerTitle: { fontSize: 12, fontWeight: 600, color: '#c0cce0', flex: 1 },
  iconBtn: {
    background: 'none', border: 'none', color: '#556', fontSize: 14,
    cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
    transition: 'color .15s',
  },

  list: { flex: 1, overflowY: 'auto' },

  item: {
    display: 'flex', alignItems: 'flex-start', gap: 6,
    padding: '9px 12px', borderBottom: '1px solid #1e2130',
    cursor: 'pointer', position: 'relative',
    transition: 'background .1s',
  },
  itemUnread: { background: '#181e2e' },

  dot: {
    flexShrink: 0, width: 5, height: 5, borderRadius: '50%',
    background: '#4a9eff', marginTop: 6,
  },
  itemInner: { flex: 1, minWidth: 0 },

  itemTop: { display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  sender: {
    fontSize: 12, color: '#c0cce0',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
  },
  date: { fontSize: 10, color: '#445', flexShrink: 0 },

  subject: {
    fontSize: 11, color: '#9aabbd',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    marginBottom: 2,
  },
  snippet: {
    fontSize: 10, color: '#445',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },

  footer: {
    flexShrink: 0, padding: '6px 12px', borderTop: '1px solid #1e2130',
  },
  moreBtn: {
    background: 'none', border: 'none', color: '#4a7aaa',
    fontSize: 11, cursor: 'pointer', padding: 0,
  },

  hint:    { padding: '16px 12px', fontSize: 12, color: '#445', textAlign: 'center' },
  errText: { padding: '12px', fontSize: 11, color: '#a04040' },

  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', gap: 10,
  },
  emptyIcon: { fontSize: 28, color: '#334' },
  emptyText: { fontSize: 13, color: '#556' },
  linkBtn: {
    background: 'none', border: '1px solid #252a38', borderRadius: 4,
    color: '#667', fontSize: 11, padding: '4px 12px', cursor: 'pointer',
  },
}
