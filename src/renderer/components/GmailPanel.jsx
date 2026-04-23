import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../store/AppContext'
import dayjs from 'dayjs'

export default function GmailPanel() {
  const { state, dispatch } = useApp()
  const gmail = state.config?.gmail

  const [messages, setMessages] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [selected, setSelected] = useState(null)   // { id, subject, from, date, ... }
  const [body,     setBody]     = useState(null)   // { html, text, hasHtml }
  const [bodyLoading, setBodyLoading] = useState(false)

  const isConnected = !!(gmail?.refreshToken)

  // ─── 액세스 토큰 갱신 헬퍼 ────────────────────────────────────────
  const ensureToken = useCallback(async () => {
    if (!gmail?.refreshToken) return null

    const now = Date.now()
    if (gmail.accessToken && gmail.expiresAt && now < gmail.expiresAt) {
      return gmail.accessToken  // 아직 유효
    }

    // 갱신 필요
    const res = await window.electronAPI.gmailRefreshToken({
      clientId:     gmail.clientId,
      clientSecret: gmail.clientSecret,
      refreshToken: gmail.refreshToken,
    })
    if (res.error) return null

    // 갱신된 토큰을 config에 반영
    const updated = {
      ...state.config,
      gmail: { ...gmail, accessToken: res.accessToken, expiresAt: res.expiresAt },
    }
    await window.electronAPI.saveConfig(updated)
    dispatch({ type: 'SET_CONFIG', payload: updated })
    return res.accessToken
  }, [gmail, state.config, dispatch])

  // ─── 메일 목록 조회 ───────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!isConnected) return
    setLoading(true); setError(null)
    try {
      const token = await ensureToken()
      if (!token) { setError('토큰 갱신 실패. 설정에서 Gmail을 다시 연결해주세요.'); setLoading(false); return }

      const res = await window.electronAPI.gmailFetchMessages({ accessToken: token, maxResults: 20 })
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

  // ─── 메일 본문 조회 + 읽음 처리 ─────────────────────────────────
  const handleSelect = useCallback(async (msg) => {
    setSelected(msg)
    setBody(null)
    setBodyLoading(true)

    // 로컬 상태에서 읽음 처리 (파란 점 제거)
    if (msg.isUnread) {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isUnread: false } : m))
    }

    try {
      const token = await ensureToken()
      if (!token) { setBodyLoading(false); return }
      const res = await window.electronAPI.gmailFetchMessageBody({ accessToken: token, messageId: msg.id })
      setBody(res.error ? null : res)
    } catch {}
    setBodyLoading(false)
  }, [ensureToken])

  // ─── 미연결 상태 ──────────────────────────────────────────────────
  if (!gmail?.enabled || !isConnected) {
    return (
      <div style={s.centeredWrap}>
        <div style={s.emptyIcon}>✉</div>
        <div style={s.emptyTitle}>Gmail 연결되지 않음</div>
        <div style={s.emptyBody}>
          설정(⚙) → Gmail 설정에서 Client ID / Client Secret을 입력하고<br />
          'Google 계정 연결' 버튼을 눌러 인증하세요.
        </div>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      {/* 헤더 */}
      <div style={s.header}>
        <span style={s.headerTitle}>Gmail · 받은편지함</span>
        <button style={s.refreshBtn} onClick={fetchMessages} disabled={loading}>
          {loading ? '로딩 중...' : '↻ 새로고침'}
        </button>
      </div>

      <div style={s.body}>
        {/* 좌: 목록 */}
        <div style={s.listCol}>
          {error && <div style={s.errMsg}>{error}</div>}
          {!error && messages.length === 0 && !loading && (
            <div style={s.emptySmall}>메일이 없습니다</div>
          )}
          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                ...s.mailItem,
                ...(selected?.id === msg.id ? s.mailItemActive : {}),
                ...(msg.isUnread ? s.mailItemUnread : {}),
              }}
              onClick={() => handleSelect(msg)}
            >
              {msg.isUnread && <span style={s.unreadDot} />}
              <div style={s.mailFrom}>{formatFrom(msg.from)}</div>
              <div style={s.mailSubject}>{msg.subject}</div>
              <div style={s.mailMeta}>
                <span style={s.mailSnippet}>{msg.snippet}</span>
                <span style={s.mailDate}>{formatDate(msg.date)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 우: 본문 */}
        <div style={s.contentCol}>
          {!selected ? (
            <div style={s.noSelect}>메일을 선택하세요</div>
          ) : (
            <>
              <div style={s.contentHeader}>
                <div style={s.contentSubject}>{selected.subject}</div>
                <div style={s.contentMeta}>
                  <span style={s.contentFrom}>{selected.from}</span>
                  <span style={s.contentDate}>{selected.date}</span>
                </div>
              </div>
              <div style={s.contentBody}>
                {bodyLoading && <div style={s.bodyLoading}>본문 로딩 중...</div>}
                {!bodyLoading && !body && <div style={s.bodyLoading}>본문을 불러올 수 없습니다.</div>}
                {!bodyLoading && body && (
                  body.hasHtml
                    ? <iframe
                        srcDoc={body.html}
                        style={s.iframe}
                        sandbox="allow-same-origin"
                        title="mail-body"
                      />
                    : <pre style={s.plainText}>{body.text}</pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────
function formatFrom(from = '') {
  // "이름 <email@...>" → "이름" 추출
  const m = from.match(/^"?([^"<]+)"?\s*</)
  return m ? m[1].trim() : from.split('@')[0] || from
}

function formatDate(dateStr = '') {
  if (!dateStr) return ''
  try {
    return dayjs(dateStr).format('MM/DD HH:mm')
  } catch { return dateStr }
}

// ─── 스타일 ───────────────────────────────────────────────────────
const s = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', background: '#161616' },

  header: {
    display: 'flex', alignItems: 'center', padding: '10px 16px',
    borderBottom: '1px solid #2a2a2a', flexShrink: 0,
  },
  headerTitle: { fontSize: 13, fontWeight: 600, color: '#ccc' },
  refreshBtn: {
    marginLeft: 'auto', background: 'none', border: '1px solid #3a3a3a',
    borderRadius: 4, color: '#666', fontSize: 11, padding: '3px 10px',
    cursor: 'pointer',
  },

  body: { display: 'flex', flex: 1, overflow: 'hidden' },

  listCol: {
    width: 280, flexShrink: 0, overflowY: 'auto',
    borderRight: '1px solid #222',
  },

  mailItem: {
    padding: '10px 14px', borderBottom: '1px solid #1e1e1e',
    cursor: 'pointer', position: 'relative',
    transition: 'background .1s',
  },
  mailItemActive:  { background: '#1a2235' },
  mailItemUnread:  { background: '#1a1e2a' },

  unreadDot: {
    position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
    width: 5, height: 5, borderRadius: '50%', background: '#4a9eff',
  },

  mailFrom:    { fontSize: 12, fontWeight: 600, color: '#bbb', marginBottom: 2, paddingLeft: 6 },
  mailSubject: {
    fontSize: 11, color: '#999', paddingLeft: 6,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3,
  },
  mailMeta:    { display: 'flex', alignItems: 'center', paddingLeft: 6 },
  mailSnippet: {
    fontSize: 10, color: '#555',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
  },
  mailDate:    { fontSize: 10, color: '#444', marginLeft: 6, flexShrink: 0 },

  contentCol: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },

  noSelect:    { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#444', fontSize: 13 },

  contentHeader: {
    padding: '14px 20px', borderBottom: '1px solid #2a2a2a', flexShrink: 0,
  },
  contentSubject: { fontSize: 14, fontWeight: 600, color: '#ccc', marginBottom: 6 },
  contentMeta:    { display: 'flex', alignItems: 'center', gap: 12 },
  contentFrom:    { fontSize: 12, color: '#888' },
  contentDate:    { fontSize: 11, color: '#555', marginLeft: 'auto' },

  contentBody: { flex: 1, overflow: 'auto', position: 'relative' },
  bodyLoading: { padding: 20, fontSize: 12, color: '#555' },

  iframe: { width: '100%', height: '100%', border: 'none', background: '#fff' },
  plainText: {
    margin: 0, padding: '16px 20px', fontSize: 12, color: '#ccc',
    lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    fontFamily: 'inherit',
  },

  errMsg: { padding: '12px 14px', fontSize: 12, color: '#f07' },
  emptySmall: { padding: '20px 14px', fontSize: 12, color: '#444', textAlign: 'center' },

  centeredWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', gap: 12,
  },
  emptyIcon:  { fontSize: 40, color: '#333' },
  emptyTitle: { fontSize: 15, color: '#666', fontWeight: 600 },
  emptyBody:  { fontSize: 12, color: '#444', textAlign: 'center', lineHeight: 1.7 },
}
