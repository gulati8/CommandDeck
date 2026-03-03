'use strict';

const appState = {
  overview: null,
  projects: [],
  missions: [],       // all missions across projects for home tab
  currentTab: 'missions',
  currentView: null,   // null = tab view, 'detail' = mission detail, 'project-missions' = project drill-down
  currentRepo: null,
  currentMission: null,
  currentMissionData: null,
  githubOrg: ''
};

// --- Fetch helpers ---

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
}

// --- Formatting ---

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatTimeShort(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function timeClass(iso) {
  if (!iso) return 'time-stalled';
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 15) return '';
  if (mins < 60) return 'time-stale';
  return 'time-stalled';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function badge(status) {
  return `<span class="badge badge-${status}">${status.replace(/_/g, ' ')}</span>`;
}

function statusClass(status) {
  return `status-${status}`;
}

function ghRepoUrl(repo) {
  return `https://github.com/${appState.githubOrg}/${repo}`;
}

function slackChannelUrl(channelId) {
  if (!channelId) return null;
  return `https://app.slack.com/client/T/${channelId}`;
}

function linkIcon(url, label) {
  if (!url) return '';
  return `<a href="${url}" target="_blank" rel="noopener" class="ext-link">${escapeHtml(label)}</a>`;
}

function progressBar(progress) {
  if (!progress || !progress.total) return '';
  const cls = progress.done === progress.total ? 'done' : '';
  return `<div class="progress-bar"><div class="progress-fill ${cls}" style="width:${progress.percent}%"></div></div>`;
}

// --- Data loading ---

async function loadOverview() {
  const data = await fetchJSON('/api/overview');
  if (!data) return;
  appState.overview = data;
  appState.githubOrg = data.config?.github_org || '';
}

async function loadAllMissions() {
  // Load projects first, then missions for each project with active missions
  const projects = await fetchJSON('/api/projects');
  if (!projects) return;
  appState.projects = projects;

  // Fetch missions for all projects in parallel
  const missionPromises = projects
    .filter(p => p.mission_count > 0)
    .map(async (p) => {
      const missions = await fetchJSON(`/api/projects/${encodeURIComponent(p.repo)}/missions`);
      return missions || [];
    });

  const allMissionArrays = await Promise.all(missionPromises);
  appState.missions = allMissionArrays.flat();
}

// --- Render: Missions tab (home) ---

function renderMissionsHome() {
  const container = document.getElementById('missions-home');
  const missions = appState.missions;

  // Separate active from completed/failed
  const activeStatuses = ['planning', 'in_progress', 'pending_approval', 'review'];
  const active = missions.filter(m => activeStatuses.includes(m.status));
  const completed = missions.filter(m => !activeStatuses.includes(m.status));

  // Sort active: most recently updated first
  active.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

  if (!active.length && !completed.length) {
    container.innerHTML = '<div class="empty-state">No missions yet. Start one with the button above.</div>';
    return;
  }

  let html = '';

  if (active.length) {
    html += active.map(m => renderMissionCard(m)).join('');
  } else {
    html += '<div class="empty-state" style="padding:24px">No active missions</div>';
  }

  if (completed.length) {
    // Sort completed by date descending
    completed.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
    const recentCompleted = completed.slice(0, 10);

    html += `<h3 class="section-title" style="margin-top:32px">Recently Completed</h3>`;
    html += recentCompleted.map(m => renderMissionCard(m, true)).join('');
  }

  container.innerHTML = html;
}

function renderMissionCard(m, dimmed) {
  const progress = m.progress || { done: 0, total: 0, percent: 0 };
  const lastActivity = m.updated_at || m.created_at;
  const tClass = dimmed ? '' : timeClass(lastActivity);

  // Determine what's happening
  let contextText = '';
  let warningText = '';
  let actionHtml = '';

  if (m.status === 'in_progress' && m.work_items) {
    const active = m.work_items.filter(w => w.status === 'in_progress');
    if (active.length) {
      const agents = [...new Set(active.map(w => w.assigned_to).filter(Boolean))];
      contextText = `${agents.join(', ')} working on ${active.map(w => w.id).join(', ')}`;
    }
  }

  if (m.status === 'pending_approval') {
    warningText = 'awaiting plan approval';
    actionHtml = `<button class="btn btn-success btn-sm mission-action" onclick="event.stopPropagation(); actionApprove('${escapeHtml(m.repo)}', '${escapeHtml(m.mission_id)}')">Approve</button>`;
  } else if (m.status === 'review' && m.pr?.number) {
    contextText = `PR #${m.pr.number} open`;
    actionHtml = `<button class="btn btn-success btn-sm mission-action" onclick="event.stopPropagation(); actionPRMerge('${escapeHtml(m.repo)}', '${escapeHtml(m.mission_id)}')">Merge PR</button>`;
  } else if (m.pr?.number && m.status !== 'done' && m.status !== 'completed' && m.status !== 'merged') {
    contextText = `PR #${m.pr.number}`;
  }

  // Stalled warning
  if (!dimmed && m.status === 'in_progress') {
    const mins = (Date.now() - new Date(lastActivity).getTime()) / 60000;
    if (mins > 30) {
      warningText = 'no activity ' + relativeTime(lastActivity);
    }
  }

  // No slack thread warning
  if (!dimmed && !m.slack_thread_ts && m.status !== 'done' && m.status !== 'completed' && m.status !== 'merged') {
    if (!warningText) warningText = 'no Slack thread';
  }

  const opacity = dimmed ? 'opacity:0.6;' : '';

  return `<div class="mission-card" style="${opacity}" onclick="showMissionDetail('${escapeHtml(m.repo)}', '${escapeHtml(m.mission_id)}')">
    <div class="mission-card-top">
      <span class="mission-repo">${escapeHtml(m.repo)}</span>
      <span class="mission-id">${escapeHtml(m.mission_id)}</span>
    </div>
    <div class="mission-desc">${escapeHtml(m.description)}</div>
    ${progress.total ? `<div class="mission-progress-row">
      ${progressBar(progress)}
      <span class="progress-label">${progress.done}/${progress.total}</span>
    </div>` : ''}
    <div class="mission-footer">
      <span class="mission-status ${statusClass(m.status)}">${m.status.replace(/_/g, ' ')}</span>
      ${warningText ? `<span class="mission-warning">! ${escapeHtml(warningText)}</span>` : ''}
      ${contextText ? `<span class="mission-context">${escapeHtml(contextText)}</span>` : ''}
      <span class="mission-time ${tClass}">${relativeTime(lastActivity)}</span>
      ${actionHtml}
    </div>
  </div>`;
}

// --- Render: Mission Detail ---

async function showMissionDetail(repo, missionId) {
  appState.currentView = 'detail';
  appState.currentRepo = repo;
  appState.currentMission = missionId;

  // Hide tab content, show detail view
  hideAllViews();
  document.getElementById('view-detail').style.display = 'block';
  document.getElementById('bc-detail-label').textContent = `${repo} / ${missionId}`;

  history.pushState(null, '', `#/${repo}/${missionId}`);

  await loadMissionDetail(repo, missionId);
}

async function loadMissionDetail(repo, missionId) {
  const data = await fetchJSON(`/api/missions/${encodeURIComponent(repo)}/${encodeURIComponent(missionId)}`);
  if (!data) {
    document.getElementById('detail-body').innerHTML = '<div class="empty-state">Mission not found</div>';
    return;
  }

  appState.currentMissionData = data;
  const progress = data.progress || { done: 0, total: 0, percent: 0 };
  const lastActivity = data.updated_at || data.created_at;

  // Header area with actions
  let headerHtml = `<div class="detail-desc">${escapeHtml(data.description)}</div>`;

  // Action bar
  headerHtml += '<div class="action-bar">';
  if (data.status === 'pending_approval') {
    headerHtml += `<button class="btn btn-success" onclick="actionApprove('${escapeHtml(repo)}', '${escapeHtml(missionId)}')">Approve Plan</button>`;
    headerHtml += `<button class="btn btn-danger" onclick="actionReject('${escapeHtml(repo)}', '${escapeHtml(missionId)}')">Reject</button>`;
  }
  if (data.pr?.number) {
    headerHtml += `<button class="btn btn-success" onclick="actionPRMerge('${escapeHtml(repo)}', '${escapeHtml(missionId)}')">Merge PR #${data.pr.number}</button>`;
    headerHtml += `<button class="btn btn-danger" onclick="actionPRClose('${escapeHtml(repo)}', '${escapeHtml(missionId)}')">Close PR</button>`;
  }
  if (!data.slack_thread_ts) {
    headerHtml += `<button class="btn btn-ghost" onclick="openReconnect('${escapeHtml(repo)}', '${escapeHtml(missionId)}', '${escapeHtml(data.status)}', ${data.pr?.number || 'null'})">Reconnect Thread</button>`;
  }
  headerHtml += '</div>';

  // Meta cards
  const elapsed = data.safety?.started_at
    ? ((Date.now() - new Date(data.safety.started_at).getTime()) / 3600000).toFixed(1)
    : null;

  headerHtml += '<div class="detail-meta">';
  headerHtml += `<div class="detail-meta-item">
    <div class="detail-meta-label">Status</div>
    <div class="detail-meta-value">${badge(data.status)}</div>
  </div>`;

  if (progress.total) {
    headerHtml += `<div class="detail-meta-item">
      <div class="detail-meta-label">Progress</div>
      <div class="detail-meta-value">${progress.done} / ${progress.total}</div>
      <div class="detail-meta-sub" style="margin-top:8px">${progressBar(progress)}</div>
    </div>`;
  }

  headerHtml += `<div class="detail-meta-item">
    <div class="detail-meta-label">Last Activity</div>
    <div class="detail-meta-value ${timeClass(lastActivity)}">${relativeTime(lastActivity)}</div>
    <div class="detail-meta-sub">${formatTime(lastActivity)}</div>
  </div>`;

  headerHtml += `<div class="detail-meta-item">
    <div class="detail-meta-label">Links</div>
    <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">
      ${data.pr?.url ? linkIcon(data.pr.url, 'PR #' + data.pr.number) : '<span style="color:var(--text-dim);font-size:13px">No PR</span>'}
      ${linkIcon(ghRepoUrl(repo), 'Repository')}
      ${data.slack_channel ? linkIcon(slackChannelUrl(data.slack_channel), 'Slack') : ''}
    </div>
  </div>`;

  if (elapsed !== null) {
    headerHtml += `<div class="detail-meta-item">
      <div class="detail-meta-label">Safety</div>
      <div class="detail-meta-sub">Sessions: ${data.safety?.session_count ?? '?'} / ${data.safety?.max_sessions ?? '?'}</div>
      <div class="detail-meta-sub">Elapsed: ${elapsed}h / ${data.safety?.max_elapsed_hours ?? '?'}h</div>
      <div class="detail-meta-sub">Workers: ${data.safety?.max_parallel_workers ?? '?'} max</div>
    </div>`;
  }

  headerHtml += '</div>';
  document.getElementById('detail-header').innerHTML = headerHtml;

  // Body: objectives, timeline, alerts, session log
  let bodyHtml = '';

  // Objectives
  if (data.work_items?.length) {
    bodyHtml += `<h3 class="section-title">Objectives</h3>`;
    bodyHtml += `<table class="obj-table"><thead><tr>
      <th>ID</th><th>Title</th><th>Agent</th><th>Status</th><th>Risk</th><th>Evidence</th>
    </tr></thead><tbody>`;
    for (const w of data.work_items) {
      const riskHtml = (w.risk_flags || []).map(f => `<span class="risk-flag">${escapeHtml(f)}</span>`).join('');
      const evSummary = w.evidence ? (w.evidence.tests?.result || 'yes') : '--';
      bodyHtml += `<tr class="no-click">
        <td style="white-space:nowrap;color:var(--text-dim)">${escapeHtml(w.id)}</td>
        <td>${escapeHtml(w.title || w.description || '')}</td>
        <td class="agent-name">${escapeHtml(w.assigned_to || '--')}</td>
        <td>${badge(w.status)}</td>
        <td>${riskHtml || '<span style="color:var(--text-dim)">--</span>'}</td>
        <td style="color:var(--text-secondary)">${evSummary}</td>
      </tr>`;
    }
    bodyHtml += '</tbody></table>';
  }

  // Health alerts
  if (data.health_alerts?.length) {
    bodyHtml += `<h3 class="section-title">Health Alerts</h3>`;
    for (const a of data.health_alerts) {
      const cls = a.level === 'red' ? '' : ' warning';
      bodyHtml += `<div class="alert-item${cls}">
        <strong>${escapeHtml(a.type)}</strong> [${escapeHtml(a.objective || '')}] — ${escapeHtml(a.message)}
        <span style="color:var(--text-dim);float:right">${formatTime(a.ts)}</span>
      </div>`;
    }
  }

  // Timeline
  if (data.timeline?.length) {
    bodyHtml += `<h3 class="section-title">Timeline (${data.timeline.length})</h3>`;
    bodyHtml += '<div class="timeline">';
    for (const e of data.timeline) {
      const payloadStr = Object.entries(e.payload || {})
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(', ');
      bodyHtml += `<div class="timeline-entry">
        <span class="timeline-ts">${formatTimeShort(e.ts)}</span>
        <span class="timeline-event">${escapeHtml(e.event)}</span>
        <span class="timeline-detail">${payloadStr ? escapeHtml(payloadStr) : ''}</span>
        ${e.actor ? `<span class="timeline-actor">${escapeHtml(e.actor)}</span>` : ''}
      </div>`;
    }
    bodyHtml += '</div>';
  }

  // Session log
  if (data.session_log?.length) {
    bodyHtml += `<h3 class="section-title">Session Log (${data.session_log.length})</h3>`;
    const recent = data.session_log.slice(-20).reverse();
    for (const s of recent) {
      const dur = s.started_at && s.ended_at
        ? Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 1000) + 's'
        : 'running';
      bodyHtml += `<div class="session-entry">
        <span><span class="agent-name">${escapeHtml(s.agent || '?')}</span> ${escapeHtml(s.objective || '')} — exit: ${s.exit_code ?? '?'} — ${dur}</span>
        <span style="color:var(--text-dim)">${formatTime(s.started_at)}</span>
      </div>`;
    }
  }

  document.getElementById('detail-body').innerHTML = bodyHtml;
}

// --- Render: Projects tab ---

function renderProjects() {
  const grid = document.getElementById('projects-grid');
  const projects = appState.projects;

  if (!projects.length) {
    grid.innerHTML = '<div class="empty-state">No projects with CommandDeck activity</div>';
    return;
  }

  grid.innerHTML = projects.map(p => `
    <div class="project-card" onclick="showProjectMissions('${escapeHtml(p.repo)}')">
      <div class="project-name">${escapeHtml(p.repo)}</div>
      <div class="project-meta">
        <span>${p.config?.default_branch || 'main'} / ${p.config?.max_workers || 1}w</span>
        <span class="project-missions-count">${p.mission_count} mission${p.mission_count !== 1 ? 's' : ''}</span>
      </div>
      <div class="project-links" onclick="event.stopPropagation()">
        ${linkIcon(ghRepoUrl(p.repo), 'GitHub')}
        ${p.channel_id ? linkIcon(slackChannelUrl(p.channel_id), 'Slack') : ''}
      </div>
    </div>
  `).join('');
}

// --- Project missions sub-view ---

async function showProjectMissions(repo) {
  appState.currentView = 'project-missions';
  appState.currentRepo = repo;

  hideAllViews();
  document.getElementById('view-project-missions').style.display = 'block';
  document.getElementById('bc-project-label').textContent = repo;

  history.pushState(null, '', `#/projects/${repo}`);

  const data = await fetchJSON(`/api/projects/${encodeURIComponent(repo)}/missions`);
  const container = document.getElementById('project-missions-list');

  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state">No missions for this project</div>';
    return;
  }

  let html = `<table class="data-table"><thead><tr>
    <th>Mission</th><th>Description</th><th>Status</th><th>Progress</th><th>Updated</th><th>Links</th>
  </tr></thead><tbody>`;

  for (const m of data) {
    const progress = m.progress || { done: 0, total: 0, percent: 0 };
    html += `<tr onclick="showMissionDetail('${escapeHtml(repo)}', '${escapeHtml(m.mission_id)}')">
      <td style="white-space:nowrap;color:var(--text-dim);font-size:12px">${escapeHtml(m.mission_id)}</td>
      <td>${escapeHtml(m.description)}</td>
      <td>${badge(m.status)}</td>
      <td style="min-width:120px">
        ${progress.total ? `<div style="display:flex;align-items:center;gap:8px">
          ${progressBar(progress)}
          <span style="font-size:12px;color:var(--blue);font-weight:700">${progress.done}/${progress.total}</span>
        </div>` : ''}
      </td>
      <td style="white-space:nowrap;color:var(--text-dim);font-size:12px">${relativeTime(m.updated_at || m.created_at)}</td>
      <td onclick="event.stopPropagation()">${m.pr?.url ? linkIcon(m.pr.url, 'PR #' + m.pr.number) : ''}</td>
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// --- Render: System tab ---

async function renderSystem() {
  const dot = document.getElementById('server-dot');
  const info = document.getElementById('server-info');
  const title = document.getElementById('containers-title');

  dot.className = 'status-dot online';
  const uptime = appState.overview?.uptime;
  info.innerHTML = uptime != null
    ? `Uptime: ${formatUptime(uptime)} &middot; ${appState.overview?.active_workers ?? 0} active workers &middot; ${appState.overview?.total_missions ?? 0} total missions`
    : 'Loading...';

  // Containers
  const data = await fetchJSON('/api/containers');
  const grid = document.getElementById('containers-grid');
  if (!data || !data.length) {
    title.textContent = 'Containers';
    grid.innerHTML = '<div class="empty-state">No container data available</div>';
    return;
  }

  const running = data.filter(c => c.state === 'running').length;
  title.textContent = `Containers (${running} running, ${data.length} total)`;

  grid.innerHTML = data.map(c => {
    const healthBadge = c.health ? `<span class="c-health ${c.health}">${c.health}</span>` : '';
    return `<div class="container-card">
      <span class="status-dot ${c.state === 'running' ? 'online' : 'offline'}"></span>
      <span class="c-name">${escapeHtml(c.name)}</span>
      <span class="c-state ${c.state}">${c.state}</span>
      ${healthBadge}
    </div>`;
  }).join('');
}

// --- Actions ---

async function actionApprove(repo, missionId) {
  if (!confirm('Approve this plan and start execution?')) return;
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Approving...';
  const result = await postJSON(`/api/missions/${encodeURIComponent(repo)}/${encodeURIComponent(missionId)}/approve`, {});
  if (result.ok) {
    await refresh();
    if (appState.currentView === 'detail') await loadMissionDetail(repo, missionId);
  } else {
    alert('Failed: ' + (result.data?.error || 'unknown error'));
    btn.disabled = false;
    btn.textContent = 'Approve';
  }
}

async function actionReject(repo, missionId) {
  if (!confirm('Reject this plan and abort the mission?')) return;
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Rejecting...';
  const result = await postJSON(`/api/missions/${encodeURIComponent(repo)}/${encodeURIComponent(missionId)}/reject`, {});
  if (result.ok) {
    await refresh();
    if (appState.currentView === 'detail') await loadMissionDetail(repo, missionId);
  } else {
    alert('Failed: ' + (result.data?.error || 'unknown error'));
    btn.disabled = false;
    btn.textContent = 'Reject';
  }
}

async function actionPRMerge(repo, missionId) {
  if (!confirm('Merge this PR?')) return;
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Merging...';
  const result = await postJSON(`/api/missions/${encodeURIComponent(repo)}/${encodeURIComponent(missionId)}/pr/merge`, {});
  if (result.ok) {
    await refresh();
    if (appState.currentView === 'detail') await loadMissionDetail(repo, missionId);
  } else {
    alert('Failed: ' + (result.data?.error || 'unknown error'));
    btn.disabled = false;
  }
}

async function actionPRClose(repo, missionId) {
  if (!confirm('Close this PR without merging?')) return;
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Closing...';
  const result = await postJSON(`/api/missions/${encodeURIComponent(repo)}/${encodeURIComponent(missionId)}/pr/close`, {});
  if (result.ok) {
    await refresh();
    if (appState.currentView === 'detail') await loadMissionDetail(repo, missionId);
  } else {
    alert('Failed: ' + (result.data?.error || 'unknown error'));
    btn.disabled = false;
  }
}

// --- Modals ---

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function openStartMission(preselectedRepo) {
  const modal = document.getElementById('modal-start-mission');
  const select = document.getElementById('sm-project');
  const prompt = document.getElementById('sm-prompt');
  const submit = document.getElementById('sm-submit');

  select.innerHTML = appState.projects.map(p =>
    `<option value="${escapeHtml(p.repo)}" ${p.repo === preselectedRepo ? 'selected' : ''}>${escapeHtml(p.repo)}</option>`
  ).join('');

  prompt.value = '';
  submit.disabled = false;
  submit.textContent = 'Start Mission';
  modal.style.display = 'flex';
  prompt.focus();
}

async function submitStartMission() {
  const repo = document.getElementById('sm-project').value;
  const prompt = document.getElementById('sm-prompt').value.trim();
  const slackThread = document.getElementById('sm-slack').checked;
  const submit = document.getElementById('sm-submit');

  if (!prompt) { alert('Please describe the task.'); return; }

  submit.disabled = true;
  submit.textContent = 'Starting...';

  const result = await postJSON('/api/missions', { repo, prompt, slack_thread: slackThread });
  if (result.ok && result.data?.mission_id) {
    closeModal('modal-start-mission');
    await refresh();
    showMissionDetail(repo, result.data.mission_id);
  } else {
    alert('Failed: ' + (result.data?.error || 'unknown error'));
    submit.disabled = false;
    submit.textContent = 'Start Mission';
  }
}

function openReconnect(repo, missionId, status, prNumber) {
  const modal = document.getElementById('modal-reconnect');
  document.getElementById('rc-mission-id').textContent = missionId;
  document.getElementById('rc-status').innerHTML = badge(status) + (prNumber ? ` &middot; PR #${prNumber}` : '');
  document.getElementById('rc-url').value = '';
  document.getElementById('rc-submit').disabled = false;
  document.getElementById('rc-submit').textContent = 'Reconnect';

  modal.dataset.repo = repo;
  modal.dataset.missionId = missionId;
  modal.style.display = 'flex';
  document.getElementById('rc-url').focus();
}

async function submitReconnect() {
  const modal = document.getElementById('modal-reconnect');
  const repo = modal.dataset.repo;
  const missionId = modal.dataset.missionId;
  const url = document.getElementById('rc-url').value.trim();
  const submit = document.getElementById('rc-submit');

  if (!url) { alert('Please paste a Slack thread URL.'); return; }

  submit.disabled = true;
  submit.textContent = 'Reconnecting...';

  const result = await postJSON(
    `/api/missions/${encodeURIComponent(repo)}/${encodeURIComponent(missionId)}/reconnect`,
    { slack_thread_url: url }
  );

  if (result.ok) {
    closeModal('modal-reconnect');
    await refresh();
    if (appState.currentView === 'detail') await loadMissionDetail(repo, missionId);
  } else {
    alert('Failed: ' + (result.data?.error || 'unknown error'));
    submit.disabled = false;
    submit.textContent = 'Reconnect';
  }
}

// --- Navigation ---

function hideAllViews() {
  document.querySelectorAll('.tab-content').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });
}

function switchTab(tabName) {
  appState.currentView = null;
  appState.currentRepo = null;
  appState.currentMission = null;
  appState.currentMissionData = null;
  appState.currentTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });

  hideAllViews();
  const tabEl = document.getElementById(`tab-${tabName}`);
  if (tabEl) {
    tabEl.style.display = 'block';
    tabEl.classList.add('active');
  }

  // Render tab content
  if (tabName === 'missions') {
    renderMissionsHome();
    history.pushState(null, '', '#/');
  } else if (tabName === 'projects') {
    renderProjects();
    history.pushState(null, '', '#/projects');
  } else if (tabName === 'system') {
    renderSystem();
    history.pushState(null, '', '#/system');
  }
}

// --- Hash routing ---

function routeFromHash() {
  const hash = location.hash.replace('#/', '').replace('#', '');
  if (!hash) return switchTab('missions');

  const parts = hash.split('/');

  // #/system
  if (parts[0] === 'system') return switchTab('system');

  // #/projects or #/projects/repo
  if (parts[0] === 'projects') {
    if (parts[1]) return showProjectMissions(parts[1]);
    return switchTab('projects');
  }

  // #/repo/missionId — mission detail
  if (parts.length === 2) return showMissionDetail(parts[0], parts[1]);

  // #/repo — project missions
  if (parts.length === 1 && parts[0]) return showProjectMissions(parts[0]);

  switchTab('missions');
}

// --- Refresh loop ---

async function refresh() {
  await loadOverview();
  await loadAllMissions();

  // Re-render current view if it's a tab
  if (!appState.currentView) {
    if (appState.currentTab === 'missions') renderMissionsHome();
    else if (appState.currentTab === 'projects') renderProjects();
    else if (appState.currentTab === 'system') renderSystem();
  }
}

// --- Init ---

window.addEventListener('popstate', routeFromHash);
window.addEventListener('hashchange', routeFromHash);

refresh().then(() => routeFromHash());
setInterval(refresh, 15000);
