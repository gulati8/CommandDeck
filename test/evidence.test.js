'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');

process.env.COMMANDDECK_STATE_DIR = path.join(os.tmpdir(), `commanddeck-evidence-test-${Date.now()}`);

const evidence = require('../lib/evidence');

describe('evidence', () => {
  describe('validate', () => {
    it('should validate a complete bundle', () => {
      const bundle = {
        objective_id: 'obj-1',
        agent: 'borg',
        summary: 'Built the widget',
        files_changed: {
          created: ['src/widget.js'],
          modified: [],
          deleted: []
        },
        commands_run: ['npm test'],
        tests: {
          added: ['test/widget.test.js'],
          result: 'pass'
        }
      };

      const result = evidence.validate(bundle);
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('should reject bundle missing required fields', () => {
      const bundle = {
        objective_id: 'obj-1',
        agent: 'borg'
      };

      const result = evidence.validate(bundle);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('summary')));
      assert.ok(result.errors.some(e => e.includes('files_changed')));
      assert.ok(result.errors.some(e => e.includes('commands_run')));
      assert.ok(result.errors.some(e => e.includes('tests')));
    });

    it('should reject bundle with invalid test result', () => {
      const bundle = {
        objective_id: 'obj-1',
        agent: 'borg',
        summary: 'Built',
        files_changed: { created: [], modified: [], deleted: [] },
        commands_run: [],
        tests: { added: [], result: 'invalid' }
      };

      const result = evidence.validate(bundle);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('tests.result')));
    });

    it('should accept all valid test result values', () => {
      for (const resultValue of ['pass', 'fail', 'skip', 'none']) {
        const bundle = {
          objective_id: 'obj-1',
          agent: 'borg',
          summary: 'Test',
          files_changed: { created: [], modified: [], deleted: [] },
          commands_run: [],
          tests: { added: [], result: resultValue }
        };

        const result = evidence.validate(bundle);
        assert.equal(result.valid, true, `Should accept test result "${resultValue}"`);
      }
    });

    it('should reject non-array files_changed fields', () => {
      const bundle = {
        objective_id: 'obj-1',
        agent: 'borg',
        summary: 'Test',
        files_changed: { created: 'not-array', modified: [], deleted: [] },
        commands_run: [],
        tests: { added: [], result: 'pass' }
      };

      const result = evidence.validate(bundle);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('files_changed.created')));
    });

    it('should reject non-array commands_run', () => {
      const bundle = {
        objective_id: 'obj-1',
        agent: 'borg',
        summary: 'Test',
        files_changed: { created: [], modified: [], deleted: [] },
        commands_run: 'npm test',
        tests: { added: [], result: 'pass' }
      };

      const result = evidence.validate(bundle);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('commands_run')));
    });
  });

  describe('formatObjectiveMarkdown', () => {
    it('should format a bundle as markdown', () => {
      const bundle = {
        objective_id: 'obj-1',
        agent: 'borg',
        summary: 'Built the widget',
        files_changed: {
          created: ['src/widget.js', 'src/widget.css'],
          modified: ['src/index.js'],
          deleted: []
        },
        commands_run: ['npm test'],
        tests: {
          added: ['test/widget.test.js'],
          result: 'pass',
          coverage: '85%'
        }
      };

      const workItem = { id: 'obj-1', title: 'Build widget', status: 'done', assigned_to: 'borg' };
      const md = evidence.formatObjectiveMarkdown(bundle, workItem);

      assert.ok(md.includes('obj-1'));
      assert.ok(md.includes('Build widget'));
      assert.ok(md.includes('✅'));
      assert.ok(md.includes('2 created'));
      assert.ok(md.includes('1 modified'));
      assert.ok(md.includes('1 added'));
      assert.ok(md.includes('pass'));
      assert.ok(md.includes('85%'));
    });

    it('should show risk flags and reviewer notes', () => {
      const bundle = {
        objective_id: 'obj-2',
        agent: 'borg',
        summary: 'Auth',
        files_changed: { created: [], modified: ['src/auth.js'], deleted: [] },
        commands_run: [],
        tests: { added: [], result: 'pass' },
        risk_flags: ['auth', 'security'],
        notes_for_reviewer: ['Check token expiry logic', 'Verify CORS config']
      };

      const md = evidence.formatObjectiveMarkdown(bundle, { status: 'done', title: 'Auth' });
      assert.ok(md.includes('auth'));
      assert.ok(md.includes('security'));
      assert.ok(md.includes('Check token expiry'));
      assert.ok(md.includes('Verify CORS'));
    });
  });

  describe('REQUIRED_FIELDS', () => {
    it('should contain expected fields', () => {
      assert.ok(evidence.REQUIRED_FIELDS.includes('objective_id'));
      assert.ok(evidence.REQUIRED_FIELDS.includes('agent'));
      assert.ok(evidence.REQUIRED_FIELDS.includes('summary'));
      assert.ok(evidence.REQUIRED_FIELDS.includes('files_changed'));
      assert.ok(evidence.REQUIRED_FIELDS.includes('commands_run'));
      assert.ok(evidence.REQUIRED_FIELDS.includes('tests'));
    });
  });
});
