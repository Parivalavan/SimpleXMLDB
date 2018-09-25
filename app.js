var compression = require('compression')
    , config = require('./_config/config.js')
    , express = require('express')
    , expressStatus = require('express-status-monitor')
    , helmet = require('helmet')
    , routers = require('./_core/routers.js')
    ;

global.db = {
    'config': config,
    'dom': {},
    'q': {}
};

var app = express();				// call the express framwork
// app.use(expressStatus());			// status monitor
// app.enable('trust proxy');			// to get the actual ip address behind aws elb proxy

//to define port from an argument
var port = 8081;
if ((process.argv.length > 2) && (process.argv[2])) {
    port = process.argv[2] ? process.argv[2] : 8081;
}

/*const mlogger = require('morgan');

var path = require('path');
var rfs = require('rotating-file-stream');
var fs = require('fs-extra');
var logDirectory = path.join(__dirname, '_logs')

// ensure log directory exists
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);

// create a rotating write stream
var accessLogStream = rfs('access.log', {
  interval: '1d', // rotate daily
  path: logDirectory
})

// setup the logger
app.use(mlogger('combined', {stream: accessLogStream}))
*/
app.use(helmet());                  // to set the http headers
app.use(compression());             // New call to compress content
// app.use(session(sessionOptions));   // set the sessions
// app.use(expReqLogger());
app.use(routers);                   // call the controllers

// app exit normally
process.on('exit', function () {
    console.log('app exit');
    process.exit();
});

// catch ctrl+c event and exit normally
process.on('SIGINT', function () {
    console.log('Ctrl-C...');
    process.exit();
});

// TODO: IMPORTANT: Need to update this section
//catch uncaught exceptions, trace, then exit normally
process.on('uncaughtException', function (e) {
    console.log('Uncaught Exception...');
    console.log(e.stack);
    var ip = require("ip");
    var ipAddress = ip.address();
    if (cms.config && cms.config.ip) {
        var ipArray = cms.config.ip.split(',');
    }
    if (cms.config && ipArray && ipArray.indexOf(ipAddress) >= 0) {
        var mailer = require('./cms/v2.0/api/post/sendMail.js');
        var req = {};
        req.to = cms.config.error.mailto;
        var serverName = cms.config.servername ? cms.config.servername : 'kriya-node-server';
        req.subject = serverName + ' : kriyā 2.0 : Uncaught Exception';
        req.body = '<p>kriyā 2.0 : Uncaught Exception</p><pre>' + e.stack + '</pre>';
        mailer['sendMail'](req)
            .then(function (info) {
                process.exit();
            })
            .catch(function () {
                process.exit();
            })
    } else {
        process.exit();
    }
});

// start the server and listen to the port
app.listen(port, function () {
    console.log("\033c");
    console.log('                                                  +-+-+-+-+-+-+-+-+-+-+-+-+-+');
    console.log('                                                  |  k r i y a  x m l  d b  |');
    console.log('                                                  +-+-+-+-+-+-+-+-+-+-+-+-+-+');
    console.log('');
    console.log('listening on port      : ' + port);
    console.log('server is ready ...');
    console.log('environment', process.env.NODE_ENV);
})
