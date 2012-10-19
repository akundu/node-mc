var net = require('net');
var mc = require('./nodeMemcacheClient');


//driver program
function prefixTimeString(info) {
    if(info < 10)
        return "0" + info;
    return info;
}

function convertTime(time) {
    var a = null;
    if(!time || time === undefined){
        a = new Date();
    }
    else {
        a = new Date(time*1000); //have to insert the time in ms //borrowed from http://stackoverflow.com/questions/847185/convert-a-unix-timestamp-to-time-in-javascript
    }

    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getUTCFullYear();
    var month = months[a.getUTCMonth()];
    var date = prefixTimeString(a.getUTCDate());
    var hour = prefixTimeString(a.getUTCHours());
    var min = prefixTimeString(a.getUTCMinutes());
    var sec = prefixTimeString(a.getUTCSeconds());
    var time = date+' '+month+' '+year+' '+hour+':'+min+':'+sec ;
    return time;
}

var d = convertTime();
x = new mc('127.0.0.1', 11211);
x.set({key: "test1", flag: 5, expires: 10, value: d}, {putConnectionBackIntoPool: true}, function(){
    x.get(['test', 'test1'], {putConnectionBackIntoPool: false}, function(error, responseObj) {
        if(error) {
            console.log('got error ' + error);
            return;
        }
        console.log(responseObj);
    });
});
