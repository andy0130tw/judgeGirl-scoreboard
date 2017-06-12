#!/usr/bin/env node
const fs        = require('fs');
const ejs       = require('ejs');
const Promise   = require('bluebird');
const models    = require('./lib/models');
const constants = require('./lib/constants');

const templateContext = {};

Promise.all([
  models.User.findAll({
    raw: true,
    attributes: {
      exclude: [ 'maintainProblem', 'created_at', 'updated_at' ]
    } }),
  models.Problem.findAll({
    raw: true,
    attributes: {
      exclude: [ 'created_at', 'updated_at' ]
    }
  }),
  models.Submission.findAll({
    raw: true,
    order: [ 'uid', 'pid', 'sid' ]
  })
]).spread((users, problems, submissions) => {
  templateContext.submissionCount = submissions.length;

  let users_arr = [];
  users.forEach((u) => {
    u._problem = {};
    users_arr[u.uid] = u;
  });

  let problem_arr = {};
  problems.forEach((p) => {
    let mat = p.title.match(/(.+) - (.+)/);
    if (mat) {
      p.ta = mat[1];
      p.title = mat[2].trim();
    }
    p.user_accepted = 0;
    p.user_tried = 0;
    problem_arr[p.pid] = p;
  });

  submissions.forEach((s) => {
    let probObj = users_arr[s.uid]._problem;
    probObj[s.pid] = probObj[s.pid] || [];
    probObj[s.pid].push(s);
  });
  users.forEach((u) => {
    let ac_count = 0, trial_ttl = 0;

    let debug = u.uid == 132;

    // for each problem associated on the user
    for (let x in u._problem) {
      let trial = 0, accepted = false;

      if (problem_arr[x]) {
        problem_arr[x].user_tried++;
      }

      let bestSubm = u._problem[x].reduce((acc, val) => {
        return val.scr >= acc.scr ? val : acc;
      });

      if (bestSubm.res == 7) {
        ac_count++;
        problem_arr[x].user_accepted++;
      }

      for (let i = 0, p = u._problem[x]; i < p.length; i++) {
        trial++;
        if (p[i].res == 7) break;
      }

      u[`result_${x}`] = {
        trial: trial,
        verdict: constants.ENUM_RESULT[bestSubm.res],
        best: bestSubm
      };

      trial_ttl += trial;
      u.score += bestSubm.scr;
    }
    delete u._problem;
    u.stat = {
      ac_count: ac_count,
      trial_ttl: trial_ttl
    };
  });

  problems.sort((a, b) => (b.user_accepted - a.user_accepted) || (a.user_tried - b.user_tried));
  templateContext.problems = JSON.stringify(problems);
  templateContext.data = JSON.stringify(users);

  fs.writeFileSync('static/index.html',
    ejs.render(fs.readFileSync('static/template.ejs', 'utf-8'), templateContext),
    'utf-8');
});
