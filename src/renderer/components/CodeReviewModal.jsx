import React, { useEffect, useState } from 'react'
import { useApp } from '../store/AppContext'

export default function CodeReviewModal() {
  const { state, dispatch } = useApp()
  const { open, target, result, loading } = state.codeReview
  const [diff, setDiff] = useState('')

  useEffect(() => {
    if (!open || !target) return
    setDiff('')

    // diff 내용 먼저 가져오기
    const fetchDiff = async () => {
      let diffResult = ''
      if (target.type === 'git') {
        const res = await window.electronAPI.gitDiff({ repoPath: target.repoPath, hash: target.id })
        diffResult = res.diff || ''
      }
      // SVN은 별도 IPC 추가 가능 (현재는 커밋 메시지만)
      setDiff(diffResult)
      startReview(diffResult)
    }

    fetchDiff()
  }, [open, target])

  const startReview = async (diffContent) => {
    if (!state.config?.ai?.anthropicKey) {
      dispatch({
        type: 'SET_CODE_REVIEW_RESULT',
        payload: { error: 'Anthropic API 키를 설정에서 입력해주세요.' },
      })
      return
    }

    try {
      const prompt = buildPrompt(target, diffContent)
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': state.config.ai.anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error?.message || `API error ${response.status}`)
      }

      const data = await response.json()
      const text = data.content?.map(c => c.text || '').join('') || ''
      dispatch({ type: 'SET_CODE_REVIEW_RESULT', payload: { text } })
    } catch (e) {
      dispatch({ type: 'SET_CODE_REVIEW_RESULT', payload: { error: e.message } })
    }
  }

  if (!open) return null

  return (
    <div style={styles.overlay} onClick={() => dispatch({ type: 'CLOSE_CODE_REVIEW' })}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.headerTitle}>AI 코드 리뷰</div>
            <div style={styles.headerSub}>
              {target?.type?.toUpperCase()} · {target?.id} · {target?.message}
            </div>
          </div>
          <button style={styles.closeBtn} onClick={() => dispatch({ type: 'CLOSE_CODE_REVIEW' })}>✕</button>
        </div>

        <div style={styles.body}>
          {loading ? (
            <div style={styles.loadingWrap}>
              <div style={styles.spinner} />
              <p style={{ color: '#666', fontSize: 13, marginTop: 12 }}>Claude가 코드를 분석하는 중...</p>
            </div>
          ) : result?.error ? (
            <div style={{ color: '#e07070', fontSize: 13, padding: 16 }}>{result.error}</div>
          ) : result?.text ? (
            <pre style={styles.reviewText}>{result.text}</pre>
          ) : null}
        </div>

        {diff && (
          <details style={styles.diffSection}>
            <summary style={styles.diffToggle}>diff 보기</summary>
            <pre style={styles.diffCode}>{diff}</pre>
          </details>
        )}
      </div>
    </div>
  )
}

function buildPrompt(target, diff) {
  return `다음 ${target?.type === 'svn' ? 'SVN' : 'Git'} 커밋을 한국어로 코드 리뷰해주세요.

커밋 ID: ${target?.id}
커밋 메시지: ${target?.message}

${diff ? `변경 내용:\n\`\`\`\n${diff.slice(0, 8000)}\n\`\`\`` : '(diff를 가져올 수 없습니다. 커밋 메시지만으로 리뷰해주세요.)'}

리뷰 항목:
1. 코드 품질 및 개선점
2. 잠재적 버그 또는 위험 요소
3. 성능 관련 제안
4. 전반적인 평가 (👍 / 수정 필요)

간결하게 핵심 위주로 작성해주세요.`
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    width: 700, maxHeight: '80vh', background: '#1e1e1e',
    border: '1px solid #3a3a3a', borderRadius: 10,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  header: {
    padding: '14px 18px', borderBottom: '1px solid #2a2a2a',
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  headerTitle: { fontSize: 14, fontWeight: 600, color: '#e0e0e0', marginBottom: 2 },
  headerSub: { fontSize: 11, color: '#666', fontFamily: 'monospace' },
  closeBtn: {
    background: 'none', border: 'none', color: '#666',
    fontSize: 16, cursor: 'pointer', padding: '0 4px',
  },
  body: { flex: 1, overflowY: 'auto', padding: 16 },
  loadingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: 40,
  },
  spinner: {
    width: 28, height: 28, border: '2px solid #333',
    borderTop: '2px solid #66aaff', borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  reviewText: {
    fontSize: 13, lineHeight: 1.7, color: '#ccc',
    whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans, sans-serif)',
  },
  diffSection: { borderTop: '1px solid #2a2a2a' },
  diffToggle: {
    padding: '8px 16px', fontSize: 11, color: '#666',
    cursor: 'pointer', userSelect: 'none',
  },
  diffCode: {
    padding: '12px 16px', fontSize: 11, color: '#999',
    fontFamily: 'monospace', overflowX: 'auto', maxHeight: 200, overflowY: 'auto',
  },
}
