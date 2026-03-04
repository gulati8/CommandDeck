'use strict';

const appState = {
  overview: null,
  projects: [],
  missions: [],
  recentEvents: [],
  currentView: 'feed',
  currentRepo: null,
  currentMission: null,
  currentMissionData: null,
  githubOrg: '',
  slidePanelOpen: false
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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function badge(status) {
  return `<span class="badge badge-${status}">${status.replace(/_/g, ' ')}</span>`;
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
}

async function loadAllMissions() {
  const projects = await fetchJSON('/api/projects');
  if (!projects) return;
  appState.projects = projects;

  const missionPromises = projects
    .filter(p => p.mission_count > 0)
    .map(async (p) => {
      const missions = await fetchJSON(`/api/projects/${encodeURIComponent(p.repo)}/missions`);
      return missions || [];
    });

  const allMissionArrays = await Promise.all(missionPromises);
  appState.missions = allMissionArrays.flat();
}

async function loadRecentEvents() {
  const data = await fetchJSON('/api/events/recent');
  appState.recentEvents = data || [];
}

// --- Classify missions ---

function classifyMissions(missions) {
  const actionNeeded = [];
  const running = [];
  const waiting = [];
  const completed = [];
  const terminalStatuses = ['done', 'completed', 'merged', 'failed', 'aborted'];

  for (const m of missions) {
    if (terminalStatuses.includes(m.status)) {
      completed.push(m);
      continue;
    }
    if (m.status === 'pending_approval') {
      actionNeeded.push({ type: 'approve', mission: m });
      continue;
    }
    if (m.status === 'review' && m.pr?.number) {
      actionNeeded.push({ type: 'merge', mission: m });
      continue;
    }
    if (m.status === 'in_progress') {
      const lastActivity = m.updated_at || m.created_at;
      const mins = (Date.now() - new Date(lastActivity).getTime()) / 60000;
      if (mins > 30) {
        actionNeeded.push({ type: 'stalled', mission: m });
        continue;
      }
      running.push(m);
      continue;
    }
    waiting.push(m);
  }

  const typePriority = { approve: 0, merge: 1, stalled: 2 };
  actionNeeded.sort((a, b) => typePriority[a.type] - typePriority[b.type]);
  running.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  completed.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

  return { actionNeeded, running, waiting, completed };
}

// --- Update topbar status ---

function updateTopbar() {
  const el = document.getElementById('topbar-status');
  if (!appState.overview) {
    el.innerHTML = '';
    return;
  }
  const o = appState.overview;
  const parts = [];
  parts.push(`<span><span class="status-dot-inline dot-green"></span>Online</span>`);
  if (o.active_missions > 0) {
    parts.push(`<span><span class="status-dot-inline dot-blue"></span>${o.active_missions} running</span>`);
  }
  parts.push(`<span>${o.total_missions} missions</span>`);
  parts.push(`<span>${o.projects} projects</span>`);
  el.innerHTML = parts.join('');
}

// --- Update document title with badge ---

function updateTitleBadge(actionCount) {
  if (actionCount > 0) {
    document.title = `(${actionCount}) CommandDeck`;
  } else {
    document.title = 'CommandDeck';
  }
}

// --- Render: Feed (home) ---

function renderFeed() {
  const container = document.getElementById('feed-content');
  const missions = appState.missions;

  if (!missions.length) {
    container.innerHTML = '<div class="empty-state">No missions yet. Start one with the button above.</div>';
    updateTitleBadge(0);
    return;
  }

  const { actionNeeded, running, waiting, completed } = classifyMissions(missions);
  updateTitleBadge(actionNeeded.length);

  let html = '';

  // === Action needed (pinned) ===
  if (actionNeeded.length) {
    html += `<div class="feed-section">
      <div class="feed-label alert">
        <span class="feed-label-icon"></span>
        Action needed
        <span class="feed-count">${actionNeeded.length}</span>
      </div>`;
    for (const item of actionNeeded) {
      html += renderActionCard(item);
    }
    html += '</div>';
  }

  // === All clear ===
  if (!actionNeeded.length) {
    const runText = running.length
      ? `${running.length} mission${running.length !== 1 ? 's' : ''} progressing.`
      : '';
    html += `<div class="all-clear">
      <div class="all-clear-text">All systems nominal.${runText ? ' ' + runText : ''}</div>
      ${!runText ? '<div class="all-clear-sub">No active missions running.</div>' : ''}
    </div>`;
  }

  // === Running now ===
  if (running.length) {
    html += `<div class="feed-section">
      <div class="feed-label">Running now</div>`;
    for (const m of running) {
      html += renderRunningCard(m);
    }
    html += '</div>';
  }

  // === Waiting (planning, etc.) ===
  if (waiting.length) {
    html += `<div class="feed-section">
      <div class="feed-label">In progress</div>`;
    for (const m of waiting) {
      html += renderRunningCard(m, true);
    }
    html += '</div>';
  }

  // === Recent activity ===
  if (appState.recentEvents.length) {
    html += `<div class="feed-section">
      <div class="feed-label">Recent activity</div>
      <div class="activity-list">`;
    // Show up to 15 recent events
    const events = appState.recentEvents.slice(0, 15);
    for (const ev of events) {
      html += renderActivityItem(ev);
    }
    html += '</div></div>';
  }

  // === Completed this week ===
  if (completed.length) {
    const recent = completed.slice(0, 10);
    html += `<div class="feed-section">
      <div class="feed-label">Completed (${completed.length})</div>
      <div class="completed-chips">`;
    for (const m of recent) {
      const isFailed = m.status === 'failed' || m.status === 'aborted';
      const dotClass = isFailed ? 'failed' : 'success';
      const shortDesc = m.description.length > 40
        ? m.description.substring(0, 40) + '...'
        : m.description;
      html += `<span class="completed-chip" onclick="openSlidePanel('${escapeHtml(m.repo)}', '${escapeHtml(m.mission_id)}')">
        <span class="chip-dot ${dotClass}"></span>${escapeHtml(shortDesc)}
      </span>`;
    }
    html += '</div></div>';
  }

  container.innerHTML = html;
}

// --- Action card ---

function renderActionCard(item) {
  const m = item.mission;
  const progress = m.progress || { done: 0, total: 0, percent: 0 };

  let typeLabel, typeClass, contextText, buttons;

  switch (item.type) {
    case 'approve': {
      typeLabel = 'Approve Plan';
      typeClass = 'approve';
      // Show objective titles if available
      const objTitles = (m.work_items || []).slice(0, 3).map(w => w.title || w.description).filter(Boolean);
      if (objTitles.length) {
        contextText = `${progress.total} objectives: ${objTitles.join(', ')}${m.work_items.length > 3 ? '...' : ''}`;
      } else {
        contextText = progress.total
          ? `${progress.total} objective${progress.total !== 1 ? 's' : ''} planned`
          : 'Plan ready for review';
      }
      buttons = `
        <button class="btn btn-ghost" onclick="event.stopPropagation(); openSlidePanel('${escapeHtml(m.repo)}', '${escapeHtml(m.mission_id)}')">View Plan</button>
        <button class="btn btn-danger" onclick="event.stopPropagation(); actionReject('${escapeHtml(m.repo)}', '${escapeHtml(m.mission_id)}')">Reject</button>
        <button class="btn btn-approve" onclick="event.stopPropagation(); actionApprove('${escapeHtml(m.repo)}', '${escapeHtml(m.mission_id)}')">Approve</button>
      `;
      break;
    }
    case 'merge': {
      typeLabel = 'Merge PR';
      typeClass = 'merge';
      const parts = [];
      parts.push(`PR #${m.pr.number}`);
      if (progress.total) parts.push(`${progress.done}/${progress.total} done`);
      contextText = parts.join(' \u2014 ');
      buttons = `
        <button class="btn btn-ghost" onclick="event.stopPropagation(); window.open('${escapeHtml(m.pr.url)}', '_blank')">View PR</button>
        <button class="btn btn-danger" onclick="event.stopPropagation(); actionPRClose('${escapeHtml(m.repo)}', '${escapeHtml(m.mission_id)}')">Close</button>
        <button class="btn btn-merge" onclick="event.stopPropagation(); actionPRMerge('${escapeHtml(m.repo)}', '${escapeHtml(m.mission_id)}')">Merge</button>
      `;
      break;
    }
    case 'stalled': {
      typeLabel = 'Stalled';
      typeClass = 'stalled';
      contextText = `No activity for ${relativeTime(m.updated_at || m.created_at).replace(' ago', '')}`;
      buttons = '';
      if (!m.slack_thread_ts) {
        buttons += `<button class="btn btn-ghost" onclick="event.stopPropagation(); openReconnect('${escapeHtml(m.repo)}', '${escapeHtml(m.mission_id)}', '${escapeHtml(m.status)}', ${m.pr?.number || 'null'})">Reconnect</button>`;
      }
      break;
    }
  }

  return `<div class="action-card type-${typeClass}" onclick="openSlidePanel('${escapeHtml(m.repo)}', '${escapeHtml(m.mission_id)}')">
    <div class="action-card-top">
      <span class="action-type ${typeClass}">${typeLabel}</span>
      <span class="action-project">${escapeHtml(m.repo)}</span>
    </div>
    <div class="action-title">${escapeHtml(m.description)}</div>
    <div class="action-context">${escapeHtml(contextText)}</div>
    <div class="action-footer">
      <div class="action-meta">
        <span>${escapeHtml(m.mission_id)}</span>
        <span>${relativeTime(m.created_at)}</span>
      </div>
      <div class="action-buttons">${buttons}</div>
    </div>
  </div>`;
}

// --- Running card ---

function renderRunningCard(m, isWaiting) {
  const progress = m.progress || { done: 0, total: 0, percent: 0 };
  const lastActivity = m.updated_at || m.created_at;

  // Find current in-progress objective
  let currentWork = '';
  if (m.work_items) {
    const active = m.work_items.find(w => w.status === 'in_progress');
    if (active) {
      currentWork = active.title || active.description || '';
    }
  }

  const dotClass = isWaiting ? '' : 'running-pulse';
  const dotStyle = isWaiting ? 'width:8px;height:8px;border-radius:50%;background:var(--text-dim);flex-shrink:0;' : '';

  let progressHtml = '';
  if (progress.total) {
    const cls = progress.done === progress.total ? 'done' : '';
    progressHtml = `<div class="running-progress-area">
      <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${progress.percent}%"></div></div>
      <span class="progress-text">${progress.done}/${progress.total}</span>
    </div>`;
  }

  return `<div class="running-card" onclick="openSlidePanel('${escapeHtml(m.repo)}', '${escapeHtml(m.mission_id)}')">
    <span class="${dotClass}" ${dotStyle ? `style="${dotStyle}"` : ''}></span>
    <div class="running-info">
      <div class="running-title">${escapeHtml(m.description)}</div>
      <div class="running-sub">
        <span>${escapeHtml(m.repo)}</span>
        ${currentWork ? `<span class="current-work">Working on: ${escapeHtml(currentWork)}</span>` : ''}
        ${isWaiting ? `<span>${m.status.replace(/_/g, ' ')}</span>` : ''}
      </div>
    </div>
    ${progressHtml}
  </div>`;
}

// --- Activity feed item ---

function renderActivityItem(ev) {
  const eventName = ev.event || '';
  let icon = 'ev-default';
  let iconChar = '\u25C6';
  let text = '';

  // Determine icon and text from event type
  if (eventName.includes('created') || eventName.includes('started')) {
    icon = 'ev-started';
    iconChar = '\u25C6';
  }
  if (eventName.includes('completed') || eventName.includes('done')) {
    icon = 'ev-completed';
    iconChar = '\u2713';
  }
  if (eventName.includes('merged') || eventName.includes('merge')) {
    icon = 'ev-merged';
    iconChar = '\u2197';
  }
  if (eventName.includes('pr.') || eventName.includes('pr_')) {
    icon = 'ev-pr';
    iconChar = 'PR';
  }
  if (eventName.includes('failed') || eventName.includes('error')) {
    icon = 'ev-failed';
    iconChar = '\u2717';
  }
  if (eventName.includes('approved') || eventName.includes('approve')) {
    icon = 'ev-approved';
    iconChar = '\u2713';
  }

  // Build readable text
  const payload = ev.payload || {};
  const desc = payload.description || payload.title || payload.objective || '';
  const repoTag = ev.repo ? `<span class="project-tag">${escapeHtml(ev.repo)}</span>` : '';

  text = `<strong>${escapeHtml(eventName.replace(/\./g, ' '))}</strong>`;
  if (desc) text += ` \u2014 ${escapeHtml(desc)}`;
  if (repoTag) text += ` ${repoTag}`;

  return `<div class="activity-item">
    <span class="activity-time">${formatTimeShort(ev.ts)}</span>
    <span class="activity-icon ${icon}">${iconChar}</span>
    <div class="activity-text">${text}</div>
  </div>`;
}

// --- Slide-out panel ---

function openSlidePanel(repo, missionId) {
  appState.slidePanelOpen = true;
  appState.currentRepo = repo;
  appState.currentMission = missionId;

  document.getElementById('slide-panel').classList.add('open');
  document.getElementById('slide-overlay').classList.add('open');
  document.getElementById('slide-body').innerHTML = '<div class="empty-state">Loading...</div>';

  loadSlidePanel(repo, missionId);
}

function closeSlidePanel() {
  appState.slidePanelOpen = false;
  appState.currentRepo = null;
  appState.currentMission = null;
  document.getElementById('slide-panel').classList.remove('open');
  document.getElementById('slide-overlay').classList.remove('open');
}

async function loadSlidePanel(repo, missionId) {
  const data = await fetchJSON(`/api/missions/${encodeURIComponent(repo)}/${encodeURIComponent(missionId)}`);
  if (!data) {
    document.getElementById('slide-body').innerHTML = '<div class="empty-state">Mission not found</div>';
    return;
  }

  appState.currentMissionData = data;
  const progress = data.progress || { done: 0, total: 0, percent: 0 };
  const lastActivity = data.updated_at || data.created_at;

  let html = '';

  // Action banner (if applicable)
  if (data.status === 'pending_approval') {
    html += `<div class="slide-action-banner approve">
      <span class="slide-action-text">Plan ready for approval</span>
      <div class="slide-action-buttons">
        <button class="btn btn-danger" onclick="actionReject('${escapeHtml(repo)}', '${escapeHtml(missionId)}')">Reject</button>
        <button class="btn btn-approve" onclick="actionApprove('${escapeHtml(repo)}', '${escapeHtml(missionId)}')">Approve</button>
      </div>
    </div>`;
  } else if (data.status === 'review' && data.pr?.number) {
    html += `<div class="slide-action-banner merge">
      <span class="slide-action-text">PR #${data.pr.number} ready</span>
      <div class="slide-action-buttons">
        <button class="btn btn-danger" onclick="actionPRClose('${escapeHtml(repo)}', '${escapeHtml(missionId)}')">Close</button>
        <button class="btn btn-merge" onclick="actionPRMerge('${escapeHtml(repo)}', '${escapeHtml(missionId)}')">Merge</button>
      </div>
    </div>`;
  }

  // Project + Title
  html += `<div class="slide-project">${escapeHtml(repo)}</div>`;
  html += `<div class="slide-title">${escapeHtml(data.description)}</div>`;

  // Meta grid
  html += '<div class="slide-meta">';
  html += `<div class="slide-meta-cell">
    <div class="slide-meta-label">Status</div>
    <div class="slide-meta-value">${badge(data.status)}</div>
  </div>`;
  if (progress.total) {
    html += `<div class="slide-meta-cell">
      <div class="slide-meta-label">Progress</div>
      <div class="slide-meta-value">${progress.done} / ${progress.total}</div>
    </div>`;
  }
  html += `<div class="slide-meta-cell">
    <div class="slide-meta-label">Last Activity</div>
    <div class="slide-meta-value">${relativeTime(lastActivity)}</div>
  </div>`;
  html += `<div class="slide-meta-cell">
    <div class="slide-meta-label">Created</div>
    <div class="slide-meta-value">${formatTime(data.created_at)}</div>
  </div>`;
  html += '</div>';

  // Objectives
  if (data.work_items?.length) {
    html += `<div class="slide-section-title">Objectives</div>`;
    for (const w of data.work_items) {
      const riskHtml = (w.risk_flags || []).map(f => `<span class="slide-obj-risk">${escapeHtml(f)}</span>`).join(' ');
      html += `<div class="slide-obj">
        <span class="slide-obj-dot ${w.status}"></span>
        <span class="slide-obj-name">${escapeHtml(w.title || w.description || w.id)}</span>
        ${riskHtml}
        <span class="slide-obj-agent">${escapeHtml(w.assigned_to || '')}</span>
      </div>`;
    }
  }

  // Health alerts
  if (data.health_alerts?.length) {
    html += `<div class="slide-section-title">Health Alerts</div>`;
    for (const a of data.health_alerts) {
      html += `<div style="font-size:11px;color:var(--red);padding:4px 0;border-bottom:1px solid var(--border)">
        <strong>${escapeHtml(a.type)}</strong> ${escapeHtml(a.message)}
      </div>`;
    }
  }

  // Timeline
  if (data.timeline?.length) {
    html += `<div class="slide-section-title">Timeline</div>`;
    const recent = data.timeline.slice(0, 20);
    for (const e of recent) {
      const payloadStr = Object.entries(e.payload || {})
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(', ');

      html += `<div class="slide-timeline-item">
        <span class="slide-tl-time">${formatTimeShort(e.ts)}</span>
        <span class="slide-tl-event"><strong>${escapeHtml(e.event)}</strong>${payloadStr ? ' \u2014 ' + escapeHtml(payloadStr) : ''}</span>
        ${e.actor ? `<span class="slide-tl-actor">${escapeHtml(e.actor)}</span>` : ''}
      </div>`;
    }
  }

  // Links
  html += '<div class="slide-links">';
  if (data.pr?.url) html += linkIcon(data.pr.url, 'PR #' + data.pr.number);
  html += linkIcon(ghRepoUrl(repo), 'Repository');
  if (data.slack_channel) html += linkIcon(slackChannelUrl(data.slack_channel), 'Slack');
  if (!data.slack_thread_ts) {
    html += `<button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;" onclick="openReconnect('${escapeHtml(repo)}', '${escapeHtml(missionId)}', '${escapeHtml(data.status)}', ${data.pr?.number || 'null'})">Reconnect Thread</button>`;
  }
  html += '</div>';

  document.getElementById('slide-body').innerHTML = html;
}

// --- Render: Projects view ---

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
  document.getElementById('view-project-missions').classList.add('active');
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
    const cls = progress.done === progress.total && progress.total > 0 ? 'done' : '';
    html += `<tr onclick="openSlidePanel('${escapeHtml(repo)}', '${escapeHtml(m.mission_id)}')">
      <td style="white-space:nowrap;color:var(--text-dim);font-size:11px">${escapeHtml(m.mission_id)}</td>
      <td>${escapeHtml(m.description)}</td>
      <td>${badge(m.status)}</td>
      <td style="min-width:120px">
        ${progress.total ? `<div style="display:flex;align-items:center;gap:8px">
          <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${progress.percent}%"></div></div>
          <span style="font-size:11px;color:var(--blue);font-weight:700">${progress.done}/${progress.total}</span>
        </div>` : ''}
      </td>
      <td style="white-space:nowrap;color:var(--text-dim);font-size:11px">${relativeTime(m.updated_at || m.created_at)}</td>
      <td onclick="event.stopPropagation()">${m.pr?.url ? linkIcon(m.pr.url, 'PR #' + m.pr.number) : ''}</td>
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

// --- Render: System view ---

async function renderSystem() {
  const dot = document.getElementById('server-dot');
  const info = document.getElementById('server-info');
  const title = document.getElementById('containers-title');

  dot.className = 'status-dot online';
  const uptime = appState.overview?.uptime;
  info.innerHTML = uptime != null
    ? `Uptime: ${formatUptime(uptime)} &middot; ${appState.overview?.active_workers ?? 0} active workers &middot; ${appState.overview?.total_missions ?? 0} total missions`
    : 'Loading...';

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
    if (appState.slidePanelOpen) loadSlidePanel(repo, missionId);
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
    if (appState.slidePanelOpen) loadSlidePanel(repo, missionId);
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
    if (appState.slidePanelOpen) loadSlidePanel(repo, missionId);
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
    if (appState.slidePanelOpen) loadSlidePanel(repo, missionId);
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
    openSlidePanel(repo, result.data.mission_id);
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
    if (appState.slidePanelOpen) loadSlidePanel(repo, missionId);
  } else {
    alert('Failed: ' + (result.data?.error || 'unknown error'));
    submit.disabled = false;
    submit.textContent = 'Reconnect';
  }
}

// --- Navigation ---

function hideAllViews() {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
}

function showFeed() {
  appState.currentView = 'feed';
  hideAllViews();
  document.getElementById('view-feed').classList.add('active');
  history.pushState(null, '', '#/');
  renderFeed();
}

function showView(name) {
  appState.currentView = name;
  hideAllViews();

  const link = document.querySelector(`.nav-link[data-view="${name}"]`);
  if (link) link.classList.add('active');

  if (name === 'projects') {
    document.getElementById('view-projects').classList.add('active');
    history.pushState(null, '', '#/projects');
    renderProjects();
  } else if (name === 'system') {
    document.getElementById('view-system').classList.add('active');
    history.pushState(null, '', '#/system');
    renderSystem();
  }
}

// --- Hash routing ---

function routeFromHash() {
  const hash = location.hash.replace('#/', '').replace('#', '');
  if (!hash) return showFeed();

  const parts = hash.split('/');
  if (parts[0] === 'system') return showView('system');
  if (parts[0] === 'projects') {
    if (parts[1]) return showProjectMissions(parts[1]);
    return showView('projects');
  }
  // Direct mission link: #/repo/missionId
  if (parts.length === 2) {
    showFeed();
    openSlidePanel(parts[0], parts[1]);
    return;
  }
  showFeed();
}

// --- Refresh loop ---

async function refresh() {
  await Promise.all([loadOverview(), loadAllMissions(), loadRecentEvents()]);
  updateTopbar();

  if (appState.currentView === 'feed') {
    renderFeed();
  } else if (appState.currentView === 'projects') {
    renderProjects();
  } else if (appState.currentView === 'system') {
    renderSystem();
  }
}

// --- Keyboard: Escape closes slide panel ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && appState.slidePanelOpen) {
    closeSlidePanel();
  }
});

// --- Init ---

window.addEventListener('popstate', routeFromHash);
window.addEventListener('hashchange', routeFromHash);

refresh().then(() => routeFromHash());
setInterval(refresh, 15000);
