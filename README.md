qqsdk
=====

nodejs版本的腾讯开放平台SDK的实现

安装：`npm install qqsdk`

请支持下我们的游戏，谢谢：http://rc.qzone.qq.com/100729832

example

```javascript
var qqsdk = require('./');

/*
api调用地址说明：debug模式使用：'119.147.19.43' ，非dbug模式使用： 'openapi.tencentyun.com'
*/
var sdk = qqsdk.create({appid:'12345',appkey:'12344',debug:true});
sdk.api(function(rv){
  console.log(rv);
},'/v3/user/get_info',{openid:'123',openkey:'3445',pf:'qzone'});

```