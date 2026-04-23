import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { createIssueProvider } from '../providers/IssueProviders'

const AppContext = createContext(null)

const initialState = {
  config: null,
  connections: {
    svn:    { ok: false, checking: false },
    mantis: { ok: false, checking: false },
    jira:   { ok: false, checking: false },
    git:    { ok: true,  checking: false },  // 로컬이라 항상 true
  },
  commits: {       // { [repoKey]: { items, loading, error } }
    svn: {},
    git: {},
  },
  issues: {
    items: [],
    loading: false,
    error: null,
  },
  notifications: {
    items: [],       // 최대 100개
    unreadCount: 0,
  },
  notifMeta: {
    jiraSnapshot: {},        // { [issueKey]: { status, updated } }
    notifiedSchedules: [],   // 이미 알림 보낸 일정 id 목록
    gmailSeenIds: [],        // 이미 알림 보낸 메일 ID 목록 (최대 200개)
  },
  activeTab: 'dashboard',
  codeReview: {
    open: false,
    target: null,
    result: null,
    loading: false,
  },
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, config: action.payload }

    case 'SET_CONNECTION':
      return {
        ...state,
        connections: {
          ...state.connections,
          [action.payload.key]: { ok: action.payload.ok, checking: false },
        },
      }

    case 'SET_CHECKING':
      return {
        ...state,
        connections: {
          ...state.connections,
          [action.payload.key]: { ...state.connections[action.payload.key], checking: true },
        },
      }

    case 'SET_COMMITS': {
      const { source, repoKey, items, loading, error } = action.payload
      return {
        ...state,
        commits: {
          ...state.commits,
          [source]: {
            ...state.commits[source],
            [repoKey]: { items: items || [], loading: loading || false, error: error || null },
          },
        },
      }
    }

    case 'SET_ISSUES':
      return { ...state, issues: { ...state.issues, ...action.payload } }

    // ─── 알림 ──────────────────────────────────────────────────────
    case 'LOAD_NOTIFICATIONS': {
      const items = action.payload.items || []
      return {
        ...state,
        notifications: { items, unreadCount: items.filter(n => !n.read).length },
        notifMeta: {
          jiraSnapshot:      action.payload.jiraSnapshot      || {},
          notifiedSchedules: action.payload.notifiedSchedules || [],
          gmailSeenIds:      action.payload.gmailSeenIds      || [],
        },
      }
    }

    case 'ADD_NOTIFICATION': {
      const items = [action.payload, ...state.notifications.items].slice(0, 100)
      return {
        ...state,
        notifications: { items, unreadCount: items.filter(n => !n.read).length },
      }
    }

    case 'MARK_NOTIF_READ': {
      const items = state.notifications.items.map(n =>
        n.id === action.payload ? { ...n, read: true } : n
      )
      return { ...state, notifications: { items, unreadCount: items.filter(n => !n.read).length } }
    }

    case 'MARK_ALL_READ': {
      const items = state.notifications.items.map(n => ({ ...n, read: true }))
      return { ...state, notifications: { items, unreadCount: 0 } }
    }

    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: { items: [], unreadCount: 0 } }

    case 'UPDATE_JIRA_SNAPSHOT':
      return { ...state, notifMeta: { ...state.notifMeta, jiraSnapshot: action.payload } }

    case 'ADD_NOTIFIED_SCHEDULE':
      return {
        ...state,
        notifMeta: {
          ...state.notifMeta,
          notifiedSchedules: [...state.notifMeta.notifiedSchedules, action.payload],
        },
      }

    case 'ADD_GMAIL_SEEN_IDS': {
      const merged = [...new Set([...state.notifMeta.gmailSeenIds, ...action.payload])]
      return {
        ...state,
        notifMeta: { ...state.notifMeta, gmailSeenIds: merged.slice(-200) },
      }
    }
    // ───────────────────────────────────────────────────────────────

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload }

    case 'OPEN_CODE_REVIEW':
      return { ...state, codeReview: { open: true, target: action.payload, result: null, loading: true } }

    case 'SET_CODE_REVIEW_RESULT':
      return { ...state, codeReview: { ...state.codeReview, result: action.payload, loading: false } }

    case 'CLOSE_CODE_REVIEW':
      return { ...state, codeReview: { ...initialState.codeReview } }

    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Jira 첫 번째 fetch 여부 (첫 실행 시 전체 이슈를 "신규"로 처리하지 않기 위함)
  const jiraInitializedRef  = useRef(false)
  // 알림 저장 디바운스 타이머
  const notifSaveTimerRef   = useRef(null)
  // 최신 notifMeta를 useCallback 바깥에서 참조하기 위한 ref
  const notifMetaRef        = useRef(state.notifMeta)
  notifMetaRef.current      = state.notifMeta

  // ─── 알림 로드 ───────────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.loadNotifications().then((data) => {
      dispatch({ type: 'LOAD_NOTIFICATIONS', payload: data })
    })
  }, [])

  // ─── 알림 저장 (디바운스 2초) ────────────────────────────────────
  useEffect(() => {
    clearTimeout(notifSaveTimerRef.current)
    notifSaveTimerRef.current = setTimeout(() => {
      window.electronAPI.saveNotifications({
        items:             state.notifications.items,
        jiraSnapshot:      state.notifMeta.jiraSnapshot,
        notifiedSchedules: state.notifMeta.notifiedSchedules,
        gmailSeenIds:      state.notifMeta.gmailSeenIds,
      })
    }, 2000)
    return () => clearTimeout(notifSaveTimerRef.current)
  }, [state.notifications.items, state.notifMeta.jiraSnapshot, state.notifMeta.notifiedSchedules])

  // ─── 설정 로드 ───────────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.loadConfig().then(({ data }) => {
      dispatch({ type: 'SET_CONFIG', payload: data })
    })
  }, [])

  // ─── 연결 상태 체크 ──────────────────────────────────────────────
  const checkConnections = useCallback(async (config) => {
    if (!config) return

    if (config.mantis?.enabled && config.mantis?.baseUrl) {
      dispatch({ type: 'SET_CHECKING', payload: { key: 'mantis' } })
      const { ok } = await window.electronAPI.checkConnection({
        url: `${config.mantis.baseUrl}/api/rest/users/me`,
        timeout: 3000,
      })
      dispatch({ type: 'SET_CONNECTION', payload: { key: 'mantis', ok } })
    }

    if (config.jira?.enabled && config.jira?.baseUrl) {
      dispatch({ type: 'SET_CHECKING', payload: { key: 'jira' } })
      const { ok } = await window.electronAPI.checkConnection({
        url: `${config.jira.baseUrl}/rest/api/3/myself`,
        timeout: 3000,
      })
      dispatch({ type: 'SET_CONNECTION', payload: { key: 'jira', ok } })
    }

    const svnRes = await window.electronAPI.svnCheck()
    dispatch({ type: 'SET_CONNECTION', payload: { key: 'svn', ok: svnRes.available } })
  }, [])

  useEffect(() => {
    if (!state.config) return
    checkConnections(state.config)
    const timer = setInterval(() => checkConnections(state.config), 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [state.config, checkConnections])

  // ─── 이슈 불러오기 + Jira 변경 감지 ─────────────────────────────
  const fetchIssues = useCallback(async () => {
    if (!state.config) return
    dispatch({ type: 'SET_ISSUES', payload: { loading: true, error: null } })
    const allIssues = []

    try {
      if (state.config.mantis?.enabled && state.connections.mantis.ok) {
        const provider = createIssueProvider('mantis', state.config.mantis)
        const items = await provider.getMyIssues()
        allIssues.push(...items)
      }

      if (state.config.jira?.enabled && state.connections.jira.ok) {
        const provider = createIssueProvider('jira', state.config.jira)
        const items = await provider.getMyIssues()
        allIssues.push(...items)

        // ── Jira 변경 감지 ──────────────────────────────────────
        const snapshot = notifMetaRef.current.jiraSnapshot
        const isFirstRun = !jiraInitializedRef.current

        if (!isFirstRun) {
          for (const issue of items) {
            const prev = snapshot[issue.id]
            if (!prev) {
              // 새 이슈
              _addNotif(dispatch, {
                id:   `jira_new_${issue.id}_${Date.now()}`,
                type: 'jira_new',
                title: `새 이슈 할당: ${issue.id}`,
                body:  issue.title,
                url:   issue.url,
                source: 'jira',
              })
            } else {
              if (prev.status !== issue.status) {
                // 상태 변경
                _addNotif(dispatch, {
                  id:   `jira_status_${issue.id}_${Date.now()}`,
                  type: 'jira_status',
                  title: `상태 변경: ${issue.id}`,
                  body:  `${prev.status} → ${issue.status}  ${issue.title}`,
                  url:   issue.url,
                  source: 'jira',
                })
              } else if (prev.updated !== issue.updated) {
                // 댓글 등 기타 업데이트
                _addNotif(dispatch, {
                  id:   `jira_update_${issue.id}_${Date.now()}`,
                  type: 'jira_comment',
                  title: `이슈 업데이트: ${issue.id}`,
                  body:  issue.title,
                  url:   issue.url,
                  source: 'jira',
                })
              }
            }
          }
        }

        // 스냅샷 갱신
        const newSnapshot = {}
        for (const issue of items) {
          newSnapshot[issue.id] = { status: issue.status, updated: issue.updated }
        }
        dispatch({ type: 'UPDATE_JIRA_SNAPSHOT', payload: newSnapshot })
        jiraInitializedRef.current = true
      }

      dispatch({ type: 'SET_ISSUES', payload: { items: allIssues, loading: false } })
    } catch (e) {
      dispatch({ type: 'SET_ISSUES', payload: { loading: false, error: e.message } })
    }
  }, [state.config, state.connections.mantis.ok, state.connections.jira.ok])

  useEffect(() => {
    if (state.connections.mantis.ok || state.connections.jira.ok) {
      fetchIssues()
    }
  }, [state.connections.mantis.ok, state.connections.jira.ok, fetchIssues])

  // ─── 커밋 로그 불러오기 ──────────────────────────────────────────
  const fetchCommits = useCallback(async () => {
    if (!state.config) return

    if (state.config.svn?.enabled && state.connections.svn.ok) {
      for (const repoPath of (state.config.svn.repoPaths || [])) {
        dispatch({ type: 'SET_COMMITS', payload: { source: 'svn', repoKey: repoPath, loading: true } })
        const result = await window.electronAPI.svnLog({ repoPath, limit: 30 })
        dispatch({ type: 'SET_COMMITS', payload: { source: 'svn', repoKey: repoPath, ...result } })
      }
    }

    if (state.config.git?.enabled) {
      for (const repoPath of (state.config.git.repoPaths || [])) {
        dispatch({ type: 'SET_COMMITS', payload: { source: 'git', repoKey: repoPath, loading: true } })
        const result = await window.electronAPI.gitLog({ repoPath, limit: 30 })
        dispatch({ type: 'SET_COMMITS', payload: { source: 'git', repoKey: repoPath, ...result } })
      }
    }
  }, [state.config, state.connections.svn.ok])

  useEffect(() => {
    fetchCommits()
  }, [fetchCommits])

  // ─── 일정 알림 체크 (1분마다) ────────────────────────────────────
  useEffect(() => {
    const checkSchedule = () => {
      try {
        const raw = localStorage.getItem('devdash-schedule-v1')
        if (!raw) return
        const items = JSON.parse(raw)
        const now = new Date()
        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

        for (const item of items) {
          if (item.date !== todayStr || item.allDay || !item.id || !item.time) continue
          if (notifMetaRef.current.notifiedSchedules.includes(String(item.id))) continue

          const [h, m] = item.time.split(':').map(Number)
          const itemTime = new Date(now)
          itemTime.setHours(h, m, 0, 0)
          const diffMin = (itemTime - now) / 60000

          // 30분 이내 & 아직 지나지 않은 일정
          if (diffMin >= 0 && diffMin <= 30) {
            _addNotif(dispatch, {
              id:   `schedule_${item.id}_${Date.now()}`,
              type: 'schedule',
              title: '일정 알림',
              body:  `${item.time} ${item.title}`,
              source: 'schedule',
            })
            dispatch({ type: 'ADD_NOTIFIED_SCHEDULE', payload: String(item.id) })
          }
        }
      } catch (e) {
        console.error('[Schedule check]', e)
      }
    }

    checkSchedule()
    const timer = setInterval(checkSchedule, 60 * 1000)
    return () => clearInterval(timer)
  }, []) // eslint-disable-line

  // ─── Gmail 새 메일 알림 체크 (5분마다) ──────────────────────────
  useEffect(() => {
    const checkGmail = async () => {
      const gmail = state.config?.gmail
      if (!gmail?.enabled || !gmail?.refreshToken) return

      try {
        // 토큰 유효성 확인 및 갱신
        let accessToken = gmail.accessToken
        if (!accessToken || !gmail.expiresAt || Date.now() >= gmail.expiresAt) {
          const refreshRes = await window.electronAPI.gmailRefreshToken({
            clientId:     gmail.clientId,
            clientSecret: gmail.clientSecret,
            refreshToken: gmail.refreshToken,
          })
          if (refreshRes.error) return
          accessToken = refreshRes.accessToken
          const updated = {
            ...state.config,
            gmail: { ...gmail, accessToken: refreshRes.accessToken, expiresAt: refreshRes.expiresAt },
          }
          await window.electronAPI.saveConfig(updated)
          dispatch({ type: 'SET_CONFIG', payload: updated })
        }

        const res = await window.electronAPI.gmailFetchMessages({ accessToken, maxResults: 10 })
        if (res.error || !res.items) return

        const seenIds = notifMetaRef.current.gmailSeenIds
        const newUnread = res.items.filter(m => m.isUnread && !seenIds.includes(m.id))

        for (const mail of newUnread) {
          _addNotif(dispatch, {
            id:    `gmail_${mail.id}`,
            type:  'gmail',
            title: `새 메일: ${mail.subject}`,
            body:  mail.from,
            source: 'gmail',
          })
        }

        if (newUnread.length > 0) {
          dispatch({ type: 'ADD_GMAIL_SEEN_IDS', payload: newUnread.map(m => m.id) })
        }
      } catch (e) {
        console.error('[Gmail check]', e)
      }
    }

    if (state.config) {
      checkGmail()
      const timer = setInterval(checkGmail, 5 * 60 * 1000)
      return () => clearInterval(timer)
    }
  }, [state.config?.gmail?.enabled, state.config?.gmail?.refreshToken]) // eslint-disable-line

  const value = { state, dispatch, fetchIssues, fetchCommits, checkConnections }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// ─── 알림 추가 헬퍼 (토스트 포함) ────────────────────────────────
function _addNotif(dispatch, payload) {
  const notif = {
    ...payload,
    read: false,
    createdAt: new Date().toISOString(),
  }
  dispatch({ type: 'ADD_NOTIFICATION', payload: notif })
  window.electronAPI.sendToast({ title: notif.title, body: notif.body })
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
