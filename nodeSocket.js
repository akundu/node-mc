var net = require('net');
var util = require('util');

var clientMap = [];

function setupConnection(host, port, objToHandleRequest, timeout) {
    if(!objToHandleRequest || objToHandleRequest === undefined) {
        return null;
    }
    if(timeout === undefined) {
        timeout = -1;
    }


    var client = net.connect({host: host, port: 11211}, function() { //'connect' listener
        var nameToLookup = host + ':' + port;
        if (!(nameToLookup in clientMap)) {
            clientMap[nameToLookup] = [];
        }
        client.nameToLookup = nameToLookup;


        client.setNoDelay(true);
        if(timeout != -1) {
            client.setTimeout(timeout);
        }
        //console.log('client connected to ' + host + ':' + port);

        if(objToHandleRequest && objToHandleRequest.connect) {
            setupHandlers(client, objToHandleRequest);
            objToHandleRequest.connect(null, client, objToHandleRequest);
        }
        //client.write('world!\r\n');
    });

    client.on('error', function(error) {
        console.log(error);
        client.destroy();
        client = null;
        objToHandleRequest.connect(error, null, objToHandleRequest);
    });
}


function removeHandlers(client) {
    client.setTimeout(0);
    /*
     //we turn off the inactivity timeout in the case of releasing the connection back to the connection pool
    client.on('timeout', function() {
        client.destroy();
        client = null;
    });
    */

    client.on('data', function(data) {
        //shouldnt be receiving any data since no one is listening
        client.destroy();
        client = null;
    });

    client.on('end', function() {
        //shouldnt be receiving any data since no one is listening
        client.destroy();
        client = null;
    });


    client.on('error', function(error) {
        console.log(error);
        client.destroy();
        client = null;
    });

    client.on('close', function() {
        client = null;
    });
}


function setupHandlers(client, objToHandleRequest) {
    client.on('data', function(data) {
        //console.log('got some data' + data);
        objToHandleRequest.read(null, data, objToHandleRequest);
        //console.log(data.toString());
    });

    client.on('end', function() { //got fin packet
        //console.log('client gave end');
        client.destroy();
        client = null;

        if(objToHandleRequest && objToHandleRequest.close) {
            objToHandleRequest.close(this);
        }
    });

    client.on('timeout', function() {
        //console.log('client timedout');
        client.destroy();
        client = null;

        if(objToHandleRequest && objToHandleRequest.timeout) {
            objToHandleRequest.timeout(this);
        }
    });

    client.on('error', function(error) {
        //console.log('error from clietn');
        console.log(error);
        client.destroy();
        client = null;

        if(objToHandleRequest && objToHandleRequest.error) {
            objToHandleRequest.error(error, this);
        }
    });

    client.on('close', function() { //got close
        //console.log('client closed');
        client = null;

        if(objToHandleRequest && objToHandleRequest.close) {
            objToHandleRequest.close(this);
        }
    });
}

function releaseConnection(client, putInPool){
    if(putInPool === undefined) {
        putInPool = false;
    }

    if(putInPool) {
        if(client && client.nameToLookup ) {
            if(client.nameToLookup in clientMap) {
                removeHandlers(client);
                clientMap[client.nameToLookup].push(client);
                return;
            }
        }
    }

    client.destroy();
    client = null;
}

function getConnection(serverName, serverPort, objToHandleRequest){
    if(!serverName || serverName === undefined) {
        return null;
    }
    if(!serverPort || serverPort === undefined) {
        return null;
    }


    var nameToLookup = serverName + ':' + serverPort;
    if (!(nameToLookup in clientMap)) {
        clientMap[nameToLookup] = [];
    }

    var timeout = (objToHandleRequest.timeout && objToHandleRequest.timeout > -1 ? objToHandleRequest.timeout : -1);
    var client = null;
    if ((!(client = clientMap[nameToLookup].pop()))) {
        //console.log('setting up a new connection to ' + nameToLookup);
        setupConnection(serverName, serverPort, objToHandleRequest, timeout);
        return;
    }

    if(objToHandleRequest && objToHandleRequest.connect !== undefined) {
        setupHandlers(client, objToHandleRequest);
        objToHandleRequest.connect(client, objToHandleRequest);
    }
}

exports.getConnection = getConnection;
exports.releaseConnection = releaseConnection;
