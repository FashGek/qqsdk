var qqsdk = require('./');

/*
api���õ�ַ˵����debugģʽʹ�ã�'119.147.19.43' ����dbugģʽʹ�ã� 'openapi.tencentyun.com'
*/
var sdk = qqsdk.create({appid:'12345',appkey:'12344',debug:true});
sdk.api(function(rv){
  console.log(rv);
},'/v3/user/get_info',{openid:'123',openkey:'3445',pf:'qzone'});
