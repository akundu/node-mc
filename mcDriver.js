var net = require('net');
var memcache = require('./nodeMemcacheClient');


var d = new Date().toString();


//driver program
mc = new memcache('127.0.0.1', 11211);
console.log('setting test1');
mc.set({key: "test1", flag: 5, expires: 10, value: d}, {putConnectionBackIntoPool: true}, function(error){
    if(error) {
        console.log('couldnt store key properly');
        console.log(error);
        return;
    }

    console.log('\n\ngetting test1');
    mc.get(['test', 'test1'], {putConnectionBackIntoPool: true}, function(error, responseObj) {
        if(error) {
            console.log('got error ' + error);
            return;
        }
        console.log(responseObj);


        console.log('\n\nsetting test');
        mc.set({key: "test", flag: 5, expires: 10, value: d, noreply: true}, {putConnectionBackIntoPool: true}, function(error){
            if(error) {
                console.log('couldnt store key properly');
                return;
            }


            console.log('\n\ntetting test');
            mc.get(['test', 'test1'], {putConnectionBackIntoPool: true}, function(error, responseObj) {
                if(error) {
                    console.log('got error ' + error);
                    return;
                }
                console.log(responseObj);


                console.log('\n\nreplacing an invalid key');
                mc.replace({key: "testcrap", flag: 5, expires: 10, value: "replaced value", noreply: true}, {putConnectionBackIntoPool: true}, function(error){
                    if(error) {
                        console.log('got error ' + error);
                        return;
                    }
                    console.log('shouldnt be able to replace key testcrap');



                    console.log('\n\nreplacing a valid key');
                    mc.replace({key: "test", flag: 5, expires: 10, value: "replaced value", noreply: true}, {putConnectionBackIntoPool: true}, function(error){
                        if(error) {
                            console.log('got error ' + error);
                            return;
                        }
                        console.log('replaced key test');



                        console.log('\n\ndeleting key test');
                        mc.del({key: "test"}, {putConnectionBackIntoPool: true}, function(error){
                            if(error){
                                console.log('got error on delete ' + error);
                                return;
                            }


                            console.log('\n\ngetting test');
                            mc.get(['test'], {putConnectionBackIntoPool: false}, function(error, responseObj) {
                                if(error){
                                    console.log('got error on delete ' + error);
                                    return;
                                }
                                console.log(responseObj);
                            });
                        });

                    });
                });
            });
        });
    });
});
