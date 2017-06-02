#!/usr/bin/env node
const chalk       = require('chalk');
const Promise     = require('bluebird');
const PromisePool = require('es6-promise-pool');
const rp          = require('request-promise');

const config = require('./config.json');
const models = require('./lib/models');

function randomOverLimit() {
  return 20 + Math.floor(Math.random() * 9980);
}

// http://sufflavus.github.io/JS-Tips-Take-While
function takeWhile(source, predicate) {
  let stopIndex = source.length;
  source.some((n, index, arr) =>
    predicate(n, index, arr) ? false : ((stopIndex = index), true)
  );
  return source.slice(0, stopIndex);
}

// crawl until this id
function crawlerPool(untilId) {
  return () => {
    let page = 0;
    let currId = Infinity;

    let crawler = function() {
      if (currId < untilId) {
        console.log('Crawl job generator finished');
        return null;
      }
      page++;
      console.log('Crawling page ' + page);

      return rp.get('http://judge.mirlab.org/api/submission' +
         `?page=${page}&limit=${randomOverLimit()}`, { json: true })
        .then((result) => {
          let rangeStr = result[0].sid + ' ~ '
            + result[result.length - 1].sid;

          if (result[0].sid < currId) {
            currId = result[0].sid;
          }
          // truncate list
          let resValid = takeWhile(result, r => r.sid >= untilId)
            .filter(r => r.pid > 70000 && r.pid < 80000);

          console.log(chalk.green(`crawl [${rangeStr}] success, len=${resValid.length}`));

          // prepare writing to DB
          return models.db.transaction((t) => {
            return Promise.each(resValid, (rec) => {
              return Promise.all([
                models.Problem.findOrCreate({
                  transaction: t,
                  where: { pid: rec.pid },
                  defaults: {
                    title: rec.ttl
                  }
                }),
                models.User.findOrCreate({
                  transaction: t,
                  where: { uid: rec.uid },
                  defaults: {
                    username: rec.lgn
                  }
                })
              ]).then(() => {
                return models.Submission.findOrCreate({
                  transaction: t,
                  where: { sid: rec.sid },
                  defaults: rec
                });
              }, (err) => {
                // commit failed
                console.log('Failed to commit', chalk.red(err));
                throw err;
              });
            });
          }).then(() => {
            console.log(chalk.blue(`saved records [${rangeStr}]`));
          }).catch((err) => {
            console.log('Failed to start transaction', chalk.red(err));
            throw err;
          });
        });
    }
    let pool = new PromisePool(crawler, config.concurrency);
    return pool.start();
  };
}

models.Submission.sync()
.then((Sub) => {
  return Sub.getNewestID();
})
.then((id) => {
  let untilId = Math.max(id, config.submissionBase);
  console.log(`Newest ID in DB: ${id}; crawl until id ${untilId}`);
  return new Promise(crawlerPool(untilId));
});
