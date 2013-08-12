var http = require('http');
var https = require('https');
var url = require("url");
var querystring = require("querystring");
var crypto = require('crypto');

exports.create = function(options){
	return new QQSDK(options);
};

function QQSDK(options)
{
  var app = {};

  //配置
  var config = app.config = {
     debug:true
    ,appid:'12345'
    ,appkey:'12345'
    ,format:'json'
    ,host:null
    ,http_port:80
    ,https_port:443
  };

  if(options){//接受create方法传入的配置数据
    for(var ok in options){
      if(typeof(config[ok]) != 'undefined'){
        config[ok] = options[ok];
      }
    }
  }
  
  if(!config.host)config.host = config.debug ? '119.147.19.43' : 'openapi.tencentyun.com';

  /**
   * SDK通用错误码定义
   */
  var OPENAPI_ERROR_REQUIRED_PARAMETER_EMPTY = 1801; // 参数为空
  var OPENAPI_ERROR_REQUIRED_PARAMETER_INVALID = 1802; // 参数格式错误
  var OPENAPI_ERROR_RESPONSE_DATA_INVALID = 1803; // 返回包格式错误
  var OPENAPI_ERROR_CURL = 1900; // 网络错误, 偏移量1900, 详见 http://curl.haxx.se/libcurl/c/libcurl-errors.html

  /**
  * 调用api
  *@param cb:回调function，调用参数就是api接口返回的json object
  *@param uri:api的路径，如：/v3/user/is_login
  *@param method:get/post
  *@param protocol:http/https
  */
  app.api = function(cb,uri,params,method,protocol) {
    if(!params)params = {};
    if(!uri)uri = '/';
    if(!method)method = 'GET';
    method = method.toUpperCase();
    if(!protocol)protocol = 'http';

    if(typeof params.openid == 'undefined'){cb({ret:OPENAPI_ERROR_REQUIRED_PARAMETER_EMPTY,msg:'openid is empty'});return;}
    if(typeof params.openkey == 'undefined'){cb({ret:OPENAPI_ERROR_REQUIRED_PARAMETER_EMPTY,msg:'openkey is empty'});return;}
    if(!is_openid(params.openid)){cb({ret:OPENAPI_ERROR_REQUIRED_PARAMETER_INVALID,msg:'openid is invalid'});return;}
    
    // 无需传sig, 会自动生成
    delete params.sig;

    // 添加一些参数
    params.appid = config.appid;
    params.format = config.format;

    // 生成签名
    params.sig = make_sig(method, uri, params, config.appkey + '&');
    
    var query_string = querystring.stringify(params);

    var req_path = uri;
    if(method == 'GET'){
      req_path += '?' + query_string;
    }
    var req_options = {
      hostname: config.host
      ,port: (protocol == 'https') ? config.https_port : config.http_port
      ,path: req_path
      ,method: method
      ,headers:{}
    };

    if(method == 'POST')
    {
       req_options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
       req_options.headers['Content-Length'] = Buffer.byteLength(query_string);
    }
    if(protocol == 'https')req_options.rejectUnauthorized = false;

    function request_callback(res) {
      //console.log('STATUS: ' + res.statusCode);
      //console.log('HEADERS: ' + JSON.stringify(res.headers));
      if(res.statusCode != 200){
        cb({ret:OPENAPI_ERROR_CURL,msg:'res.statusCode:' + res.statusCode});
        return;
      }
      res.setEncoding('utf8');
      var body = '';
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        if(config.debug)console.log('[qqsdk]api return:',body);
        var retobj;
        try{
          retobj = JSON.parse(body); 
        }catch(e){
          cb({ret:OPENAPI_ERROR_RESPONSE_DATA_INVALID,msg:'json decode error:' + e.message});
          return;
        }
         if(retobj)
           cb(retobj);
         else 
           cb({ret:OPENAPI_ERROR_RESPONSE_DATA_INVALID,msg:'json decode error'});
      });
    }

    if(config.debug)console.log('[qqsdk]protocol:'+protocol,';req_options:' + JSON.stringify(req_options,null,2));

    var req = (protocol == 'https') ? https.request(req_options, request_callback) : http.request(req_options, request_callback);

    req.on('error', function(e) {
      console.error('[qqsdk]problem with request,url='+ req_path +':\n' + e.message);
      cb({ret:OPENAPI_ERROR_CURL,msg:'request error:' + e.message});
    });
    if(method == 'POST')req.write(query_string);
    req.end();
  }

  /**
	 * 验证回调发货URL的签名 (注意和普通的OpenAPI签名算法不一样，详见@refer的说明)
     *
	 * @param string 	$method 请求方法 "get" or "post"
	 * @param string 	$url_path 
	 * @param array 	$params 腾讯调用发货回调URL携带的请求参数
	 * @param string 	$secret 密钥
     * @param string 	$sig 腾讯调用发货回调URL时传递的签名
	 *
     * @refer 
     *  http://wiki.open.qq.com/wiki/%E5%9B%9E%E8%B0%83%E5%8F%91%E8%B4%A7URL%E7%9A%84%E5%8D%8F%E8%AE%AE%E8%AF%B4%E6%98%8E_V3
	*/
  app.verify_sig = function(method, uri, params, secret, sig) 
  {
      delete params.sig;
      // 先使用专用的编码规则对value编码
      for(var k in params){
        params[k] = encode_value(params[k]);
      }
      // 再计算签名
      return make_sig(method, uri, params, secret) == decodeURI(sig);
  }
    
	/**
	 * 回调发货URL专用的编码算法
	 *  编码规则为：除了 0~9 a~z A~Z !*()之外其他字符按其ASCII码的十六进制加%进行表示，例如"-"编码为"%2D"
     * @refer 
     *  http://wiki.open.qq.com/wiki/%E5%9B%9E%E8%B0%83%E5%8F%91%E8%B4%A7URL%E7%9A%84%E5%8D%8F%E8%AE%AE%E8%AF%B4%E6%98%8E_V3
	*/
  function encode_value(value) 
  {
      var rst = '';
      var len = value.length;
      for (var i=0; i<len; i++){
          var c = value[i];
          if (/[a-zA-Z0-9!\(\)*]{1,1}/.test(c)){
             rst += c;
          }
          else{
              rst += ("%" + ('00' + c.charCodeAt(0).toString('16').toUpperCase()).substr(-2)); 
          }
      }
      return rst;
  } 

  function is_openid(openid)
  {
    return /^[0-9a-fA-F]{32}$/.test(openid);
  }

  function stringify_ksort(params)
  {
    var qkeys = [];
    for(var k in params){
      qkeys.push(k);
    }
    qkeys.sort();
    var query_string = '';
    for (var i = 0; i < qkeys.length; i++) {
      if(query_string.length>0)query_string += '&';
      query_string += qkeys[i] + '=' + params[qkeys[i]];
    }
    return query_string;
  }
  
  function make_sig(method,uri,params,secret)
  {
    var strs = method.toUpperCase() + '&' + urlencode(uri) + '&';
    var src = strs + urlencode(stringify_ksort(params)).replace(/~/g,'%7E');

    secret = secret.replace(/\-/g,'+');
    secret = secret.replace(/\_/g,'?');

    var hmac = crypto.createHmac('sha1', secret);
    hmac.update(src);
    return hmac.digest('base64');
  }

  function urlencode(url)
  {
      return encodeURIComponent(url).replace(/!/g,'%21').replace(/\'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29').replace(/\*/g,'%2A');
  }

  return app;
}