'use strict';

const { Mission } = require('./mission');
const state = require('./state');
const learn = require('./learn');

async function startMission(repo, prompt, context = {}) {
  validateRepoName(repo);
  const mission = new Mission(repo, prompt, context);
  return mission.start();
}

async function proposeLearning(text, context = {}) {
  return learn.propose(text, context);
}

async function getMissionStatus(missionId) {
  return state.getMissionStatus(missionId);
}

function validateRepoName(repo) {
  if (typeof repo !== 'string' || repo.length === 0) {
    throw new Error('Repository name is required');
  }
  if (!/^[A-Za-z0-9._-]+$/.test(repo)) {
    throw new Error(`Invalid repository name: ${repo}`);
  }
}

module.exports = {
  startMission,
  proposeLearning,
  getMissionStatus,
  validateRepoName
};
