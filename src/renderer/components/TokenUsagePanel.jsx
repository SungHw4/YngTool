import React, { useEffect, useState, useCallback } from 'react'
import { useApp } from '../store/AppContext'

// Anthropic Usage API
async function fetchAnthropicUsage(apiKey) {
  if (!apiKey) return null
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const start = startOfMonth.toISOString().split('T')[0]
    const end = now.toISOString().split('T')[0]

    const res = await fetch(
      `https://api.anthropic.com/v1/usage?start_date=${start}&end_date=${end}`,
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      }
    )
    if (!res.ok) return null
    const data = await res.json()

    // 모델별 집계
    const byModel = {}
    let totalInput = 0, totalOutput = 0
    for (const entry of data.data || []) {
      const model = entry.model || 'unknown'
      if (!byModel[model]) byModel[model] = { input: 0, output: 0 }
      byModel[model].input  += entry.input_tokens  || 0
      byModel[model].output += entry.output_tokens || 0
      totalInput  += entry.input_tokens  || 0
      totalOutput += entry.output_tokens || 0
    }
    return { byModel, totalInput, totalOutput, total: totalInput + totalOutput }
  } catch {
    return null
  }
}

// OpenAI Usage API
async function fetchOpenAIUsage(apiKey) {
  if (!apiKey) return null
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startTime = Math.floor(startOfMonth.getTime() / 1000)
    const endTime   = Math.floor(now.getTime() / 1000)
    const res = await fetch(
      `https://api.openai.com/v1/organization/usage/completions?start_time=${startTime}&end_time=${endTime}&limit=31`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[OpenAI Usage] HTTP', res.status, err)
      return null
    }
    const data = await res.json()
    let totalInput = 0, totalOutput = 0
    for (const entry of data.data || []) {
      const results = entry.results || []
      for (const r of results) {
        totalInput  += r.input_tokens  || 0
        totalOutput += r.output_tokens || 0
      }
    }
    return { total: totalInput + totalOutput, totalInput, totalOutput }
  } catch (e) {
    console.error('[OpenAI Usage] fetch error', e)
    return null
  }
}

const MODEL_LABELS = {
  'claude-opus-4-5':    'Opus',
  'claude-sonnet-4-5':  'Sonnet',
  'claude-haiku-4-5':   'Haiku',
}

function shortModel(model) {
  return MODEL_LABELS[model] || model.replace('claude-', '').split('-').slice(0, 2).join(' ')
}

function fmtNum(n) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`
  return String(n)
}

export default function TokenUsagePanel() {
  const { state } = useApp()
  const [anthropic, setAnthropic] = useState(null)
  const [openai, setOpenai]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const refresh = useCallback(async () => {
    const cfg = state.config?.ai
    if (!cfg) return
    setLoading(true)
    const [a, o] = await Promise.all([
      fetchAnthropicUsage(cfg.anthropicKey),
      fetchOpenAIUsage(cfg.openaiKey),
    ])
    setAnthropic(a)
    setOpenai(o)
    setLastUpdated(new Date())
    setLoading(false)
  }, [state.config?.ai])

  // 설정 로드 후 초기 조회 + 10분마다 갱신
  useEffect(() => {
    if (state.config) {
      refresh()
      const t = setInterval(refresh, 10 * 60 * 1000)
      return () => clearInterval(t)
    }
  }, [state.config, refresh])

  const noKeys = !state.config?.ai?.anthropicKey && !state.config?.ai?.openaiKey

  if (noKeys) {
    return (
      <div style={s.empty}>
        <p>설정에서 API 키를 입력하면 토큰 사용량을 확인할 수 있습니다</p>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      {/* 헤더 */}
      <div style={s.header}>
        <span style={s.headerLabel}>이번 달 누적</span>
        <button style={s.refreshBtn} onClick={refresh} disabled={loading}>
          {loading ? '...' : '새로고침'}
        </button>
        {lastUpdated && (
          <span style={s.updated}>
            {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
          </span>
        )}
      </div>

      {/* Anthropic */}
      {state.config?.ai?.anthropicKey && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Anthropic Claude</div>
          {anthropic ? (
            <>
              <div style={s.totalRow}>
                <span style={s.totalLabel}>총 토큰</span>
                <span style={s.totalVal}>{fmtNum(anthropic.total)}</span>
              </div>
              <div style={s.subRow}>
                <span style={s.subLabel}>입력</span>
                <span style={s.subVal}>{fmtNum(anthropic.totalInput)}</span>
                <span style={s.subLabel}>출력</span>
                <span style={s.subVal}>{fmtNum(anthropic.totalOutput)}</span>
              </div>
              {/* 모델별 바 */}
              <div style={s.bars}>
                {Object.entries(anthropic.byModel).map(([model, usage]) => {
                  const total = usage.input + usage.output
                  const pct = anthropic.total > 0 ? Math.round((total / anthropic.total) * 100) : 0
                  return (
                    <div key={model} style={s.barRow}>
                      <span style={s.barLabel}>{shortModel(model)}</span>
                      <div style={s.barBg}>
                        <div style={{ ...s.barFill, width: `${pct}%`, background: '#378ADD' }} />
                      </div>
                      <span style={s.barVal}>{fmtNum(total)}</span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p style={s.err}>{loading ? '조회 중...' : 'Usage API 조회 실패'}</p>
          )}
        </div>
      )}

      {/* OpenAI */}
      {state.config?.ai?.openaiKey && (
        <div style={s.section}>
          <div style={s.sectionTitle}>OpenAI</div>
          {openai ? (
            <>
              <div style={s.totalRow}>
                <span style={s.totalLabel}>총 토큰</span>
                <span style={s.totalVal}>{fmtNum(openai.total)}</span>
              </div>
              <div style={s.subRow}>
                <span style={s.subLabel}>입력</span>
                <span style={s.subVal}>{fmtNum(openai.totalInput)}</span>
                <span style={s.subLabel}>출력</span>
                <span style={s.subVal}>{fmtNum(openai.totalOutput)}</span>
              </div>
            </>
          ) : (
            <p style={s.err}>{loading ? '조회 중...' : 'Usage API 조회 실패'}</p>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  wrap:  { padding: 12, height: '100%', overflowY: 'auto' },
  empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' },
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  headerLabel: { fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '.06em' },
  refreshBtn: {
    marginLeft: 'auto', background: 'none', border: '1px solid #3a3a3a',
    borderRadius: 4, color: '#666', fontSize: 11, padding: '2px 8px', cursor: 'pointer',
  },
  updated: { fontSize: 10, color: '#444' },
  section: { marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #2a2a2a' },
  sectionTitle: { fontSize: 10, color: '#555', marginBottom: 8, letterSpacing: '.04em' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  totalLabel: { fontSize: 12, color: '#888' },
  totalVal: { fontSize: 20, fontWeight: 600, color: '#ccc', fontVariantNumeric: 'tabular-nums' },
  subRow: { display: 'flex', gap: 12, marginBottom: 8 },
  subLabel: { fontSize: 10, color: '#555' },
  subVal: { fontSize: 11, color: '#888' },
  bars: { display: 'flex', flexDirection: 'column', gap: 5 },
  barRow: { display: 'flex', alignItems: 'center', gap: 6 },
  barLabel: { fontSize: 10, color: '#666', minWidth: 52 },
  barBg: { flex: 1, height: 5, background: '#2a2a2a', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, transition: '.4s' },
  barVal: { fontSize: 10, color: '#666', minWidth: 36, textAlign: 'right' },
  err: { fontSize: 11, color: '#555' },
}
