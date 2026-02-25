'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('scaffold', () => {
  let tempDir;
  let stateDir;
  let projectDir;
  let oldStateDir;
  let oldProjectDir;
  let oldChannelMap;
  let scaffold;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'commanddeck-scaffold-'));
    stateDir = path.join(tempDir, 'state');
    projectDir = path.join(tempDir, 'projects');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });

    oldStateDir = process.env.COMMANDDECK_STATE_DIR;
    oldProjectDir = process.env.COMMANDDECK_PROJECT_DIR;
    oldChannelMap = process.env.COMMANDDECK_CHANNEL_MAP;
    process.env.COMMANDDECK_STATE_DIR = stateDir;
    process.env.COMMANDDECK_PROJECT_DIR = projectDir;
    process.env.COMMANDDECK_CHANNEL_MAP = path.join(stateDir, 'channel-map.json');

    delete require.cache[require.resolve('../lib/scaffold')];
    scaffold = require('../lib/scaffold');
  });

  after(() => {
    process.env.COMMANDDECK_STATE_DIR = oldStateDir;
    process.env.COMMANDDECK_PROJECT_DIR = oldProjectDir;
    if (oldChannelMap) {
      process.env.COMMANDDECK_CHANNEL_MAP = oldChannelMap;
    } else {
      delete process.env.COMMANDDECK_CHANNEL_MAP;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('initProjectStructure', () => {
    it('should create CLAUDE.md and directories', () => {
      const dir = path.join(tempDir, 'test-project');
      fs.mkdirSync(dir, { recursive: true });

      scaffold.initProjectStructure(dir, 'test-project', {
        description: 'A test project'
      });

      assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.md')));
      assert.ok(fs.existsSync(path.join(dir, '.claude', 'settings.json')));
      assert.ok(fs.existsSync(path.join(dir, '.claude', 'agents')));
      assert.ok(fs.existsSync(path.join(dir, 'docs', 'adr')));
      assert.ok(fs.existsSync(path.join(dir, 'package.json')));

      const claudeMd = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf-8');
      assert.ok(claudeMd.includes('A test project'));
    });

    it('should not overwrite existing package.json', () => {
      const dir = path.join(tempDir, 'existing-pkg');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'original', version: '1.0.0' }),
        'utf-8'
      );

      scaffold.initProjectStructure(dir, 'existing-pkg', {});

      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
      assert.equal(pkg.name, 'original');
      assert.equal(pkg.version, '1.0.0');
    });
  });

  describe('addCICDWorkflow', () => {
    it('should create deploy.yml in .github/workflows', () => {
      const dir = path.join(tempDir, 'cicd-project');
      fs.mkdirSync(dir, { recursive: true });

      scaffold.addCICDWorkflow(dir, 'my-app', { port: 4000 });

      const workflowPath = path.join(dir, '.github', 'workflows', 'deploy.yml');
      assert.ok(fs.existsSync(workflowPath));

      const content = fs.readFileSync(workflowPath, 'utf-8');
      assert.ok(content.includes('my-app'));
    });
  });

  describe('addDockerTemplates', () => {
    it('should create Dockerfile, compose, and .dockerignore', () => {
      const dir = path.join(tempDir, 'docker-project');
      fs.mkdirSync(dir, { recursive: true });

      scaffold.addDockerTemplates(dir, 'my-app', { port: 8080 });

      assert.ok(fs.existsSync(path.join(dir, 'Dockerfile')));
      assert.ok(fs.existsSync(path.join(dir, 'docker-compose.prod.yml')));
      assert.ok(fs.existsSync(path.join(dir, '.dockerignore')));

      const dockerfile = fs.readFileSync(path.join(dir, 'Dockerfile'), 'utf-8');
      assert.ok(dockerfile.includes('8080'));
    });
  });

  describe('createProjectConfig', () => {
    it('should create config.json in state directory', () => {
      scaffold.createProjectConfig('config-test', {
        testCommand: 'jest',
        defaultBranch: 'develop'
      });

      const configPath = path.join(stateDir, 'projects', 'config-test', 'config.json');
      assert.ok(fs.existsSync(configPath));

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      assert.equal(config.test_command, 'jest');
      assert.equal(config.default_branch, 'develop');
      assert.equal(config.max_workers, 1);
    });

    it('should create mission and directive directories', () => {
      scaffold.createProjectConfig('dirs-test', {});

      assert.ok(fs.existsSync(path.join(stateDir, 'projects', 'dirs-test', 'missions')));
      assert.ok(fs.existsSync(path.join(stateDir, 'projects', 'dirs-test', 'directives')));
    });
  });

  describe('global config integration', () => {
    it('should render templates with registry and domain from global config', () => {
      // Write a custom global config
      fs.writeFileSync(
        path.join(stateDir, 'config.json'),
        JSON.stringify({ registry: 'ghcr.io/testorg', domain: 'test.dev' }),
        'utf-8'
      );

      // Re-require to pick up new config
      delete require.cache[require.resolve('../lib/state')];
      delete require.cache[require.resolve('../lib/scaffold')];
      const freshScaffold = require('../lib/scaffold');

      const dir = path.join(tempDir, 'config-render-project');
      fs.mkdirSync(dir, { recursive: true });

      freshScaffold.addCICDWorkflow(dir, 'my-app', { port: 3000 });
      const workflow = fs.readFileSync(path.join(dir, '.github', 'workflows', 'deploy.yml'), 'utf-8');
      assert.ok(workflow.includes('ghcr.io/testorg/my-app'));
      assert.ok(workflow.includes('test.dev'));
      assert.ok(!workflow.includes('gulati8'));
      assert.ok(!workflow.includes('gulatilabs.me'));

      freshScaffold.addDockerTemplates(dir, 'my-app', { port: 3000 });
      const compose = fs.readFileSync(path.join(dir, 'docker-compose.prod.yml'), 'utf-8');
      assert.ok(compose.includes('ghcr.io/testorg/my-app'));
      assert.ok(!compose.includes('gulati8'));

      // Clean up
      fs.unlinkSync(path.join(stateDir, 'config.json'));
      delete require.cache[require.resolve('../lib/state')];
      delete require.cache[require.resolve('../lib/scaffold')];
    });

    it('should use default registry when no global config exists', () => {
      const dir = path.join(tempDir, 'default-render-project');
      fs.mkdirSync(dir, { recursive: true });

      scaffold.addDockerTemplates(dir, 'my-app', { port: 3000 });
      const compose = fs.readFileSync(path.join(dir, 'docker-compose.prod.yml'), 'utf-8');
      assert.ok(compose.includes('ghcr.io/gulati8/my-app'));
    });
  });

  describe('updateChannelMap', () => {
    it('should create and update channel map', () => {
      scaffold.updateChannelMap('C123', 'test-repo');

      const mapPath = path.join(stateDir, 'channel-map.json');
      assert.ok(fs.existsSync(mapPath));

      const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
      assert.equal(map.channel_map.C123, 'test-repo');
    });

    it('should append to existing channel map', () => {
      scaffold.updateChannelMap('C456', 'other-repo');

      const mapPath = path.join(stateDir, 'channel-map.json');
      const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
      assert.equal(map.channel_map.C123, 'test-repo');
      assert.equal(map.channel_map.C456, 'other-repo');
    });
  });
});
