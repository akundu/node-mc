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

MemcacheClient.prototype.set = function(keyObj, options, callback) {
    var objToHandleRequest = {}
    this.defaultSetup(objToHandleRequest, options, callback);

    objToHandleRequest.connect = this.makeSetRequest;
    objToHandleRequest.keyObj = keyObj;

    if(!(keyObj.noreply !== undefined && !keyObj.noreply)) {
        objToHandleRequest.state = READING_META_DATA;
    }

    ns.getConnection(this.server, this.port, objToHandleRequest);
}

//Provide an input of array of keys to fetch along w/ callback to call after fetch is complete
MemcacheClient.prototype.get = function(keys, options, callback) {
    var objToHandleRequest = {}
    this.defaultSetup(objToHandleRequest, options, callback);

    objToHandleRequest.connect = this.makeGetRequest;
    objToHandleRequest.keys = keys;
    objToHandleRequest.response = [];
    objToHandleRequest.state = READING_META_DATA;

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
                else {
                    ns.releaseConnection(objToHandleRequest.client, false);
                    objToHandleRequest.user_callback(new Error('invalid syntax on response: with response = ' + objToHandleRequest.complete_response));
                    return;
                }
            }
            else {
                return;
            }
        }
        if(objToHandleRequest.state === READING_VALUE){
            var resultObj = objToHandleRequest.response[objToHandleRequest.response.length-1]; //pick the last element on the array - cause thats the one thats getting filled up

            if(objToHandleRequest.complete_response < (resultObj.length + 2 /*for \r\n*/)) { //more to read
                return;
            }

            resultObj.value = objToHandleRequest.complete_response.substr(0, resultObj.length);

            var amtToRemove = resultObj.length + 2/*include the \r\n after the response*/;
            objToHandleRequest.complete_response = objToHandleRequest.complete_response.substr(amtToRemove);

            objToHandleRequest.state = READING_META_DATA;
        }
    }
}

MemcacheClient.prototype.makeSetRequest = function(error, client, objToHandleRequest) {
    if(error) {
        objToHandleRequest.user_callback(error);
        return;
    }

    //write the request for set
    var keyObj = objToHandleRequest.keyObj;
    var request = 'set ' + 
                  keyObj.key + ' ' + 
                  keyObj.flag + ' ' + 
                  keyObj.expires + ' ' + 
                  keyObj.value.length + 
                  (keyObj.noreply === undefined || !keyObj.noreply ? '' : ' noreply') + 
                  '\r\n' + 
                  keyObj.value + 
                  '\r\n';
    //console.log('request = ' + request);
    objToHandleRequest.client = client;

    client.write(request, 'binary', function(){
        //since we're not going to get a STORED response here - we should release the connection back to the pool
        if(keyObj.noreply !== undefined && keyObj.noreply) {
            ns.releaseConnection(objToHandleRequest.client, objToHandleRequest.putConnectionBackIntoPool);
            objToHandleRequest.user_callback(null);
        }
    });
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
    objToHandleRequest.close = this.close;
    objToHandleRequest.timeout = this.timeout;
    objToHandleRequest.error = this.error;
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
    objToHandleRequest.read = this.parseResponse;
}


module.exports = MemcacheClient;
