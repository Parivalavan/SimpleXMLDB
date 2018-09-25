var bodyParser = require('body-parser')
    , express = require('express')
    , router = express.Router()
    , xml = require(__dirname + '/xml.js')
    ;

// There will not be any authorisation because the request is going to be limited to Whitelisted IP

router.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))		        // parse application/x-www-form-urlencoded
router.use(bodyParser.text({ limit: '50mb', type: 'application/xml' }))		        // parse application/xml
router.use(bodyParser.json({ limit: 1024 * 1024 * 20, type: 'application/json' }))  // parse application/json

/**
 * all requests to fetch the XML, execute XQL will be handled here
 */
router.get('/rest/*\.xml$', function (req, res) {
    var queryString = req.query.xpath ? req.query.xpath : '';
    xml.get(req.path, queryString)
        .then(function (data) {
            res.type('application/xml');
            res.status(200).send(data).end();
        })
        .catch(function (e) {
            if (e.filePath && !e.exists) {
                res.status(404).json({ status: { code: 404, message: "Document `" + req.path + "` not found" } }).end();
            }
            else if (e.filePath && e.exists && e.reason) {
                res.status(404).json({ status: { code: 404, message: e.reason } }).end();
            }
            else {
                res.status(404).json({ status: { code: 404, message: "Document `" + req.path + "` not found" } }).end();
            }
        })
});

/**
 * write the XML in body (raw) with header as 'application/xml' to DB
 */
router.put('/rest/*\.xml$', function (req, res) {
    xml.put(req.path, req.body.toString())
        .then(function (data) {
            res.status(200).json({ status: { code: 200, message: "Document stored in DB" } }).end();
        })
        .catch(function (e) {
            var respJSON = { status: { code: 500, message: 'Something went wrong when writing to DB' } }
            var respStatusCode = 500;
            if (e.error && e.error.xmlis && e.error.xmli1s == 'invalid'){
                respJSON.status.code = '422'
                respStatusCode = 422;
            }
            if (e.reason) {
                respJSON.status['message'] = e.reason;
            }
            if (e.error) {
                respJSON.status['error'] = e.error;
            }
            res.status(respStatusCode).json(respJSON).end();
        })
});

/**
 * get requests to XQLs will execute XQLs and return their response
 */
router.get('/rest/*\.xql$', function (req, res) {
    console.log(req.path);
    res.status(200).json({ status: { code: 200, message: "XQL Endpoint" } }).end();
});

/**
 * handle all other requests here, just say not found!!!
 */
router.all('*', function (req, res) {
    res.status(200).json({ status: { code: 404, message: "You have used an incorrect request methos (GET instead of POST?) or the requested resource does not exist" } }).end();
});

module.exports = router