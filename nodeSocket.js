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
        client.clientPort = client.address().port;


        client.setNoDelay(true);
        if(timeout != -1) {
            client.setTimeout(timeout);
        }

        if(objToHandleRequest && objToHandleRequest.connect) {
            setupHandlers(client, objToHandleRequest);
            objToHandleRequest.connect(null, client, objToHandleRequest);
        }
        //client.write('world!\r\n');
    });

    client.on('error', function(error) {
        //console.log('ON: error on connect ');
        console.log(error);
        client.destroy();
        client = null;
        objToHandleRequest.connect(error, null, objToHandleRequest);
    });
}


function removeFromConnectionPool(clientName, clientPort) {
    //iterate through the client map and find this instance
    var objArrOfName = clientMap[clientName];
    if(!objArrOfName) {
        return;
    }

    //iterate through the array to find this particular client
    for(var i = 0; i < objArrOfName.length; ++i){
        if(!objArrOfName[i] || objArrOfName[i] === undefined) {
            objArrOfName.splice(i, 1);
            continue;
        }

        //remove the client
        if(objArrOfName[i].address().port == clientPort){
            objArrOfName.splice(i, 1);
            return;
        }
    }
}

function removeHandlers(client) {
    //console.log('removing handler');
    if(!client) {
        //console.log('client is null');
        return;
    }
    client.removeAllListeners(); //remove all existing listeners

    client.setTimeout(0);

    var clientName = client.nameToLookup;
    var clientPort = client.clientPort;
    client.on('data', function(data) {
        //console.log('ON: data on removing handler');
        removeFromConnectionPool(clientName, clientPort);
        //shouldnt be receiving any data since no one is listening
        client.destroy();
        client = null;
    });

    client.on('end', function() {
        //console.log('ON: end on removing handler');
        removeFromConnectionPool(clientName, clientPort);
        //shouldnt be receiving any data since no one is listening
        client.destroy();
        client = null;
    });


    client.on('error', function(error) {
        //console.log('ON: error on removing handler');
        removeFromConnectionPool(clientName, clientPort);
        console.log(error);
        client.destroy();
        client = null;
    });

    client.on('close', function() {
        //console.log('ON: close on removing handler');
        removeFromConnectionPool(clientName, clientPort);
        client = null;
    });
}


function setupHandlers(client, objToHandleRequest) {
    if(!client) {
        return;
    }
    client.removeAllListeners(); //remove all existing listeners

    //console.log('setting up handlers');
    client.on('data', function(data) {
        //console.log('ON: data on setup handler');
        objToHandleRequest.read(null, data, objToHandleRequest);
    });

    client.on('end', function() { //got fin packet
        //console.log('ON: end on setup handler');
        client.destroy();
        client = null;

        if(objToHandleRequest && objToHandleRequest.close) {
            objToHandleRequest.close(objToHandleRequest);
        }
    });

    client.on('timeout', function() {
        //console.log('ON: timeout on setup handler');
        client.destroy();
        client = null;

        if(objToHandleRequest && objToHandleRequest.timeout) {
            objToHandleRequest.timeout(objToHandleRequest);
        }
    });

    client.on('error', function(error) {
        //console.log('ON: error on setup handler');
        console.log(error);
        client.destroy();
        client = null;

        if(objToHandleRequest && objToHandleRequest.error) {
            objToHandleRequest.error(error, objToHandleRequest);
        }
    });

    client.on('close', function() { //got close
        //console.log('ON: close on setup handler');
        client = null;

        if(objToHandleRequest && objToHandleRequest.close) {
            objToHandleRequest.close(objToHandleRequest);
        }
    });
}

function releaseConnection(client, putInPool){
    if(!client) {
        return;
    }

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
        //console.log('got new connection for ' + nameToLookup);
        setupConnection(serverName, serverPort, objToHandleRequest, timeout);
        return;
    }

    //console.log('served conn. from pool for ' + nameToLookup);
    if(objToHandleRequest && objToHandleRequest.connect !== undefined) {
        setupHandlers(client, objToHandleRequest);
        objToHandleRequest.connect(null, client, objToHandleRequest);
    }
}

exports.getConnection = getConnection;
exports.releaseConnection = releaseConnection;
