// ─── Base Provider ───────────────────────────────────────────────
export class IssueProvider {
  constructor(config) { this.config = config }
  async getMyIssues() { throw new Error('Not implemented') }
  async getIssueDetail(id) { throw new Error('Not implemented') }
  async checkConnection() { return false }
}

// ─── Mantis Provider ─────────────────────────────────────────────
export class MantisProvider extends IssueProvider {
  constructor(config) {
    super(config)
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.headers = {
      Authorization: config.apiToken,
      'Content-Type': 'application/json',
    }
  }

  async checkConnection() {
    try {
      const res = await fetch(`${this.baseUrl}/api/rest/users/me`, {
        headers: this.headers,
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async getMyIssues() {
    // 나에게 assigned된 이슈만
    const url = `${this.baseUrl}/api/rest/issues?assigned_to=me&page_size=50`
    const res = await fetch(url, { headers: this.headers })
    if (!res.ok) throw new Error(`Mantis API error: ${res.status}`)
    const data = await res.json()
    return (data.issues || []).map(issue => this._normalize(issue))
  }

  async getIssueDetail(id) {
    const res = await fetch(`${this.baseUrl}/api/rest/issues/${id}`, { headers: this.headers })
    if (!res.ok) throw new Error(`Mantis API error: ${res.status}`)
    const data = await res.json()
    return this._normalize(data.issues?.[0] || data)
  }

  _normalize(issue) {
    return {
      id:       String(issue.id),
      title:    issue.summary,
      status:   issue.status?.label || issue.status?.name || 'unknown',
      priority: issue.priority?.label || 'normal',
      type:     issue.category?.name || issue.severity?.label || 'task',
      url:      `${this.baseUrl}/view.php?id=${issue.id}`,
      updated:  issue.updated_at || issue.created_at,
      provider: 'mantis',
    }
  }
}

// ─── Jira Provider ───────────────────────────────────────────────
export class JiraProvider extends IssueProvider {
  constructor(config) {
    super(config)
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    // Jira Cloud: Basic Auth (email:apiToken → base64)
    const token = btoa(`${config.email}:${config.apiToken}`)
    this.headers = {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    }
  }

  async checkConnection() {
    try {
      const res = await fetch(`${this.baseUrl}/rest/api/3/myself`, {
        headers: this.headers,
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async getMyIssues() {
    const jql = encodeURIComponent('assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC')
    const url = `${this.baseUrl}/rest/api/3/search?jql=${jql}&maxResults=50&fields=summary,status,priority,issuetype,updated`
    const res = await fetch(url, { headers: this.headers })
    if (!res.ok) throw new Error(`Jira API error: ${res.status}`)
    const data = await res.json()
    return (data.issues || []).map(issue => this._normalize(issue))
  }

  async getIssueDetail(id) {
    const res = await fetch(`${this.baseUrl}/rest/api/3/issue/${id}`, { headers: this.headers })
    if (!res.ok) throw new Error(`Jira API error: ${res.status}`)
    const data = await res.json()
    return this._normalize(data)
  }

  _normalize(issue) {
    const f = issue.fields || {}
    return {
      id:       issue.key,
      title:    f.summary,
      status:   f.status?.name || 'unknown',
      priority: f.priority?.name || 'medium',
      type:     f.issuetype?.name || 'task',
      url:      `${this.baseUrl}/browse/${issue.key}`,
      updated:  f.updated,
      provider: 'jira',
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────
export function createIssueProvider(type, config) {
  switch (type) {
    case 'mantis': return new MantisProvider(config)
    case 'jira':   return new JiraProvider(config)
    default:       throw new Error(`Unknown provider: ${type}`)
  }
}
