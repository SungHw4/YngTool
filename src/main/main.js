const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron')
const path = require('path')
const isDev = process.env.ELECTRON_IS_DEV === '1'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,          // 커스텀 타이틀바
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../public/icon.ico'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../build/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ─── IPC: 윈도우 컨트롤 ───────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow.minimize())
ipcMain.on('window-maximize', () => {
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('window-close', () => mainWindow.close())

// ─── IPC: SVN ────────────────────────────────────────────────────
const { execSync, exec, execFile } = require('child_process')

ipcMain.handle('svn:log', async (_, { repoPath, limit = 20 }) => {
  return new Promise((resolve) => {
    const cmd = `svn log "${repoPath}" --limit ${limit} --xml`
    exec(cmd, { encoding: 'utf8' }, (err, stdout) => {
      if (err) return resolve({ error: err.message, items: [] })
      try {
        const items = parseSvnXml(stdout)
        resolve({ items })
      } catch (e) {
        resolve({ error: e.message, items: [] })
      }
    })
  })
})

ipcMain.handle('svn:check', async () => {
  try {
    execSync('svn --version --quiet', { encoding: 'utf8', stdio: 'pipe' })
    return { available: true }
  } catch {
    return { available: false }
  }
})

function parseSvnXml(xml) {
  // 간단한 SVN XML 파싱 (xml2js 없이)
  const entries = []
  const logentryRegex = /<logentry\s+revision="(\d+)">([\s\S]*?)<\/logentry>/g
  let m
  while ((m = logentryRegex.exec(xml)) !== null) {
    const revision = m[1]
    const body = m[2]
    const author = (body.match(/<author>(.*?)<\/author>/) || [])[1] || ''
    const date = (body.match(/<date>(.*?)<\/date>/) || [])[1] || ''
    const msg = (body.match(/<msg>([\s\S]*?)<\/msg>/) || [])[1]?.trim() || ''
    entries.push({ revision, author, date, message: msg, type: 'svn' })
  }
  return entries
}

// ─── IPC: Git ────────────────────────────────────────────────────
ipcMain.handle('git:log', async (_, { repoPath, limit = 20 }) => {
  return new Promise((resolve) => {
    const fmt = '--pretty=format:%H\x1f%an\x1f%ae\x1f%ai\x1f%s'
    execFile('git', ['-C', repoPath, 'log', fmt, `-n`, String(limit)], { encoding: 'utf8' }, (err, stdout) => {
      if (err) return resolve({ error: err.message, items: [] })
      const items = stdout.trim().split('\n').filter(Boolean).map(line => {
        const [hash, author, email, date, ...msgParts] = line.split('\x1f')
        return { hash: hash?.slice(0, 7), author, email, date, message: msgParts.join('\x1f'), type: 'git' }
      })
      resolve({ items })
    })
  })
})

ipcMain.handle('git:diff', async (_, { repoPath, hash }) => {
  return new Promise((resolve) => {
    execFile('git', ['-C', repoPath, 'show', hash, '--stat'], { encoding: 'utf8' }, (err, stdout) => {
      if (err) return resolve({ error: err.message, diff: '' })
      resolve({ diff: stdout })
    })
  })
})

// ─── IPC: 연결 상태 체크 ─────────────────────────────────────────
const http = require('http')
const https = require('https')

ipcMain.handle('connection:check', async (_, { url, timeout = 3000 }) => {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http
      const req = client.get(url, { timeout }, () => resolve({ ok: true }))
      req.on('error', () => resolve({ ok: false }))
      req.on('timeout', () => { req.destroy(); resolve({ ok: false }) })
    } catch {
      resolve({ ok: false })
    }
  })
})

// ─── IPC: Anthropic Usage ────────────────────────────────────────
ipcMain.handle('anthropic:usage', async (_, { apiKey }) => {
  return new Promise((resolve) => {
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const start = startOfMonth.toISOString().split('T')[0]
      const end = now.toISOString().split('T')[0]
      const options = {
        hostname: 'api.anthropic.com',
        path: `/v1/usage?start_date=${start}&end_date=${end}`,
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      }
      const req = https.request(options, (res) => {
        let body = ''
        res.on('data', chunk => body += chunk)
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) return resolve({ error: `HTTP ${res.statusCode}` })
            resolve({ data: JSON.parse(body) })
          } catch {
            resolve({ error: 'parse error' })
          }
        })
      })
      req.on('error', (e) => resolve({ error: e.message }))
      req.end()
    } catch (e) {
      resolve({ error: e.message })
    }
  })
})

// ─── IPC: 설정 저장/로드 ─────────────────────────────────────────
const fs = require('fs')
const configPath = path.join(app.getPath('userData'), 'config.json')

ipcMain.handle('config:load', async () => {
  try {
    if (!fs.existsSync(configPath)) return { data: getDefaultConfig() }
    const raw = fs.readFileSync(configPath, 'utf8')
    return { data: JSON.parse(raw) }
  } catch (e) {
    return { data: getDefaultConfig(), error: e.message }
  }
})

ipcMain.handle('config:save', async (_, config) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

function getDefaultConfig() {
  return {
    mantis:  { baseUrl: '', apiToken: '', enabled: false },
    jira:    { baseUrl: '', email: '', apiToken: '', enabled: false },
    svn:     { repoPaths: [], enabled: false },
    git:     { repoPaths: [], enabled: false },
    ai:      { anthropicKey: '', openaiKey: '' },
    gmail:   {
      enabled: false, clientId: '', clientSecret: '',
      accessToken: '', refreshToken: '', expiresAt: 0, connectedEmail: '',
    },
    general: { pollIntervalMinutes: 5, theme: 'dark' },
  }
}

// ─── IPC: 알림 저장/로드 ─────────────────────────────────────────
const notifPath = path.join(app.getPath('userData'), 'notifications.json')

ipcMain.handle('notifications:load', async () => {
  try {
    if (!fs.existsSync(notifPath)) return { items: [], jiraSnapshot: {}, notifiedSchedules: [] }
    return JSON.parse(fs.readFileSync(notifPath, 'utf8'))
  } catch {
    return { items: [], jiraSnapshot: {}, notifiedSchedules: [] }
  }
})

ipcMain.handle('notifications:save', async (_, data) => {
  try {
    fs.writeFileSync(notifPath, JSON.stringify(data, null, 2), 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ─── IPC: Windows 토스트 알림 ────────────────────────────────────
const { Notification } = require('electron')

ipcMain.handle('notification:toast', async (_, { title, body }) => {
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body, silent: false }).show()
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ─── IPC: Gmail ───────────────────────────────────────────────────
function gmailApiGet(path, accessToken) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'gmail.googleapis.com',
      path: `/gmail/v1/users/me/${path}`,
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    }
    const req = https.get(options, (res) => {
      let data = ''
      res.on('data', c => (data += c))
      res.on('end', () => {
        try {
          if (res.statusCode === 401) return resolve({ error: 'unauthorized' })
          if (res.statusCode !== 200) return resolve({ error: `HTTP ${res.statusCode}` })
          resolve({ data: JSON.parse(data) })
        } catch {
          resolve({ error: 'parse error' })
        }
      })
    })
    req.on('error', (e) => resolve({ error: e.message }))
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }) })
  })
}

// Gmail OAuth2 인증: 로컬 서버로 code 캡처 → 토큰 교환까지 한 번에 처리
ipcMain.handle('gmail:auth', async (_, { clientId, clientSecret }) => {
  const http_local = require('http')
  return new Promise((resolve) => {
    let handled = false
    let port = null
    let timeoutId = null

    const server = http_local.createServer((req, res) => {
      // favicon 등 2차 요청 무시
      if (handled) { res.writeHead(204); res.end(); return }

      try {
        const urlObj = new URL(req.url, 'http://localhost')
        const code   = urlObj.searchParams.get('code')
        const errMsg = urlObj.searchParams.get('error')

        const html = (msg) =>
          `<!DOCTYPE html><html><head><meta charset="utf-8">
          <style>body{font-family:sans-serif;background:#1a1a1a;color:#ccc;
          display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
          h2{font-size:1.2rem}</style></head>
          <body><h2>${msg}</h2></body></html>`

        if (!code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(html(`✗ 인증 실패: ${errMsg || '알 수 없는 오류'}`))
          handled = true; clearTimeout(timeoutId); server.close()
          return resolve({ error: errMsg || 'no_code' })
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html('✓ 인증 완료! YngTool 창으로 돌아가세요.'))
        handled = true; clearTimeout(timeoutId); server.close()

        // code → tokens 교환
        const redirectUri = `http://localhost:${port}`
        const body = new URLSearchParams({
          code, client_id: clientId, client_secret: clientSecret,
          redirect_uri: redirectUri, grant_type: 'authorization_code',
        }).toString()

        const postReq = https.request({
          hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body),
          },
        }, (postRes) => {
          let d = ''
          postRes.on('data', c => (d += c))
          postRes.on('end', () => {
            try {
              const json = JSON.parse(d)
              if (json.error) return resolve({ error: json.error_description || json.error })
              resolve({
                accessToken:  json.access_token,
                refreshToken: json.refresh_token,
                expiresAt:    Date.now() + (json.expires_in - 60) * 1000,
              })
            } catch { resolve({ error: 'token parse error' }) }
          })
        })
        postReq.on('error', (e) => resolve({ error: e.message }))
        postReq.write(body); postReq.end()
      } catch (e) {
        handled = true; clearTimeout(timeoutId); server.close()
        resolve({ error: e.message })
      }
    })

    server.on('error', (e) => resolve({ error: e.message }))

    server.listen(0, '127.0.0.1', () => {
      port = server.address().port
      const scope = 'https://www.googleapis.com/auth/gmail.readonly'
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('redirect_uri', `http://localhost:${port}`)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', scope)
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'consent')
      shell.openExternal(authUrl.toString())

      timeoutId = setTimeout(() => {
        try { server.close() } catch {}
        if (!handled) resolve({ error: 'timeout' })
      }, 5 * 60 * 1000)
    })
  })
})

// 액세스 토큰 갱신
ipcMain.handle('gmail:refresh-token', async (_, { clientId, clientSecret, refreshToken }) => {
  return new Promise((resolve) => {
    const body = new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token',
    }).toString()

    const req = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let d = ''
      res.on('data', c => (d += c))
      res.on('end', () => {
        try {
          const json = JSON.parse(d)
          if (json.error) return resolve({ error: json.error_description || json.error })
          resolve({
            accessToken: json.access_token,
            expiresAt:   Date.now() + (json.expires_in - 60) * 1000,
          })
        } catch { resolve({ error: 'parse error' }) }
      })
    })
    req.on('error', (e) => resolve({ error: e.message }))
    req.write(body); req.end()
  })
})

// 메일 목록 조회 (metadata: 제목/발신자/날짜/읽음 여부)
ipcMain.handle('gmail:fetch-messages', async (_, { accessToken, maxResults = 20 }) => {
  try {
    const listRes = await gmailApiGet(
      `messages?maxResults=${maxResults}&labelIds=INBOX&fields=messages(id)`,
      accessToken
    )
    if (listRes.error) return { error: listRes.error, items: [] }

    const ids = (listRes.data.messages || []).map(m => m.id)
    const fields = 'id,snippet,labelIds,payload(headers)'
    const metaHeaders = 'Subject,From,Date'

    const items = (await Promise.all(ids.map(id =>
      gmailApiGet(
        `messages/${id}?format=metadata&metadataHeaders=${encodeURIComponent(metaHeaders)}&fields=${encodeURIComponent(fields)}`,
        accessToken
      )
    ))).map(r => {
      if (r.error || !r.data) return null
      const msg = r.data
      const hdr = (name) =>
        (msg.payload?.headers || []).find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
      return {
        id:       msg.id,
        subject:  hdr('Subject') || '(제목 없음)',
        from:     hdr('From'),
        date:     hdr('Date'),
        snippet:  msg.snippet || '',
        isUnread: (msg.labelIds || []).includes('UNREAD'),
      }
    }).filter(Boolean)

    return { items }
  } catch (e) {
    return { error: e.message, items: [] }
  }
})

// 메일 본문 조회
ipcMain.handle('gmail:fetch-message-body', async (_, { accessToken, messageId }) => {
  const res = await gmailApiGet(`messages/${messageId}?format=full`, accessToken)
  if (res.error) return { error: res.error }

  // MIME 파트에서 text/html 또는 text/plain 추출
  function findPart(payload, mimeType) {
    if (!payload) return null
    if (payload.mimeType === mimeType) return payload
    if (payload.parts) {
      for (const part of payload.parts) {
        const found = findPart(part, mimeType)
        if (found) return found
      }
    }
    return null
  }

  function decodeBody(part) {
    if (!part?.body?.data) return ''
    const b64 = part.body.data.replace(/-/g, '+').replace(/_/g, '/')
    try { return Buffer.from(b64, 'base64').toString('utf-8') } catch { return '' }
  }

  const payload = res.data.payload
  const htmlPart = findPart(payload, 'text/html')
  const textPart = findPart(payload, 'text/plain')

  return {
    html:  decodeBody(htmlPart),
    text:  decodeBody(textPart),
    hasHtml: !!htmlPart?.body?.data,
  }
})
