'use strict';

let appState = {
  overview: null,
  projects: [],
  pending: null,
  orphaned: [],
  currentView: 'projects', // projects | missions | detail
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

function badge(status) {
  return `<span class="badge badge-${status}">${status.replace(/_/g, ' ')}</span>`;
}

function progressBar(progress) {
  if (!progress || !progress.total) return '<span class="badge badge-planning">no items</span>';
  return `<div style="display:flex;align-items:center;gap:10px;">
    <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${progress.percent}%"></div></div>
    <span style="font-size:15px;color:var(--blue-bright);font-weight:700">${progress.done}/${progress.total}</span>
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
  document.getElementById('m-workers').textContent = data.active_workers ?? 0;
  document.getElementById('server-uptime').textContent = 'Uptime: ' + formatUptime(data.uptime);
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
      const domain = appState.overview?.config?.domain;
      const uatUrl = domain && pr.repo && pr.pr_number
        ? `https://${pr.repo}-pr-${pr.pr_number}.${domain}`
        : null;
      html += `<div class="pending-item">
        <span class="repo-tag">${escapeHtml(pr.repo)}</span>
        <span>PR #${pr.pr_number}</span>
        ${linkIcon(pr.pr_url, 'GitHub')}
        ${uatUrl ? linkIcon(uatUrl, 'UAT') : ''}
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

async function loadOrphaned() {
  const data = await fetchJSON('/api/orphaned');
  if (!data) return;
  appState.orphaned = data;

  const section = document.getElementById('orphaned-section');
  const body = document.getElementById('orphaned-body');
  const count = document.getElementById('orphaned-count');

  if (!data.length) {
    section.style.display = 'none';
    return;
  }
  // Only show orphaned section on homepage
  section.style.display = appState.currentView === 'projects' ? '' : 'none';
  count.textContent = data.length;

  body.innerHTML = data.map(m => `
    <div class="orphaned-item" onclick="navigateTo('detail', '${escapeHtml(m.repo)}', '${escapeHtml(m.mission_id)}')">
      <span class="repo-tag">${escapeHtml(m.repo)}</span>
      ${badge(m.status)}
      <span style="flex:1">${escapeHtml(m.description)}</span>
      ${m.pr?.number ? `<span>PR #${m.pr.number}</span>` : ''}
      <span style="color:var(--text-dim)">${escapeHtml(m.mission_id)}</span>
      <button class="btn btn-ghost" onclick="event.stopPropagation(); openReconnect('${escapeHtml(m.repo)}', '${escapeHtml(m.mission_id)}', '${escapeHtml(m.status)}', ${m.pr?.number || 'null'})">Reconnect Thread</button>
    </div>
  `).join('');
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
      <div class="card-meta" style="margin-top:6px">
        ${linkIcon(ghRepoUrl(p.repo), 'GitHub')}
        ${p.channel_id ? linkIcon(slackChannelUrl(p.channel_id), 'Slack') : ''}
      </div>
    </div>
  `).join('');
}

async function loadContainers() {
  const data = await fetchJSON('/api/containers');
  const grid = document.getElementById('containers-grid');
  if (!data || !data.length) {
    grid.innerHTML = '<div class="empty-state">No container data available</div>';
    return;
  }
  grid.innerHTML = data.map(c => {
    const healthBadge = c.health
      ? `<span class="c-health ${c.health}">${c.health}</span>`
      : '';
    return `<div class="container-card">
      <span class="status-dot ${c.state === 'running' ? 'online' : 'offline'}"></span>
      <span class="c-name">${escapeHtml(c.name)}</span>
      <span class="c-state ${c.state}">${c.state}</span>
      ${healthBadge}
    </div>`;
  }).join('');
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
      <td style="white-space:nowrap;color:var(--text-dim)">${escapeHtml(m.mission_id)}</td>
      <td>${escapeHtml(m.description)}</td>
      <td>${badge(m.status)}</td>
      <td style="min-width:140px">${progressBar(m.progress)}</td>
      <td style="white-space:nowrap;color:var(--text-dim)">${formatTime(m.created_at)}<br>${relativeTime(m.created_at)}</td>
      <td onclick="event.stopPropagation()">${m.pr?.url ? linkIcon(m.pr.url, 'PR #' + m.pr.number) : ''}</td>
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function loadMissionDetail(repo, missionId) {
  const data = await fetchJSON(`/api/missions/${encodeURIComponent(repo)}/${encodeURIComponent(missionId)}`);
  if (!data) return;

  appState.currentMissionData = data;

  document.getElementById('detail-title').textContent = missionId;
  const actionsDiv = document.getElementById('detail-actions');
  const body = document.getElementById('detail-body');

  // Action buttons based on mission status
  let actionsHtml = '<div class="action-bar">';

  if (data.status === 'pending_approval') {
    actionsHtml += `<button class="btn btn-success" onclick="actionApprove('${escapeHtml(repo)}', '${escapeHtml(missionId)}')">Approve Plan</button>`;
    actionsHtml += `<button class="btn btn-danger" onclick="actionReject('${escapeHtml(repo)}', '${escapeHtml(missionId)}')">Reject Plan</button>`;
  }

  if (data.pr?.number) {
    actionsHtml += `<button class="btn btn-success" onclick="actionPRMerge('${escapeHtml(repo)}', '${escapeHtml(missionId)}')">Merge PR #${data.pr.number}</button>`;
    actionsHtml += `<button class="btn btn-danger" onclick="actionPRClose('${escapeHtml(repo)}', '${escapeHtml(missionId)}')">Close PR</button>`;
  }

  if (!data.slack_thread_ts) {
    actionsHtml += `<button class="btn btn-ghost" onclick="openReconnect('${escapeHtml(repo)}', '${escapeHtml(missionId)}', '${escapeHtml(data.status)}', ${data.pr?.number || 'null'})">Reconnect Thread</button>`;
  }

  actionsHtml += '</div>';
  actionsDiv.innerHTML = actionsHtml;

  const elapsed = data.safety?.started_at
    ? ((Date.now() - new Date(data.safety.started_at).getTime()) / 3600000).toFixed(1)
    : '?';

  let html = `
    <p style="margin-bottom:16px;color:var(--text);font-size:18px">${escapeHtml(data.description)}</p>
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
        <div class="sub">${data.slack_channel ? linkIcon(slackChannelUrl(data.slack_channel), 'Slack Channel') : 'No Slack thread'}</div>
      </div>
      <div class="detail-card">
        <h3>Info</h3>
        <div class="sub">Created: ${formatTime(data.created_at)}</div>
        <div class="sub">Updated: ${formatTime(data.updated_at)} (${relativeTime(data.updated_at)})</div>
        ${data.is_follow_up ? '<div class="sub" style="color:var(--command-gold)">Follow-up mission</div>' : ''}
      </div>
    </div>`;

  // Objectives table
  if (data.work_items?.length) {
    html += sectionHeader('Objectives');
    html += `<table class="data-table"><thead><tr>
      <th>ID</th><th>Title</th><th>Agent</th><th>Status</th><th>Risk Flags</th><th>Evidence</th>
    </tr></thead><tbody>`;
    for (const w of data.work_items) {
      const riskHtml = (w.risk_flags || []).map(f => `<span class="risk-flag">${escapeHtml(f)}</span>`).join('');
      const evSummary = w.evidence ? `${w.evidence.tests?.result || 'n/a'}` : '--';
      html += `<tr class="no-click">
        <td style="white-space:nowrap;color:var(--text-dim)">${escapeHtml(w.id)}</td>
        <td>${escapeHtml(w.title || w.description || '')}</td>
        <td style="color:var(--gold-bright);font-weight:700">${escapeHtml(w.assigned_to || '--')}</td>
        <td>${badge(w.status)}</td>
        <td>${riskHtml || '--'}</td>
        <td>${evSummary}</td>
      </tr>`;
    }
    html += '</tbody></table>';
  }

  // Timeline
  if (data.timeline?.length) {
    html += sectionHeader(`Timeline (${data.timeline.length})`);
    html += '<div class="timeline">';
    for (const e of data.timeline) {
      const payloadStr = Object.entries(e.payload || {})
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(', ');
      html += `<div class="timeline-entry">
        <span class="timeline-ts">${formatTimeShort(e.ts)}</span>
        <span class="timeline-event">${escapeHtml(e.event)}</span>
        <span class="timeline-detail">${payloadStr ? escapeHtml(payloadStr) : ''}</span>
        ${e.actor ? `<span class="timeline-actor">${escapeHtml(e.actor)}</span>` : ''}
      </div>`;
    }
    html += '</div>';
  }

  // Health alerts
  if (data.health_alerts?.length) {
    html += sectionHeader('Health Alerts');
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
    html += sectionHeader(`Session Log (${data.session_log.length})`);
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

function sectionHeader(title) {
  return `<h3 style="font-family:var(--font-display);font-size:14px;color:var(--command-gold);letter-spacing:0.1em;text-transform:uppercase;margin:20px 0 10px">${title}</h3>`;
}

// --- Actions ---

async function actionApprove(repo, missionId) {
  if (!confirm('Approve this plan and start execution?')) return;
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Approving...';
  const result = await postJSON(`/api/missions/${encodeURIComponent(repo)}/${encodeURIComponent(missionId)}/approve`, {});
  if (result.ok) {
    await loadMissionDetail(repo, missionId);
  } else {
    alert('Failed to approve: ' + (result.data?.error || 'unknown error'));
    btn.disabled = false;
    btn.textContent = 'Approve Plan';
  }
}

async function actionReject(repo, missionId) {
  if (!confirm('Reject this plan and abort the mission?')) return;
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Rejecting...';
  const result = await postJSON(`/api/missions/${encodeURIComponent(repo)}/${encodeURIComponent(missionId)}/reject`, {});
  if (result.ok) {
    await loadMissionDetail(repo, missionId);
  } else {
    alert('Failed to reject: ' + (result.data?.error || 'unknown error'));
    btn.disabled = false;
    btn.textContent = 'Reject Plan';
  }
}

async function actionPRMerge(repo, missionId) {
  if (!confirm('Merge this PR? This will deploy to production.')) return;
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Merging...';
  const result = await postJSON(`/api/missions/${encodeURIComponent(repo)}/${encodeURIComponent(missionId)}/pr/merge`, {});
  if (result.ok) {
    await loadMissionDetail(repo, missionId);
  } else {
    alert('Failed to merge: ' + (result.data?.error || 'unknown error'));
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
    await loadMissionDetail(repo, missionId);
  } else {
    alert('Failed to close PR: ' + (result.data?.error || 'unknown error'));
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

  // Populate project dropdown
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

  if (!prompt) {
    alert('Please describe the task.');
    return;
  }

  submit.disabled = true;
  submit.textContent = 'Starting...';

  const result = await postJSON('/api/missions', { repo, prompt, slack_thread: slackThread });
  if (result.ok && result.data?.mission_id) {
    closeModal('modal-start-mission');
    navigateTo('detail', repo, result.data.mission_id);
    await refresh();
  } else {
    alert('Failed to start mission: ' + (result.data?.error || 'unknown error'));
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

  // Store context for submit
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

  if (!url) {
    alert('Please paste a Slack thread URL.');
    return;
  }

  submit.disabled = true;
  submit.textContent = 'Reconnecting...';

  const result = await postJSON(
    `/api/missions/${encodeURIComponent(repo)}/${encodeURIComponent(missionId)}/reconnect`,
    { slack_thread_url: url }
  );

  if (result.ok) {
    closeModal('modal-reconnect');
    await refresh();
    if (appState.currentView === 'detail') {
      await loadMissionDetail(repo, missionId);
    }
  } else {
    alert('Failed to reconnect: ' + (result.data?.error || 'unknown error'));
    submit.disabled = false;
    submit.textContent = 'Reconnect';
  }
}

// --- Navigation ---

function navigateTo(view, repo, missionId) {
  appState.currentView = view;
  appState.currentRepo = repo || null;
  appState.currentMission = missionId || null;
  appState.currentMissionData = null;

  document.getElementById('projects-section').style.display = view === 'projects' ? '' : 'none';
  document.getElementById('missions-section').style.display = view === 'missions' ? '' : 'none';
  document.getElementById('detail-section').style.display = view === 'detail' ? '' : 'none';

  // System status + orphaned only on homepage
  document.getElementById('system-section').style.display = view === 'projects' ? '' : 'none';
  document.getElementById('orphaned-section').style.display = (view === 'projects' && appState.orphaned?.length) ? '' : 'none';

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
  await loadOverview();
  const tasks = [loadPending(), loadProjects(), loadOrphaned()];
  // Only load system status when on homepage
  if (appState.currentView === 'projects') {
    tasks.push(loadContainers());
  }
  await Promise.all(tasks);

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
