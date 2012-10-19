var net = require('net');
var mc = require('./nodeMemcacheClient');


var d = new Date().toString();


//driver program
x = new mc('127.0.0.1', 11211);
x.set({key: "test1", flag: 5, expires: 2, value: d}, {putConnectionBackIntoPool: true}, function(error){
    if(error) {
        console.log('couldnt store key properly');
        console.log(error);
        return;
    }

    x.get(['test', 'test1'], {putConnectionBackIntoPool: false}, function(error, responseObj) {
        if(error) {
            console.log('got error ' + error);
            return;
        }
        console.log(responseObj);

        x.set({key: "test", flag: 5, expires: 2, value: d, noreply: true}, {putConnectionBackIntoPool: true}, function(error){
            if(error) {
                console.log('couldnt store key properly');
                return;
            }

            x.get(['test', 'test1'], {putConnectionBackIntoPool: false}, function(error, responseObj) {
                if(error) {
                    console.log('got error ' + error);
                    return;
                }
                console.log(responseObj);
            });
        });
    });
});
