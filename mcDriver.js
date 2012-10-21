var net = require('net');
var memcache = require('./nodeMemcacheClient');


var d = new Date().toString();


//driver program
mc = new memcache('127.0.0.1', 11211);
console.log('setting test1');
mc.set({key: "test1", flag: 5, expires: 2, value: d}, {putConnectionBackIntoPool: true}, function(error){
    if(error) {
        console.log('couldnt store key properly');
        console.log(error);
        return;
    }

    console.log('getting test1');
    mc.get(['test', 'test1'], {putConnectionBackIntoPool: true}, function(error, responseObj) {
        if(error) {
            console.log('got error ' + error);
            return;
        }
        console.log(responseObj);


        console.log('setting test');
        mc.set({key: "test", flag: 5, expires: 2, value: d, noreply: true}, {putConnectionBackIntoPool: true}, function(error){
            if(error) {
                console.log('couldnt store key properly');
                return;
            }


            console.log('tetting test');
            mc.get(['test', 'test1'], {putConnectionBackIntoPool: true}, function(error, responseObj) {
                if(error) {
                    console.log('got error ' + error);
                    return;
                }
                console.log(responseObj);


                console.log('replacing an invalid key');
                mc.replace({key: "testcrap", flag: 5, expires: 2, value: "replaced value", noreply: true}, {putConnectionBackIntoPool: true}, function(error){
                    if(error) {
                        console.log('got error ' + error);
                        return;
                    }
                    console.log('shouldnt be able to replace key testcrap');



                    console.log('replacing a valid key');
                    mc.replace({key: "test", flag: 5, expires: 2, value: "replaced value", noreply: true}, {putConnectionBackIntoPool: false}, function(error){
                        if(error) {
                            console.log('got error ' + error);
                            return;
                        }
                        console.log('replaced key test');
                    });
                });
            });
        });
    });
});
