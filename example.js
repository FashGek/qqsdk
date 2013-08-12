var qqsdk = require('./');

/*
api调用地址说明：debug模式使用：'119.147.19.43' ，非dbug模式使用： 'openapi.tencentyun.com'
*/
var sdk = qqsdk.create({appid:'12345',appkey:'12344',debug:true});
sdk.api(function(rv){
  console.log(rv);
},'/v3/user/get_info',{openid:'123',openkey:'3445',pf:'qzone'});
