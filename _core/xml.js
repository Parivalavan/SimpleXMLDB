//https://github.com/leeluolee/fstorm
//https://stackoverflow.com/questions/10769736/how-to-queue-http-get-requests-in-nodejs-in-order-to-control-their-rate
var fs = require('fs-extra');
var path = require('path');
var s3 = require('s3');
const libxml = require('libxmljs');

// self is declared so the internal functions can be called using it
// https://stackoverflow.com/questions/10462223/call-a-local-function-within-module-exports-from-another-function-in-module-ex
var self = module.exports = {
    /**
     * exists functions returns object
     * sample output
     * {
     *  'filePath': 'given path', // given path after removing /rest from beginning
     *  'absolutePath': '', // will the physical path to file on the system
     *  'exists': true/false, // file exists or not
     *  'location': 'memory|fs' // is the file currently in memory as XML DOM object or in file system
     * }
     *
     * absolutePath will be empty string if file is not found
     * to check file exists the following checks are made
     * 1) check if path is present in global.db.q as key
     * 2) check if file exists using fs.exists function
     */
    exists: function (filePath) {
        return new Promise(function (resolve, reject) {
            filePath = filePath.replace(/^\/rest\//, '/');
            var fp = db.config.filePath + db.config.basePath + filePath;

            if (global.db.q[filePath]) {
                resolve({ 'filePath': filePath, 'absolutePath': fp, 'exists': true, 'location': 'memory' });
            }
            else if (fs.existsSync(fp)) {
                resolve({ 'filePath': filePath, 'absolutePath': fp, 'exists': true, 'location': 'fs' });
            }
            // try to look up on AWS S3 for a backup
            else {
                var fileName = path.basename(filePath);
                // if there is no AWS config, then reject
                if (!config['aws']) {
                    reject({ 'filePath': filePath, 'absolutePath': '', 'exists': false, 'location': 'fs' });
                    return false;
                }
                var resourceBucket = db.config.aws.backupFolder + db.config.basePath + filePath.substring(0, filePath.length - fileName.length - 1);
                var client = s3.createClient({
                    s3RetryCount: 3,
                    multipartUploadThreshold: 20971520,
                    s3Options: {
                        "accessKeyId": db.config.aws.accessKeyId,
                        "secretAccessKey": db.config.aws.secretAccessKey
                    }
                });

                params = {
                    localFile: path.resolve(fp),
                    // default false, whether to remove s3 objects,that have no corresponding local file.
                    s3Params: {
                        "Bucket": db.config.aws.defaultBucket + "/" + resourceBucket,
                        "Key": fileName,
                    }
                };
                operation = client.downloadFile(params)
                operation.on('error', function (err) {
                    reject({ 'filePath': filePath, 'absolutePath': '', 'exists': false, 'location': 'fs' });
                });
                operation.on('progress', function () {
                    //console.log("progress = ", Math.ceil((operation.progressAmount/operation.progressTotal)*100) +"%");
                });
                operation.on('end', function () {
                    resolve({ 'filePath': filePath, 'absolutePath': fp, 'exists': true, 'location': 'aws' });
                });
            }
        });
    },
    get: function (filePath, queryString) {
        return new Promise(function (resolve, reject) {
            var getObj = {
                'filePath': filePath.replace(/^\/rest\//, '/'),
                'queryString': queryString
            }
            self.exists(filePath)
                .then(function (pathObj) {
                    if (pathObj.location == 'memory') {
                        // console.log('inside memory');
                        // var xmlDoc = db.q[pathObj.filePath].xmlString;
                        // var xmlString = xmlDoc.toString();
                        if (getObj.queryString) {
                            self.queryUsingXPath(getObj.filePath, getObj.queryString)
                                .then(function (queryObj) {
                                    resolve(queryObj);
                                })
                                .catch(function (queryErrObj) {
                                    reject(queryErrObj);
                                })
                        }
                        else {
                            resolve(db.q[getObj.filePath].xmlString);
                        }
                        return true;
                    }
                    // console.log('inside fs');
                    getObj['pathObj'] = pathObj;
                    fs.readFile(pathObj.absolutePath, 'utf8', function (fileReadError, xmlString) {
                        if (fileReadError) {
                            reject({ 'filePath': getObj.filePath, 'absolutePath': '', 'exists': true, 'reason': 'failed to read file', error: fileReadError });
                        }
                        else {
                            // resolve(xmlString);
                            self.loadXML(xmlString, false)
                                .then(function (xmlObj) {
                                    global.db.q[getObj.pathObj.filePath] = {
                                        'xmlDoc': xmlObj.xmlDoc,
                                        'xmlString': xmlObj.xmlString
                                    }
                                    if (getObj.queryString) {
                                        self.queryUsingXPath(getObj.filePath, getObj.queryString)
                                            .then(function (queryObj) {
                                                resolve(queryObj);
                                            })
                                            .catch(function (queryErrObj) {
                                                reject(queryErrObj);
                                            })
                                    } else {
                                        resolve(db.q[getObj.filePath].xmlString);
                                        return true;
                                    }
                                })
                                .catch(function (xmlErrObj) {
                                    reject({ 'filePath': filePath, 'reason': 'Unable to read file into memory DB', 'error': xmlErrObj });
                                })
                        }
                    });
                })
                .catch(function (e) {
                    if (e.filePath && !e.exists) {
                        reject({ 'filePath': filePath, 'absolutePath': '', 'exists': false });
                    }
                    else {
                        reject({ 'filePath': filePath, 'absolutePath': '', 'exists': false });
                    }
                })
        });
    },
    put: function (filePath, data) {
        return new Promise(function (resolve, reject) {
            // check if xml is well-formed before proceeding to write to file
            self.loadXML(data, true)
                .then(function (xmlObj) {
                    filePath = filePath.replace(/^\/rest\//, '/');
                    var fp = db.config.filePath + db.config.basePath + filePath;
                    fs.outputFile(fp, data)
                        .then(function () {
                            resolve({ 'filePath': filePath, 'message': 'Document added to DB' });
                        })
                        .catch(function (fileWriteError) {
                            reject({ 'filePath': filePath, 'reason': 'Unable to write to DB', 'error': fileWriteError });
                        })
                })
                .catch(function (xmlErrObj) {
                    reject({ 'filePath': filePath, 'reason': 'Unable to write to DB', 'error': xmlErrObj });
                })
        });
    },
    /**
     * loads the given XML into DOM
     * @param {string} data - XML string
     * @param {boolean} checkWellFormed - if true only well-form status is return, else the dom object is also returned
     */
    loadXML: function (data, checkWellFormed) {
        return new Promise(function (resolve, reject) {
            try {
                xmlDoc = libxml.parseXmlString(data);
                if (checkWellFormed) {
                    resolve({ 'xmlis': 'valid' });
                }
                else {
                    resolve({ 'xmlis': 'valid', 'xmlDoc': xmlDoc, 'xmlString': data });
                }
            }
            catch (xmlErrObj) {
                try {
                    reject({
                        'xmlis': 'invalid', 'validationError': {
                            'message': xmlErrObj.message,
                            'column': xmlErrObj.column,
                            'level': xmlErrObj.level,
                            'line': xmlErrObj.line
                        }
                    });
                }
                catch (e) {
                    reject({ 'xmlis': 'invalid', 'validationError': { 'message': 'xml is invalid' } });
                }
            }
        });
    },
    queryUsingXPath: function (filePath, queryString) {
        return new Promise(function (resolve, reject) {
            try {
                var temp = db.q[filePath];
                var myXMLDoc = temp.xmlDoc;
                var nodes = myXMLDoc.find(queryString)
                var returnXMLString = '';
                nodes.forEach(element => {
                    returnXMLString = element.toString();
                });
                if (returnXMLString == '') {
                    resolve({ 'filePath': filePath, 'absolutePath': '', 'exists': true, 'reason': 'XPath query using `' + queryString + '` returned nothing' });
                }
                else {
                    resolve(returnXMLString);
                }
            }
            catch (e) {
                reject({ 'filePath': filePath, 'absolutePath': '', 'exists': true, 'reason': 'Something went wrong when trying to query using given XPath. Please check if your query is valid' });
            }
        });
    }
}
                    /*var xmlString = '';
                    fs.createReadStream(pathObj.absolutePath, { encoding: 'utf8' })
                        .on('error', function (fileReadError) {
                            reject({ 'filePath': getObj.filePath, 'absolutePath': '', 'exists': true, 'reason': 'failed to read file', error: fileReadError });
                        })
                        .on('data', function (chunk) {
                            xmlString = xmlString + chunk;
                        })
                        .on('end', function () {
                            resolve(xmlString);
                        });
                        */
