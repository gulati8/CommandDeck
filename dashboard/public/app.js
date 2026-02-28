'use strict';

let appState = {
  overview: null,
  projects: [],
  pending: null,
  currentView: 'projects', // projects | missions | detail
  currentRepo: null,
  currentMission: null,
  githubOrg: ''
};

// --- Fetch helpers ---

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
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

function badge(status) {
  return `<span class="badge badge-${status}">${status.replace(/_/g, ' ')}</span>`;
}

function progressBar(progress) {
  if (!progress || !progress.total) return '<span class="badge badge-planning">no items</span>';
  return `<div style="display:flex;align-items:center;gap:8px;">
    <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${progress.percent}%"></div></div>
    <span style="font-size:13px;color:var(--blue-bright);font-weight:700">${progress.done}/${progress.total}</span>
  </div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

// --- Data loading ---

async function loadOverview() {
  const data = await fetchJSON('/api/overview');
  if (!data) return;
  appState.overview = data;
  appState.githubOrg = data.config?.github_org || '';

  document.getElementById('org-badge').textContent = data.config?.github_org || '';
  document.getElementById('domain-label').textContent = data.config?.domain || '';
  document.getElementById('uptime').textContent = formatUptime(data.uptime);
  document.getElementById('m-projects').textContent = data.projects;
  document.getElementById('m-active').textContent = data.active_missions;
  document.getElementById('m-total').textContent = data.total_missions;
}

async function loadPending() {
  const data = await fetchJSON('/api/pending');
  if (!data) return;
  appState.pending = data;

  const total = (data.pr_approvals?.length || 0) + (data.plan_approvals?.length || 0) + (data.active_threads?.length || 0);
  document.getElementById('m-pending').textContent = total;

  const section = document.getElementById('pending-section');
  const body = document.getElementById('pending-body');

  if (total === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  let html = '';

  if (data.pr_approvals?.length) {
    html += `<div class="pending-group"><h3>PRs Awaiting Approval (${data.pr_approvals.length})</h3>`;
    for (const pr of data.pr_approvals) {
      html += `<div class="pending-item">
        <span class="repo-tag">${escapeHtml(pr.repo)}</span>
        <span>PR #${pr.pr_number}</span>
        ${linkIcon(pr.pr_url, 'GitHub')}
        ${linkIcon(slackChannelUrl(pr.channel), 'Slack')}
        <span style="color:var(--text-dim);margin-left:auto">${relativeTime(pr.tracked_at)}</span>
      </div>`;
    }
    html += '</div>';
  }

  if (data.plan_approvals?.length) {
    html += `<div class="pending-group"><h3>Plans Awaiting Approval (${data.plan_approvals.length})</h3>`;
    for (const plan of data.plan_approvals) {
      html += `<div class="pending-item">
        <span class="repo-tag">${escapeHtml(plan.repo)}</span>
        <span>${escapeHtml(plan.mission_id)}</span>
        ${linkIcon(slackChannelUrl(plan.channel), 'Slack')}
        <span style="color:var(--text-dim);margin-left:auto">${relativeTime(plan.tracked_at)}</span>
      </div>`;
    }
    html += '</div>';
  }

  if (data.active_threads?.length) {
    html += `<div class="pending-group"><h3>Active Threads (${data.active_threads.length})</h3>`;
    for (const t of data.active_threads) {
      html += `<div class="pending-item">
        <span class="repo-tag">${escapeHtml(t.repo)}</span>
        ${badge(t.status)}
        <span style="color:var(--text-dim)">follow-ups: ${t.follow_up_count || 0}</span>
        ${linkIcon(slackChannelUrl(t.channel), 'Slack')}
      </div>`;
    }
    html += '</div>';
  }

  body.innerHTML = html;
}

async function loadProjects() {
  const data = await fetchJSON('/api/projects');
  if (!data) return;
  appState.projects = data;

  const grid = document.getElementById('projects-grid');
  if (!data.length) {
    grid.innerHTML = '<div class="empty-state">No projects with CommandDeck activity</div>';
    return;
  }

  grid.innerHTML = data.map(p => `
    <div class="project-card" onclick="navigateTo('missions', '${escapeHtml(p.repo)}')">
      <div class="repo-name">${escapeHtml(p.repo)}</div>
      <div class="card-meta">
        <span>${p.config?.default_branch || 'main'} / ${p.config?.max_workers || 1}w</span>
        <span class="mission-count">${p.mission_count} mission${p.mission_count !== 1 ? 's' : ''}</span>
      </div>
      <div class="card-meta" style="margin-top:4px">
        ${linkIcon(ghRepoUrl(p.repo), 'GitHub')}
        ${p.channel_id ? linkIcon(slackChannelUrl(p.channel_id), 'Slack') : ''}
      </div>
    </div>
  `).join('');
}

async function loadMissions(repo) {
  const data = await fetchJSON(`/api/projects/${encodeURIComponent(repo)}/missions`);
  if (!data) return;

  const container = document.getElementById('missions-list');
  document.getElementById('missions-title').textContent = `${repo} Missions`;

  if (!data.length) {
    container.innerHTML = '<div class="empty-state">No missions for this project</div>';
    return;
  }

  let html = `<table class="data-table"><thead><tr>
    <th>Mission</th><th>Description</th><th>Status</th><th>Progress</th><th>Created</th><th>Links</th>
  </tr></thead><tbody>`;

  for (const m of data) {
    html += `<tr onclick="navigateTo('detail', '${escapeHtml(repo)}', '${escapeHtml(m.mission_id)}')">
      <td style="white-space:nowrap;color:var(--text-dim);font-size:12px">${escapeHtml(m.mission_id)}</td>
      <td>${escapeHtml(m.description)}</td>
      <td>${badge(m.status)}</td>
      <td style="min-width:120px">${progressBar(m.progress)}</td>
      <td style="white-space:nowrap;font-size:12px;color:var(--text-dim)">${formatTime(m.created_at)}<br>${relativeTime(m.created_at)}</td>
      <td onclick="event.stopPropagation()">${m.pr?.url ? linkIcon(m.pr.url, 'PR #' + m.pr.number) : ''}</td>
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function loadMissionDetail(repo, missionId) {
  const data = await fetchJSON(`/api/missions/${encodeURIComponent(repo)}/${encodeURIComponent(missionId)}`);
  if (!data) return;

  document.getElementById('detail-title').textContent = missionId;
  const body = document.getElementById('detail-body');

  const elapsed = data.safety?.started_at
    ? ((Date.now() - new Date(data.safety.started_at).getTime()) / 3600000).toFixed(1)
    : '?';

  let html = `
    <p style="margin-bottom:12px;color:var(--text)">${escapeHtml(data.description)}</p>
    <div class="detail-grid">
      <div class="detail-card">
        <h3>Status</h3>
        <div class="val">${badge(data.status)}</div>
        <div class="sub">${progressBar(data.progress)}</div>
      </div>
      <div class="detail-card">
        <h3>Safety Limits</h3>
        <div class="sub">Sessions: ${data.safety?.session_count ?? '?'} / ${data.safety?.max_sessions ?? '?'}</div>
        <div class="sub">Elapsed: ${elapsed}h / ${data.safety?.max_elapsed_hours ?? '?'}h</div>
        <div class="sub">Workers: ${data.safety?.max_parallel_workers ?? '?'} max</div>
      </div>
      <div class="detail-card">
        <h3>Links</h3>
        <div class="sub">${data.pr?.url ? linkIcon(data.pr.url, 'Pull Request #' + data.pr.number) : 'No PR'}</div>
        <div class="sub">${linkIcon(ghRepoUrl(repo), 'Repository')}</div>
        <div class="sub">${data.slack_channel ? linkIcon(slackChannelUrl(data.slack_channel), 'Slack Channel') : ''}</div>
      </div>
      <div class="detail-card">
        <h3>Timeline</h3>
        <div class="sub">Created: ${formatTime(data.created_at)}</div>
        <div class="sub">Updated: ${formatTime(data.updated_at)} (${relativeTime(data.updated_at)})</div>
        <div class="sub">Version: ${data.version ?? '?'}</div>
      </div>
    </div>`;

  // Objectives table
  if (data.work_items?.length) {
    html += `<h3 style="font-family:var(--font-display);font-size:12px;color:var(--command-gold);letter-spacing:0.1em;text-transform:uppercase;margin:16px 0 8px">Objectives</h3>`;
    html += `<table class="data-table"><thead><tr>
      <th>ID</th><th>Title</th><th>Agent</th><th>Status</th><th>Risk Flags</th><th>Evidence</th>
    </tr></thead><tbody>`;
    for (const w of data.work_items) {
      const riskHtml = (w.risk_flags || []).map(f => `<span class="risk-flag">${escapeHtml(f)}</span>`).join('');
      const evSummary = w.evidence ? `${w.evidence.tests?.result || 'n/a'}` : '--';
      html += `<tr class="no-click">
        <td style="white-space:nowrap;font-size:12px;color:var(--text-dim)">${escapeHtml(w.id)}</td>
        <td>${escapeHtml(w.title || w.description || '')}</td>
        <td style="color:var(--gold-bright);font-weight:600">${escapeHtml(w.assigned_to || '--')}</td>
        <td>${badge(w.status)}</td>
        <td>${riskHtml || '--'}</td>
        <td style="font-size:12px">${evSummary}</td>
      </tr>`;
    }
    html += '</tbody></table>';
  }

  // Health alerts
  if (data.health_alerts?.length) {
    html += `<h3 style="font-family:var(--font-display);font-size:12px;color:var(--command-gold);letter-spacing:0.1em;text-transform:uppercase;margin:16px 0 8px">Health Alerts</h3>`;
    for (const a of data.health_alerts) {
      const cls = a.level === 'red' ? '' : ' warning';
      html += `<div class="alert-item${cls}">
        <strong>${escapeHtml(a.type)}</strong> [${escapeHtml(a.objective || '')}] — ${escapeHtml(a.message)}
        <span style="color:var(--text-dim);float:right">${formatTime(a.ts)}</span>
      </div>`;
    }
  }

  // Session log
  if (data.session_log?.length) {
    html += `<h3 style="font-family:var(--font-display);font-size:12px;color:var(--command-gold);letter-spacing:0.1em;text-transform:uppercase;margin:16px 0 8px">Session Log (${data.session_log.length})</h3>`;
    const recent = data.session_log.slice(-20).reverse();
    for (const s of recent) {
      const dur = s.started_at && s.ended_at
        ? Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 1000) + 's'
        : 'running';
      html += `<div class="session-entry">
        <span class="agent-name">${escapeHtml(s.agent || '?')}</span>
        ${escapeHtml(s.objective || '')}
        — exit: ${s.exit_code ?? '?'} — ${dur}
        <span style="float:right">${formatTime(s.started_at)}</span>
      </div>`;
    }
  }

  body.innerHTML = html;
}

// --- Navigation ---

function navigateTo(view, repo, missionId) {
  appState.currentView = view;
  appState.currentRepo = repo || null;
  appState.currentMission = missionId || null;

  document.getElementById('projects-section').style.display = view === 'projects' ? '' : 'none';
  document.getElementById('missions-section').style.display = view === 'missions' ? '' : 'none';
  document.getElementById('detail-section').style.display = view === 'detail' ? '' : 'none';

  const bc = document.getElementById('breadcrumb');
  bc.style.display = view === 'projects' ? 'none' : '';

  const bcProject = document.getElementById('bc-project');
  const bcMission = document.getElementById('bc-mission');

  if (view === 'missions' && repo) {
    bcProject.style.display = '';
    const link = document.getElementById('bc-project-link');
    link.textContent = repo;
    link.onclick = function () { navigateTo('missions', repo); return false; };
    bcMission.style.display = 'none';
    loadMissions(repo);
    history.pushState(null, '', `#/${repo}`);
  } else if (view === 'detail' && repo && missionId) {
    bcProject.style.display = '';
    const link = document.getElementById('bc-project-link');
    link.textContent = repo;
    link.onclick = function () { navigateTo('missions', repo); return false; };
    bcMission.style.display = '';
    document.getElementById('bc-mission-label').textContent = missionId;
    loadMissionDetail(repo, missionId);
    history.pushState(null, '', `#/${repo}/${missionId}`);
  } else {
    bcProject.style.display = 'none';
    bcMission.style.display = 'none';
    history.pushState(null, '', '#/');
  }
}

function togglePanel(id) {
  const el = document.getElementById(id);
  const toggle = document.getElementById(id + '-toggle');
  if (el.style.display === 'none') {
    el.style.display = '';
    if (toggle) toggle.innerHTML = '&#9660;';
  } else {
    el.style.display = 'none';
    if (toggle) toggle.innerHTML = '&#9654;';
  }
}

// --- Hash routing ---

function routeFromHash() {
  const hash = location.hash.replace('#/', '').replace('#', '');
  if (!hash) return navigateTo('projects');
  const parts = hash.split('/');
  if (parts.length === 2) return navigateTo('detail', parts[0], parts[1]);
  if (parts.length === 1 && parts[0]) return navigateTo('missions', parts[0]);
  navigateTo('projects');
}

// --- Refresh loop ---

async function refresh() {
  await Promise.all([loadOverview(), loadPending(), loadProjects()]);

  // Re-fetch current view data
  if (appState.currentView === 'missions' && appState.currentRepo) {
    loadMissions(appState.currentRepo);
  } else if (appState.currentView === 'detail' && appState.currentRepo && appState.currentMission) {
    loadMissionDetail(appState.currentRepo, appState.currentMission);
  }

  document.getElementById('last-refresh').textContent =
    new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// --- Init ---

window.addEventListener('popstate', routeFromHash);
window.addEventListener('hashchange', routeFromHash);

refresh().then(() => routeFromHash());
setInterval(refresh, 15000);
