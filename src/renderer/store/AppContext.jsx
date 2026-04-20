import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
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
  activeTab: 'dashboard',
  codeReview: {
    open: false,
    target: null,   // { type, hash/revision, repoPath }
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

  // 설정 로드
  useEffect(() => {
    window.electronAPI.loadConfig().then(({ data }) => {
      dispatch({ type: 'SET_CONFIG', payload: data })
    })
  }, [])

  // 연결 상태 체크
  const checkConnections = useCallback(async (config) => {
    if (!config) return

    // Mantis
    if (config.mantis?.enabled && config.mantis?.baseUrl) {
      dispatch({ type: 'SET_CHECKING', payload: { key: 'mantis' } })
      const { ok } = await window.electronAPI.checkConnection({
        url: `${config.mantis.baseUrl}/api/rest/users/me`,
        timeout: 3000,
      })
      dispatch({ type: 'SET_CONNECTION', payload: { key: 'mantis', ok } })
    }

    // Jira
    if (config.jira?.enabled && config.jira?.baseUrl) {
      dispatch({ type: 'SET_CHECKING', payload: { key: 'jira' } })
      const { ok } = await window.electronAPI.checkConnection({
        url: `${config.jira.baseUrl}/rest/api/3/myself`,
        timeout: 3000,
      })
      dispatch({ type: 'SET_CONNECTION', payload: { key: 'jira', ok } })
    }

    // SVN CLI
    const svnRes = await window.electronAPI.svnCheck()
    dispatch({ type: 'SET_CONNECTION', payload: { key: 'svn', ok: svnRes.available } })

  }, [])

  // config 로드 후 & 5분마다 연결 체크
  useEffect(() => {
    if (!state.config) return
    checkConnections(state.config)
    const timer = setInterval(() => checkConnections(state.config), 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [state.config, checkConnections])

  // 이슈 불러오기
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

  // 커밋 로그 불러오기
  const fetchCommits = useCallback(async () => {
    if (!state.config) return

    // SVN
    if (state.config.svn?.enabled && state.connections.svn.ok) {
      for (const repoPath of (state.config.svn.repoPaths || [])) {
        dispatch({ type: 'SET_COMMITS', payload: { source: 'svn', repoKey: repoPath, loading: true } })
        const result = await window.electronAPI.svnLog({ repoPath, limit: 30 })
        dispatch({ type: 'SET_COMMITS', payload: { source: 'svn', repoKey: repoPath, ...result } })
      }
    }

    // Git
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

  const value = { state, dispatch, fetchIssues, fetchCommits, checkConnections }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
