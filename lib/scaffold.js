'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { logEvent } = require('./observability');
const { validateRepoName } = require('./validate');

const STATE_DIR = process.env.COMMANDDECK_STATE_DIR || path.join(process.env.HOME, '.commanddeck');
const PROJECT_DIR = process.env.COMMANDDECK_PROJECT_DIR || path.join(process.env.HOME, 'projects');
const CHANNEL_MAP_PATH = process.env.COMMANDDECK_CHANNEL_MAP
  || path.join(STATE_DIR, 'channel-map.json');

// Full end-to-end project creation
async function createProject(name, options = {}) {
  validateRepoName(name);

  const results = { name, steps: [] };

  // 1. Create GitHub repo
  try {
    const repoUrl = createGitHubRepo(name, options.description || `${name} — created by CommandDeck`);
    results.steps.push({ step: 'github-repo', status: 'ok', url: repoUrl });
  } catch (err) {
    results.steps.push({ step: 'github-repo', status: 'error', error: err.message });
    throw new Error(`Failed to create GitHub repo: ${err.message}`);
  }

  // 2. Clone the repo
  const projectDir = path.join(PROJECT_DIR, name);
  try {
    cloneRepo(name, projectDir);
    results.steps.push({ step: 'clone', status: 'ok', path: projectDir });
  } catch (err) {
    results.steps.push({ step: 'clone', status: 'error', error: err.message });
    throw new Error(`Failed to clone repo: ${err.message}`);
  }

  // 3. Initialize project structure
  try {
    initProjectStructure(projectDir, name, options);
    results.steps.push({ step: 'scaffold', status: 'ok' });
  } catch (err) {
    results.steps.push({ step: 'scaffold', status: 'error', error: err.message });
  }

  // 4. Add CI/CD workflow
  try {
    addCICDWorkflow(projectDir, name, options);
    results.steps.push({ step: 'cicd', status: 'ok' });
  } catch (err) {
    results.steps.push({ step: 'cicd', status: 'error', error: err.message });
  }

  // 5. Add Docker templates
  try {
    addDockerTemplates(projectDir, name, options);
    results.steps.push({ step: 'docker', status: 'ok' });
  } catch (err) {
    results.steps.push({ step: 'docker', status: 'error', error: err.message });
  }

  // 6. Create CommandDeck project config
  try {
    createProjectConfig(name, options);
    results.steps.push({ step: 'config', status: 'ok' });
  } catch (err) {
    results.steps.push({ step: 'config', status: 'error', error: err.message });
  }

  // 7. Commit and push scaffolded files
  try {
    commitAndPush(projectDir, name);
    results.steps.push({ step: 'push', status: 'ok' });
  } catch (err) {
    results.steps.push({ step: 'push', status: 'error', error: err.message });
  }

  // 8. Create Slack channel (if app provided)
  if (options.slackApp) {
    try {
      const channelId = await createSlackChannel(name, options.slackApp);
      updateChannelMap(channelId, name);
      results.steps.push({ step: 'slack-channel', status: 'ok', channelId });
    } catch (err) {
      results.steps.push({ step: 'slack-channel', status: 'error', error: err.message });
    }
  }

  logEvent('project.created', { name, steps: results.steps.length });
  return results;
}

// Create a GitHub repo via gh CLI
function createGitHubRepo(name, description) {
  const output = execFileSync('gh', [
    'repo', 'create', `gulati8/${name}`,
    '--public',
    '--description', description,
    '--confirm'
  ], { encoding: 'utf-8', stdio: 'pipe' });

  return output.trim() || `https://github.com/gulati8/${name}`;
}

// Clone a repo into the project directory
function cloneRepo(name, targetDir) {
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  execFileSync('gh', [
    'repo', 'clone', `gulati8/${name}`, targetDir
  ], { encoding: 'utf-8', stdio: 'pipe' });
}

// Initialize project file structure
function initProjectStructure(projectDir, name, options = {}) {
  // CLAUDE.md
  const claudeMd = [
    `# CLAUDE.md`,
    ``,
    `## Commands`,
    ``,
    `- **Install:** \`npm install\``,
    `- **Run tests:** \`npm test\``,
    `- **Start:** \`npm start\``,
    ``,
    `## Code Style`,
    ``,
    `- CommonJS (\`require\`/\`module.exports\`), strict mode`,
    `- 2-space indentation, single quotes, semicolons`,
    `- Node >= 20`,
    ``,
    `## Architecture`,
    ``,
    `${options.description || name}`,
    ``
  ].join('\n');

  fs.writeFileSync(path.join(projectDir, 'CLAUDE.md'), claudeMd, 'utf-8');

  // .claude/settings.json
  const claudeDir = path.join(projectDir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(
    path.join(claudeDir, 'settings.json'),
    JSON.stringify({ model: 'claude-sonnet-4-5-20250929' }, null, 2) + '\n',
    'utf-8'
  );

  // .claude/agents/ directory
  fs.mkdirSync(path.join(claudeDir, 'agents'), { recursive: true });

  // docs/adr/ directory
  fs.mkdirSync(path.join(projectDir, 'docs', 'adr'), { recursive: true });

  // Basic package.json if it doesn't exist
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    const pkg = {
      name,
      version: '0.1.0',
      description: options.description || name,
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        test: 'node --test test/*.test.js'
      },
      engines: { node: '>=20.0.0' },
      private: true
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  }
}

// Add CI/CD GitHub Actions workflow
function addCICDWorkflow(projectDir, name, options = {}) {
  const templatePath = path.join(__dirname, 'templates', 'github-actions.yml.tpl');
  let template;
  try {
    template = fs.readFileSync(templatePath, 'utf-8');
  } catch {
    // Fallback inline template
    template = defaultGithubActionsTemplate();
  }

  const rendered = template
    .replace(/\{\{APP_NAME\}\}/g, name)
    .replace(/\{\{PORT\}\}/g, String(options.port || 3000));

  const workflowDir = path.join(projectDir, '.github', 'workflows');
  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(path.join(workflowDir, 'deploy.yml'), rendered, 'utf-8');
}

// Add Docker templates
function addDockerTemplates(projectDir, name, options = {}) {
  // Dockerfile
  const dockerTemplatePath = path.join(__dirname, 'templates', 'Dockerfile.tpl');
  let dockerTemplate;
  try {
    dockerTemplate = fs.readFileSync(dockerTemplatePath, 'utf-8');
  } catch {
    dockerTemplate = defaultDockerfileTemplate();
  }

  const dockerfile = dockerTemplate
    .replace(/\{\{APP_NAME\}\}/g, name)
    .replace(/\{\{PORT\}\}/g, String(options.port || 3000));

  fs.writeFileSync(path.join(projectDir, 'Dockerfile'), dockerfile, 'utf-8');

  // docker-compose.prod.yml
  const composeTemplatePath = path.join(__dirname, 'templates', 'docker-compose.prod.yml.tpl');
  let composeTemplate;
  try {
    composeTemplate = fs.readFileSync(composeTemplatePath, 'utf-8');
  } catch {
    composeTemplate = defaultComposeTemplate();
  }

  const compose = composeTemplate
    .replace(/\{\{APP_NAME\}\}/g, name)
    .replace(/\{\{PORT\}\}/g, String(options.port || 3000));

  fs.writeFileSync(path.join(projectDir, 'docker-compose.prod.yml'), compose, 'utf-8');

  // .dockerignore
  fs.writeFileSync(
    path.join(projectDir, '.dockerignore'),
    'node_modules\n.git\n.env\n.env.*\n*.log\n.DS_Store\n',
    'utf-8'
  );
}

// Create CommandDeck project config in state directory
function createProjectConfig(name, options = {}) {
  const projectStateDir = path.join(STATE_DIR, 'projects', name);
  fs.mkdirSync(path.join(projectStateDir, 'directives'), { recursive: true });
  fs.mkdirSync(path.join(projectStateDir, 'missions'), { recursive: true });

  const config = {
    default_branch: options.defaultBranch || 'main',
    max_workers: 1,
    max_sessions: 50,
    max_elapsed_hours: 6,
    test_command: options.testCommand || 'npm test',
    lint_command: options.lintCommand || null,
    build_command: options.buildCommand || null,
    model_overrides: {}
  };

  fs.writeFileSync(
    path.join(projectStateDir, 'config.json'),
    JSON.stringify(config, null, 2) + '\n',
    'utf-8'
  );

  return config;
}

// Create a Slack channel for the project
async function createSlackChannel(name, app) {
  const channelName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const result = await app.client.conversations.create({
    name: channelName,
    is_private: false
  });

  const channelId = result.channel.id;

  // Invite the bot to the channel
  try {
    const authResult = await app.client.auth.test();
    await app.client.conversations.invite({
      channel: channelId,
      users: authResult.user_id
    });
  } catch {
    // Bot may already be in channel
  }

  return channelId;
}

// Update channel-map.json with new project mapping
function updateChannelMap(channelId, repoName) {
  let map = { channel_map: {} };
  try {
    map = JSON.parse(fs.readFileSync(CHANNEL_MAP_PATH, 'utf-8'));
  } catch {
    // Start fresh
  }

  map.channel_map[channelId] = repoName;

  fs.mkdirSync(path.dirname(CHANNEL_MAP_PATH), { recursive: true });
  const tmpPath = CHANNEL_MAP_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(map, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, CHANNEL_MAP_PATH);
}

// Commit scaffolded files and push
function commitAndPush(projectDir, name) {
  execFileSync('git', ['add', '-A'], { cwd: projectDir, stdio: 'pipe' });
  execFileSync('git', [
    'commit', '-m', `Initialize ${name} with CommandDeck scaffolding`
  ], { cwd: projectDir, stdio: 'pipe' });
  execFileSync('git', ['push', 'origin', 'main'], { cwd: projectDir, stdio: 'pipe' });
}

// Fallback templates when template files don't exist

function defaultGithubActionsTemplate() {
  return `name: Deploy {{APP_NAME}}

on:
  push:
    branches: [main]

permissions:
  contents: read
  packages: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/gulati8/{{APP_NAME}}:latest
            ghcr.io/gulati8/{{APP_NAME}}:\${{ github.sha }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: \${{ secrets.AWS_REGION }}
      - name: Pull and restart on EC2
        run: |
          aws ssm send-command \\
            --instance-ids "\${{ secrets.EC2_INSTANCE_ID }}" \\
            --document-name "AWS-RunShellScript" \\
            --parameters 'commands=[
              "cd /srv/{{APP_NAME}}",
              "docker compose pull",
              "docker compose up -d --remove-orphans"
            ]' \\
            --output text
`;
}

function defaultDockerfileTemplate() {
  return `FROM node:20-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production

COPY . .

EXPOSE {{PORT}}
CMD ["node", "index.js"]
`;
}

function defaultComposeTemplate() {
  return `services:
  {{APP_NAME}}:
    image: ghcr.io/gulati8/{{APP_NAME}}:latest
    container_name: {{APP_NAME}}
    restart: unless-stopped
    env_file: .env
    networks:
      - proxy

networks:
  proxy:
    external: true
`;
}

module.exports = {
  createProject,
  createGitHubRepo,
  cloneRepo,
  initProjectStructure,
  addCICDWorkflow,
  addDockerTemplates,
  createProjectConfig,
  createSlackChannel,
  updateChannelMap,
  commitAndPush
};
