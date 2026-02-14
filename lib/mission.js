'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const state = require('./state');
const worktreeLib = require('./worktree');
const worker = require('./worker');
const pr = require('./pr');
const risk = require('./risk');
const { readEvidence } = require('./evidence');
const { logEvent } = require('./observability');

function runGit(cwd, args) {
  return execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf-8' });
}

class Mission {
  constructor(repo, prompt, context = {}) {
    this.repo = repo;
    this.prompt = prompt;
    this.channel = context.channel || null;
    this.threadTs = context.threadTs || null;
    this.reporter = context.reporter || noopReporter;
    this.missionId = null;
    this.state = null;
  }

  // Main entry point — runs the full mission lifecycle
  async start() {
    // 1. Create mission state (status: 'planning')
    this.state = await state.createMission(this.repo, {
      description: this.prompt,
      slackChannel: this.channel,
      slackThreadTs: this.threadTs
    });
    this.missionId = this.state.mission_id;

    logEvent('mission.created', {
      mission_id: this.missionId,
      repo: this.repo,
      status: 'planning'
    });

    await this.reporter.post(
      `🖖 Mission acknowledged: "${this.prompt}"\n` +
      `  Project: ${this.repo}\n` +
      `  Mission ID: ${this.missionId}\n` +
      `  Captain Picard is planning the mission...`
    );

    // 2. Picard decomposes the mission
    await this.decompose();

    // Reload state after Picard writes mission.json
    this.state = await state.readMission(this.repo, this.missionId);

    if (!this.state.work_items?.length) {
      await this.reporter.post('⚠️ Picard produced no objectives. Mission aborted.');
      await this.setStatus('failed');
      return this.state;
    }

    // Report the plan
    await this.reportPlan();

    // 3. Transition to in_progress and create integration branch
    await this.setStatus('in_progress');
    this.ensureIntegrationBranch();

    // 4. Execute the work loop
    const loopResult = await this.workLoop();

    // 5. Handle post-loop state
    if (loopResult === 'checkpoint_paused') {
      // Mission is paused at a checkpoint — don't create PR yet
      await this.reporter.post('⏸️ Mission paused at checkpoint. Waiting for approval to continue.');
      return this.state;
    }

    if (shouldOpenPR(this.state)) {
      // All objectives done — open PR
      try {
        const prResult = await pr.create(this.state, { reporter: this.reporter });
        this.state.pr = { number: prResult.number, url: prResult.url, status: 'open' };
        await this.setStatus('review');
      } catch (err) {
        await this.reporter.post(`⚠️ Failed to create PR: ${err.message}`);
        await this.setStatus('failed');
      }
    }

    return this.state;
  }

  // Resume a paused mission (after checkpoint approval)
  async resume() {
    this.state = await state.readMission(this.repo, this.missionId);
    if (!this.state) throw new Error(`Mission ${this.missionId} not found`);

    if (this.state.status !== 'checkpoint_paused') {
      throw new Error(`Mission is ${this.state.status}, not checkpoint_paused`);
    }

    // Find the checkpoint item and mark it done
    const checkpointItem = this.state.work_items.find(
      w => w.status === 'checkpoint_paused'
    );
    if (checkpointItem) {
      await state.updateItemStatus(
        this.repo,
        this.missionId,
        checkpointItem.id,
        'done',
        { completed_at: new Date().toISOString() }
      );
    }

    this.state = await state.readMission(this.repo, this.missionId);
    await this.setStatus('in_progress');

    await this.reporter.post('▶️ Mission resumed from checkpoint.');

    // Continue the work loop
    const loopResult = await this.workLoop();

    if (loopResult === 'checkpoint_paused') {
      await this.reporter.post('⏸️ Mission paused at another checkpoint. Waiting for approval.');
      return this.state;
    }

    if (shouldOpenPR(this.state)) {
      try {
        const prResult = await pr.create(this.state, { reporter: this.reporter });
        this.state.pr = { number: prResult.number, url: prResult.url, status: 'open' };
        await this.setStatus('review');
      } catch (err) {
        await this.reporter.post(`⚠️ Failed to create PR: ${err.message}`);
        await this.setStatus('failed');
      }
    }

    return this.state;
  }

  // Set mission status atomically
  async setStatus(newStatus) {
    await state.withMissionLock(this.repo, this.missionId, (s) => {
      s.status = newStatus;
      return s;
    });
    this.state.status = newStatus;

    logEvent('mission.status', {
      mission_id: this.missionId,
      repo: this.repo,
      status: newStatus
    });
  }

  // Invoke Picard to decompose the mission into objectives
  async decompose() {
    const stateDir = state.missionDir(this.repo, this.missionId);
    const projectDir = worktreeLib.projectPath(this.repo);
    const config = state.loadProjectConfig(this.repo);

    const prompt = [
      `You are Captain Picard. Decompose this mission into phased objectives.`,
      ``,
      `Mission: "${this.prompt}"`,
      `Repo: ${this.repo}`,
      `Mission ID: ${this.missionId}`,
      `State directory: ${stateDir}`,
      ``,
      `Read the project's CLAUDE.md, docs/adr/, and any existing code to understand context.`,
      `Check ~/.commanddeck/playbooks/ for relevant templates.`,
      ``,
      `Write your decomposition to ${stateDir}/mission.json — update the work_items array.`,
      `Write a Captain's Log entry to ${stateDir}/captains-log.md.`,
      ``,
      `Each objective needs: id, title, description, status ("ready" or "blocked"),`,
      `phase, parallel_group, depends_on, assigned_to, checkpoint, risk_flags, context_sources.`,
      ``,
      `Set risk_flags based on file patterns: auth, security, migration, ci-workflow, infra, dependency.`,
      `Assign specialists: borg for implementation, scotty for architecture, worf for security,`,
      `spock for testing, geordi for infra, mr-data for data modeling.`,
    ].join('\n');

    const model = config.model_overrides?.['captain-picard'] || 'claude-opus-4-6';
    const result = await worker.executeSpecialist(
      projectDir, 'captain-picard', prompt, this.state,
      { model }
    );

    await state.addSessionLog(this.repo, this.missionId, {
      session_id: `sess-${Date.now()}`,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      agent: 'captain-picard',
      objective: 'mission-planning',
      exit_code: result.code
    });

    return result;
  }

  // Report the mission plan to the user
  async reportPlan() {
    const items = this.state.work_items;
    const phases = [...new Set(items.map(w => w.phase))].sort();

    let report = `📋 Mission briefing — ${items.length} objectives:\n`;
    for (const item of items) {
      const flags = item.risk_flags?.length ? ` ⚠️ ${item.risk_flags.join(', ')}` : '';
      const checkpoint = item.checkpoint ? ' 🔒 checkpoint' : '';
      report += `  ${item.id}. ${item.title} (Phase ${item.phase}, ${item.assigned_to})${flags}${checkpoint}\n`;
    }
    report += `\nDeploying workers to Phase ${phases[0]}...`;

    await this.reporter.post(report);
  }

  // The main work loop — returns 'done', 'failed', or 'checkpoint_paused'
  async workLoop() {
    const config = state.loadProjectConfig(this.repo);
    const maxWorkers = this.state.safety?.max_parallel_workers || config.max_workers || 3;

    while (true) {
      this.state = await state.readMission(this.repo, this.missionId);

      // Check safety limits
      const safetyCheck = checkSafetyLimits(this.state);
      if (safetyCheck.blocked) {
        await this.reporter.post(`🛑 Safety limit reached: ${safetyCheck.reason}. Mission paused.`);
        await this.setStatus('paused');
        return 'paused';
      }

      // Find ready objectives
      const ready = state.getReadyItems(this.state);
      const inProgress = state.getItemsByStatus(this.state, 'in_progress');

      // All done?
      if (ready.length === 0 && inProgress.length === 0) {
        const failed = state.getItemsByStatus(this.state, 'failed');
        if (failed.length > 0) {
          await this.setStatus('failed');
          await this.reporter.post(
            `🔴 Mission incomplete. ${failed.length} objective(s) failed:\n` +
            failed.map(f => `  - ${f.id}: ${f.title}`).join('\n')
          );
          return 'failed';
        } else {
          await this.setStatus('merging');
          await this.reporter.post('✅ All objectives complete. Preparing PR...');
          return 'done';
        }
      }

      // Nothing ready but some still in progress — wait (shouldn't happen in batch model)
      if (ready.length === 0) {
        return 'done';
      }

      // Check for checkpoint objectives — pause the mission
      const checkpoint = ready.find(r => r.checkpoint);
      if (checkpoint) {
        await this.reporter.post(
          `🔒 Checkpoint: ${checkpoint.checkpoint_message || checkpoint.title}\n` +
          `Reply to continue or cancel.`
        );
        // Mark the checkpoint item as paused
        checkpoint.status = 'checkpoint_paused';
        await state.writeMission(this.repo, this.missionId, this.state);
        await this.setStatus('checkpoint_paused');
        return 'checkpoint_paused';
      }

      // Apply risk detection to ready items
      for (const item of ready) {
        if (!item.risk_flags?.length) {
          const flags = risk.detectRiskFlagsForObjective(item, this.repo);
          if (flags.length > 0) {
            item.risk_flags = flags;
          }
        }
      }

      // Batch: take up to maxWorkers from ready
      const batch = ready.slice(0, maxWorkers);

      // Launch batch in parallel
      await this.executeBatch(batch);

      // Merge completed branches into integration
      await this.mergeCompleted();

      // Run mandatory reviews for risk-flagged objectives
      await this.runMandatoryReviews();
    }
  }

  // Execute a batch of objectives in parallel worktrees
  async executeBatch(batch) {
    const projectDir = worktreeLib.projectPath(this.repo);
    const config = state.loadProjectConfig(this.repo);

    // Mark all as in_progress and create worktrees
    const workers = [];
    for (let i = 0; i < batch.length; i++) {
      const obj = batch[i];
      const branch = `commanddeck/${this.missionId}/${obj.id}`;

      // Update status atomically
      await state.updateItemStatus(this.repo, this.missionId, obj.id, 'in_progress', {
        git_branch: branch,
        worker_index: i,
        started_at: new Date().toISOString()
      });
      obj.status = 'in_progress';
      obj.git_branch = branch;

      // Create worktree
      const wtPath = worktreeLib.create(this.repo, i, branch);

      await this.reporter.post(
        `⚡ ${obj.assigned_to}${batch.length > 1 ? `-${i}` : ''} → ${obj.title}`
      );

      // Increment session count
      await state.incrementSessionCount(this.repo, this.missionId);

      // Determine model from config
      const model = config.model_overrides?.[obj.assigned_to] || undefined;

      workers.push(
        worker.execute(wtPath, obj, this.state, { model })
          .then(result => ({ ...result, objective: obj }))
          .catch(err => ({
            success: false,
            objective: obj,
            error: err.message
          }))
      );
    }

    // Wait for all workers to complete
    const results = await Promise.all(workers);

    // Process results atomically
    for (const result of results) {
      const obj = result.objective;

      if (result.success) {
        await state.updateItemStatus(this.repo, this.missionId, obj.id, 'done', {
          completed_at: new Date().toISOString(),
          evidence_path: `artifacts/evidence-${obj.id}.json`
        });
        obj.status = 'done';
        await this.reporter.post(`✅ ${obj.id} complete: ${obj.title}`);
      } else {
        const error = result.error || `Worker exited with code ${result.code}`;
        await state.updateItemStatus(this.repo, this.missionId, obj.id, 'failed', {
          error
        });
        obj.status = 'failed';
        await this.reporter.post(`🔴 ${obj.id} failed: ${obj.title} — ${error}`);
      }
    }

    // Clean up worktrees
    for (let i = 0; i < batch.length; i++) {
      worktreeLib.remove(this.repo, i);
    }
  }

  // Merge completed objective branches into the integration branch
  async mergeCompleted() {
    const projectDir = worktreeLib.projectPath(this.repo);
    const integrationBranch = this.state.integration_branch;

    const completedItems = this.state.work_items.filter(
      w => w.status === 'done' && w.git_branch && !w.merged
    );

    if (completedItems.length === 0) return;

    // Checkout integration branch
    runGit(projectDir, ['checkout', integrationBranch]);

    for (const obj of completedItems) {
      try {
        runGit(projectDir, ['merge', obj.git_branch, '--no-edit']);
        obj.merged = true;
        await this.reporter.post(`🔀 Merged ${obj.id} to integration branch — clean merge.`);
      } catch {
        // Merge conflict — invoke O'Brien
        await this.reporter.post(`🔀 Merge conflict on ${obj.id} — O'Brien resolving...`);
        try {
          await this.invokeOBrien(obj.git_branch);
          obj.merged = true;
          await this.reporter.post(`🔀 O'Brien resolved conflict for ${obj.id}.`);
        } catch (err) {
          await this.reporter.post(`🔴 O'Brien could not resolve conflict for ${obj.id}: ${err.message}`);
          // Abort the merge so we can continue
          try {
            runGit(projectDir, ['merge', '--abort']);
          } catch { /* nothing to abort */ }
        }
      }
    }

    await state.writeMission(this.repo, this.missionId, this.state);

    // Return to default branch
    try {
      runGit(projectDir, ['checkout', this.state.default_branch]);
    } catch { /* may already be there */ }
  }

  // Invoke O'Brien to resolve a merge conflict
  async invokeOBrien(branch) {
    const projectDir = worktreeLib.projectPath(this.repo);
    const config = state.loadProjectConfig(this.repo);
    const model = config.model_overrides?.['obrien'] || 'claude-sonnet-4-5-20250929';

    const result = await worker.executeSpecialist(
      projectDir, 'obrien',
      `Merge conflict merging branch ${branch} into ${this.state.integration_branch}. ` +
      `Read briefings in the mission state directory to understand intent of both branches. ` +
      `Resolve conflicts preserving both sides' intent. ` +
      `Run git add -A && git commit to complete the merge. ` +
      `Then run tests to verify nothing broke.`,
      this.state,
      { model }
    );

    if (!result.success) {
      throw new Error(`O'Brien failed with exit code ${result.code}`);
    }
  }

  // Run mandatory specialist reviews for risk-flagged objectives
  async runMandatoryReviews() {
    const projectDir = worktreeLib.projectPath(this.repo);
    const config = state.loadProjectConfig(this.repo);
    const reviewed = new Set();

    for (const obj of this.state.work_items) {
      if (obj.status !== 'done' || !obj.risk_flags?.length) continue;

      const reviewers = risk.getMandatoryReviewers(obj.risk_flags);
      for (const reviewer of reviewers) {
        if (reviewer === 'human') continue; // Handled by checkpoints
        const reviewKey = `${reviewer}-${obj.id}`;
        if (reviewed.has(reviewKey)) continue;
        reviewed.add(reviewKey);

        await this.reporter.post(
          `🛡️ ${reviewer} reviewing ${obj.id} (risk flags: ${obj.risk_flags.join(', ')})...`
        );

        const model = config.model_overrides?.[reviewer] || undefined;
        const reviewPrompt = buildReviewPrompt(reviewer, obj, this.state);
        const result = await worker.executeSpecialist(
          projectDir, reviewer, reviewPrompt, this.state, { model }
        );

        await state.incrementSessionCount(this.repo, this.missionId);

        if (result.success) {
          await this.reporter.post(`✅ ${reviewer}: Review complete for ${obj.id}.`);
        } else {
          await this.reporter.post(`⚠️ ${reviewer}: Review had issues for ${obj.id}.`);
        }
      }
    }
  }

  // Ensure the integration branch exists
  ensureIntegrationBranch() {
    const projectDir = worktreeLib.projectPath(this.repo);
    const integrationBranch = this.state.integration_branch;

    try {
      runGit(projectDir, ['rev-parse', '--verify', integrationBranch]);
    } catch {
      // Branch doesn't exist — create it from default branch
      runGit(projectDir, ['branch', integrationBranch, this.state.default_branch]);
    }
  }
}

function shouldOpenPR(missionState) {
  if (!missionState) return false;
  if (missionState.status !== 'merging') return false;
  const pending = missionState.work_items.some(item => item.status !== 'done');
  return !pending;
}

// Build a review prompt for a specialist
function buildReviewPrompt(reviewer, objective, mission) {
  const stateDir = state.missionDir(mission.repo, mission.mission_id);

  const prompts = {
    worf: `Review objective ${objective.id} (${objective.title}) for security issues. ` +
      `Risk flags: ${objective.risk_flags.join(', ')}. ` +
      `Read the evidence bundle at ${stateDir}/artifacts/evidence-${objective.id}.json ` +
      `and review the code changes. Write your security review to ` +
      `${stateDir}/briefings/worf-review.json.`,

    geordi: `Review objective ${objective.id} (${objective.title}) for infrastructure safety. ` +
      `Risk flags: ${objective.risk_flags.join(', ')}. ` +
      `Read the evidence bundle and review configuration changes. Write your review to ` +
      `${stateDir}/briefings/geordi-review.json.`,

    spock: `Review objective ${objective.id} (${objective.title}) for test coverage and dependency safety. ` +
      `Risk flags: ${objective.risk_flags.join(', ')}. ` +
      `Verify no breaking changes. Write your report to ` +
      `${stateDir}/briefings/spock-report.json.`
  };

  return prompts[reviewer] || `Review objective ${objective.id} for ${objective.risk_flags.join(', ')} concerns.`;
}

// Check safety limits
function checkSafetyLimits(missionState) {
  const { safety } = missionState;

  if (safety.session_count >= safety.max_sessions) {
    return { blocked: true, reason: `Session limit reached (${safety.max_sessions})` };
  }

  const elapsed = (Date.now() - new Date(safety.started_at).getTime()) / 1000 / 3600;
  if (elapsed >= safety.max_elapsed_hours) {
    return { blocked: true, reason: `Time limit reached (${safety.max_elapsed_hours} hours)` };
  }

  return { blocked: false };
}

// No-op reporter for CLI/testing when no Slack
const noopReporter = {
  post: async (msg) => { console.log(msg); }
};

module.exports = { Mission, checkSafetyLimits, shouldOpenPR };
