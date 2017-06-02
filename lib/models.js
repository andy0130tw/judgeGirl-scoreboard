const path = require('path');
const appRoot = path.dirname(require.main.filename);

const Seq = require('sequelize');

const db = new Seq('sqlite://jgscoreboard.sqlite', {
    define: {
        freezeTableName: true,
        underscored: true
    },
    logging: process.env['NODE_ENV'] == 'debug'
});

const User = db.define('user', {
    'uid':      { type: Seq.INTEGER, primaryKey: true },
    'username': { type: Seq.STRING },
    'score':    { type: Seq.INTEGER, defaultValue: 0 },
    // maintainProblem -> Problem
});

const Problem = db.define('problem', {
    'pid':   { type: Seq.INTEGER, primaryKey: true },
    'title': { type: Seq.STRING },
});

const Submission = db.define('submission', {
    'sid': { type: Seq.INTEGER, primaryKey: true },
    'res': { type: Seq.INTEGER },  // verdict
    'scr': { type: Seq.INTEGER },  // score
    'ts':  { type: Seq.INTEGER },  // submitted time
    'cpu': { type: Seq.INTEGER },  // time used
    'mem': { type: Seq.INTEGER },
    'len': { type: Seq.INTEGER },
    'ip':  { type: Seq.STRING }
});

Problem.hasMany(User, { as: 'Setters', foreignKey: 'maintainProblem' });
Submission.belongsTo(User, { foreignKey: 'uid' });
Submission.belongsTo(Problem, { foreignKey: 'pid' });

Submission.getNewestID = function() {
    return this.findOne({
        order: [['sid', 'DESC']],
        attributes: ['sid']
    }).then(model => model ? model.sid : null);
};

db.sync().catch((err) => {
    console.error('Error occurred when initializing DB', err);
});

module.exports = {
    db: db,

    User:       User,
    Problem:    Problem,
    Submission: Submission,
};
