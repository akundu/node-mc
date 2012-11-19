var net = require('net');
var ns = require('./nodeSocket');

const DEFAULT_MC_HOST = '127.0.0.1';
const DEFAULT_MC_PORT = 11211;


//public functions
function MemcacheClient(server, port) {
    if(!server || server === undefined){
        server = DEFAULT_MC_HOST;
    }
    if(!port || port === undefined){
        port = DEFAULT_MC_PORT;
    }

    this.server = server;
    this.port = port;
}

//retrieve commands
//Provide an input of array of keys to fetch along w/ callback to call after fetch is complete
MemcacheClient.prototype.get = function(keys, options, callback) {
    var objToHandleRequest = {}
    this.defaultSetup(objToHandleRequest, options, callback);

    objToHandleRequest.connect = this.makeGetRequest.bind(this);
    objToHandleRequest.keys = keys;
    objToHandleRequest.response = [];
    objToHandleRequest.state = READING_META_DATA;

    ns.getConnection(this.server, this.port, objToHandleRequest);
}


//set commands
MemcacheClient.prototype.set = function(keyObj, options, callback) {
    var objToHandleRequest = {}
    objToHandleRequest.connect = this.makeSetRequest.bind(this);
    this.setDefaultSetup(keyObj, objToHandleRequest, options, callback);
}

MemcacheClient.prototype.add = function(keyObj, options, callback) {
    var objToHandleRequest = {}
    objToHandleRequest.connect = this.makeAddRequest.bind(this);
    this.setDefaultSetup(keyObj, objToHandleRequest, options, callback);
}

MemcacheClient.prototype.replace = function(keyObj, options, callback) {
    var objToHandleRequest = {}
    objToHandleRequest.connect = this.makeReplaceRequest.bind(this);
    this.setDefaultSetup(keyObj, objToHandleRequest, options, callback);
}

MemcacheClient.prototype.append = function(keyObj, options, callback) {
    var objToHandleRequest = {}
    objToHandleRequest.connect = this.makeAppendRequest.bind(this);
    this.setDefaultSetup(keyObj, objToHandleRequest, options, callback);
}

MemcacheClient.prototype.prepend = function(keyObj, options, callback) {
    var objToHandleRequest = {}
    objToHandleRequest.connect = this.makePrependRequest.bind(this);
    this.setDefaultSetup(keyObj, objToHandleRequest, options, callback);
}


MemcacheClient.prototype.del = function(keyObj, options, callback) {
    var objToHandleRequest = {}
    objToHandleRequest.connect = this.makeDeleteRequest.bind(this);

    this.defaultSetup(objToHandleRequest, options, callback);
    objToHandleRequest.keyObj = keyObj;

    if(!(keyObj.noreply !== undefined && !keyObj.noreply)) {
        objToHandleRequest.state = READING_META_DATA;
    }

    ns.getConnection(this.server, this.port, objToHandleRequest);
}




//private functions
MemcacheClient.prototype.makeGetRequest = function(error, client, objToHandleRequest) {
    if(error) {
        console.log(error);
        objToHandleRequest.user_callback(error);
        return;
    }

    objToHandleRequest.client = client;

    //write the request for get
    var request = 'get ' + objToHandleRequest.keys.join(' ') + '\r\n';
    client.write(request, 'binary', function(){});
}

const READING_META_DATA = 1;
const READING_VALUE = 2;
MemcacheClient.prototype.parseResponse = function(error, data, objToHandleRequest) {
    //console.log('got to parseResponse with data ' + data);
    if(error) {
        console.log(error);
        objToHandleRequest.user_callback(error);
        return;
    }

    objToHandleRequest.complete_response += data;


    while(objToHandleRequest.complete_response.length) {
        if(objToHandleRequest.state === READING_META_DATA){
            var endOfMetaData = objToHandleRequest.complete_response.indexOf('\r\n');

            if(endOfMetaData != -1) {
                var response_line = objToHandleRequest.complete_response.substr(0, endOfMetaData);
                var meta_data_split = response_line.split(' ');

                //found VALUE
                if(meta_data_split[0] === "VALUE" && meta_data_split.length == 4) {
                    var result = {};
                    result.key = meta_data_split[1];
                    result.flag = parseInt(meta_data_split[2]);
                    result.length = parseInt(meta_data_split[3]);

                    objToHandleRequest.response.push(result);
                    objToHandleRequest.complete_response = objToHandleRequest.complete_response.substr(endOfMetaData+2/*the \r\n at the end of the meta data section*/); //advance past the meta data section
                    objToHandleRequest.state = READING_VALUE;
                }
                else if(meta_data_split[0] === "END") {
                    ns.releaseConnection(objToHandleRequest.client, objToHandleRequest.putConnectionBackIntoPool);
                    objToHandleRequest.user_callback(null, objToHandleRequest.response);
                    return;
                }
                else if(meta_data_split[0] === "STORED") {
                    ns.releaseConnection(objToHandleRequest.client, objToHandleRequest.putConnectionBackIntoPool);
                    objToHandleRequest.user_callback(null);
                    return;
                }
                else if(meta_data_split[0] === "DELETED") {
                    ns.releaseConnection(objToHandleRequest.client, objToHandleRequest.putConnectionBackIntoPool);
                    objToHandleRequest.user_callback(null);
                    return;
                }
                else {
                    //see if there were any errors
                    var reExp = /ERROR/i;
                    if(reExp.test(objToHandleRequest.complete_response)){
                        ns.releaseConnection(objToHandleRequest.client, false);
                    }
                    else {
                        ns.releaseConnection(objToHandleRequest.client, objToHandleRequest.putConnectionBackIntoPool);
                    }
                    objToHandleRequest.user_callback(new Error('error on response: with response = ' + objToHandleRequest.complete_response));
                    return;
                }
            }
            else {
                return;
            }
        }
        if(objToHandleRequest.state === READING_VALUE){
            var resultObj = objToHandleRequest.response[objToHandleRequest.response.length-1]; //pick the last element on the array - cause thats the one thats getting filled up

            if(objToHandleRequest.complete_response.length < (resultObj.length + 2 /*for \r\n*/)) { //more to read
                return;
            }

            resultObj.value = objToHandleRequest.complete_response.substr(0, resultObj.length);

            var amtToRemove = resultObj.length + 2/*include the \r\n after the response*/;
            objToHandleRequest.complete_response = objToHandleRequest.complete_response.substr(amtToRemove);

            objToHandleRequest.state = READING_META_DATA;
        }
    }
}



MemcacheClient.prototype.setDefaultSetup = function(keyObj, objToHandleRequest, options, callback) {
    this.defaultSetup(objToHandleRequest, options, callback);

    objToHandleRequest.keyObj = keyObj;

    if(!(keyObj.noreply !== undefined && !keyObj.noreply)) {
        objToHandleRequest.state = READING_META_DATA;
    }

    ns.getConnection(this.server, this.port, objToHandleRequest);
}

const DELETE_COMMAND = 'delete';
MemcacheClient.prototype.makeDeleteRequest = function(error, client, objToHandleRequest, command) {
    if(error) {
        objToHandleRequest.user_callback(error);
        return null;
    }

    var keyObj = objToHandleRequest.keyObj;
    //console.log('request = ' + request);
    objToHandleRequest.client = client;

    var request = DELETE_COMMAND + ' ' + 
                  keyObj.key + ' ' + 
                  (keyObj.noreply === undefined || !keyObj.noreply ? '' : ' noreply') + 
                  '\r\n'  ;

    client.write(request, 'binary', function(){
        //since we're not going to get a DELETED response here - we should release the connection back to the pool
        if(keyObj.noreply !== undefined && keyObj.noreply) {
            ns.releaseConnection(objToHandleRequest.client, objToHandleRequest.putConnectionBackIntoPool);
            objToHandleRequest.user_callback(null);
        }
    });
    return;
}

MemcacheClient.prototype.fillSetTypeRequests = function(error, client, objToHandleRequest, command) {
    if(error) {
        objToHandleRequest.user_callback(error);
        return null;
    }

    var keyObj = objToHandleRequest.keyObj;
    //console.log('request = ' + request);
    objToHandleRequest.client = client;

    var request = command + ' ' + 
                  keyObj.key + ' ' + 
                  keyObj.flag + ' ' + 
                  keyObj.expires + ' ' + 
                  keyObj.value.length + 
                  (keyObj.noreply === undefined || !keyObj.noreply ? '' : ' noreply') + 
                  '\r\n' + 
                  keyObj.value + 
                  '\r\n';

    client.write(request, 'binary', function(){
        //since we're not going to get a STORED response here - we should release the connection back to the pool
        if(keyObj.noreply !== undefined && keyObj.noreply) {
            ns.releaseConnection(objToHandleRequest.client, objToHandleRequest.putConnectionBackIntoPool);
            objToHandleRequest.user_callback(null);
        }
    });
    return;
}


const SET_COMMAND = 'set';
MemcacheClient.prototype.makeSetRequest = function(error, client, objToHandleRequest) {
    return this.fillSetTypeRequests(error, client, objToHandleRequest, SET_COMMAND);
}

const ADD_COMMAND = 'add';
MemcacheClient.prototype.makeAddRequest = function(error, client, objToHandleRequest) {
    return this.fillSetTypeRequests(error, client, objToHandleRequest, ADD_COMMAND);
}

const REPLACE_COMMAND = 'replace';
MemcacheClient.prototype.makeReplaceRequest = function(error, client, objToHandleRequest) {
    return this.fillSetTypeRequests(error, client, objToHandleRequest, REPLACE_COMMAND);
}

const APPEND_COMMAND = 'append';
MemcacheClient.prototype.makeAppendRequest = function(error, client, objToHandleRequest) {
    return this.fillSetTypeRequests(error, client, objToHandleRequest, APPEND_COMMAND);
}

const PREPEND_COMMAND = 'prepend'
MemcacheClient.prototype.makePrependRequest = function(error, client, objToHandleRequest) {
    return this.fillSetTypeRequests(error, client, objToHandleRequest, PREPEND_COMMAND);
}



MemcacheClient.prototype.close = function(objToHandleRequest) {
    if(objToHandleRequest && objToHandleRequest.user_callback) {
        objToHandleRequest.user_callback(new Error("Server closed"));
    }
}

MemcacheClient.prototype.timeout = function(objToHandleRequest) {
    if(objToHandleRequest && objToHandleRequest.user_callback) {
        objToHandleRequest.user_callback(new Error("Server timedout"));
    }
}

MemcacheClient.prototype.error = function(error, objToHandleRequest) {
    if(objToHandleRequest && objToHandleRequest.user_callback) {
        objToHandleRequest.user_callback(error);
    }
}

MemcacheClient.prototype.defaultSetup = function(objToHandleRequest, options, callback) {
    objToHandleRequest.close = this.close.bind(this);
    objToHandleRequest.timeout = this.timeout.bind(this);
    objToHandleRequest.error = this.error.bind(this);
    if(options && options.putConnectionBackIntoPool !== undefined) {
        objToHandleRequest.putConnectionBackIntoPool = options.putConnectionBackIntoPool;
    }
    else {
        objToHandleRequest.putConnectionBackIntoPool = true;
    }

    if(options && options.timeout !== undefined) {
        objToHandleRequest.timeout = options.timeout;
    }
    else {
        objToHandleRequest.timeout = -1;
    }

    objToHandleRequest.user_callback = callback;
    objToHandleRequest.complete_response = '';
    objToHandleRequest.read = this.parseResponse.bind(this);
}




module.exports = MemcacheClient;
