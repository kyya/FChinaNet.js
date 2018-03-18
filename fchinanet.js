const user = require('./user.json')
const fs = require('fs')
const http = require('http')
const request = require('superagent')

/**
 * 对应选项1 登录
 */
function login() {
  checkNet()
  loginChinaNet() // 更新status和LastIp
}

/**
 * 判断user.json中用户名密码是否加密
 * @returns bool
 */
function checkEncry() {
  let { account, passwd } = user
  if (account == "" || passwd == "") 
    return false

  // 解密用户名密码
  if (account.slice(-1) == "=") {
    account = new Buffer(account, 'base64').toString()
    passwd = new Buffer(passwd, 'base64').toString()
  } 
  // 加密用户名密码并写入JSON
  else {
    console.log("[*] 初次使用，使用base64加密用户名密码.")
    user.account = new Buffer(account).toString('base64')
    user.passwd = new Buffer(passwd).toString('base64')
    // TODO:错误处理
    fs.writeFileSync('./user.json', JSON.stringify(user, null, 2))
  }
  //console.log(account, passwd)
  return true
}

/**
 * 判断当前是否连接校园网
 * @return bool
 */
async function checkNet() {
  return await http
    .get("http://pre.f-young.cn/", res=>{
      const { statusCode } = res
      if (statusCode == 200) {
        console.log("[*] 检测到已接入校园网.")
        return Promise.resolve(true)
      }
      return Promise.resolve(false)
  })
}

/**
 * 初始化用户IP
 * @return void
 */
function initial() {
  request
    .get("http://test.f-young.cn")
    .then(response=>{
      const { statusCode } = response
      // console.log(statusCode)
      if (statusCode == 200) {
        // 已经登录成功的状态 redirects=[]
        if (response.redirects.length > 0) {
          const args = response.redirects[0].split('?')[1].split('&')
          const wanIp = args[0].split('=')[1]
          const brasIp = args[1].split('=')[1]
  
          user.wanIp = wanIp
          user.BrasIp = brasIp
          fs.writeFileSync('./user.json', JSON.stringify(user, null, 2))
          // console.log('[*] 成功获取wanIp和brasIp并写入文件.')
        }
      
      }
    })
}

/**
 * 校园网登录核心部分
 * @return bool
 */
function loginChinaNet() {
  let account = new Buffer(user.account, 'base64').toString()
  let passwd = new Buffer(user.passwd, 'base64').toString()
  // 获取json文件
  request
    .get("https://www.loocha.com.cn:8443/login")
    .auth(account, passwd) //TODO: 判断是否Unauthorized
    .then(response => {
      // console.log(JSON.stringify(response.body, null, 2))
      const res = JSON.parse(JSON.stringify(response.body))
      const serverId = res.user.did.split("#")[0]
      const id = res.user.id
      //console.log(serverId, id)
      // 获取serverId 和Id并保存
      user.serverId = serverId
      user.id = id
      fs.writeFileSync('./user.json', JSON.stringify(user, null, 2))
      // console.log('[*] 成功获取serverId和id并写入文件.')

      // 检测是否登录成功
      checkLogin()

      // 若设备没有登录，执行登录操作
      online()
    })
}

async function checkLogin() {
  //解密用户名密码
  let account = new Buffer(user.account, 'base64').toString()
  let passwd = new Buffer(user.passwd, 'base64').toString()

  return await request
    .get(`https://wifi.loocha.cn/${user.id}/wifi/status`)
    .auth(account, passwd) //TODO: 判断是否Unauthorized
    .then(response => {
      const res = JSON.parse(JSON.stringify(response.body, null, 2))
      let len = res.wifiOnlines.onlines.length
      console.log(`[*] 当前在线设备${len}个.`)
      for ({ wanIp } of res.wifiOnlines.onlines) {
        // 判断是否登录
        if (wanIp == user.lastIp) {
          return Promise.resolve(true)
        }
        // 保存上次登录ip
      }
      return Promise.resolve(false)
      
    })
}

/**
 * 对应选项2 下线
 * @param {String} ip 配置文件里的参数
 * @param {String} brasIp 配置文件里的参数
 */
function kickOffDevice(ip, brasIp) {

}

/**
 * 获取上网所需的动态密码
 * @return String
 */
async function getPasswd() {
  const id = user.id
  const serverId = user.serverId

  const account = new Buffer(user.account, 'base64').toString()
  const passwd = new Buffer(user.passwd, 'base64').toString()

  return await request
    .get(`https://wifi.loocha.cn/${id}/wifi?server_did=${serverId}`)
    .auth(account, passwd) //TODO: 判断是否Unauthorized
    .then(response => {
      const res = JSON.parse(JSON.stringify(response.body))
      const code = res.telecomWifiRes.password
      // TODO: 检验code长度是否为6位
      // console.log(`[*] 本次登录密码[${code}].`)
      return Promise.resolve(code)
    })
}

/**
 * 获取上线所需要的QRCode代码
 * @return String
 */
async function getQrCode() {
  let wanIp = user.wanIp
  let brasIp = user.BrasIp
  return await request
    .get(`https://wifi.loocha.cn/0/wifi/qrcode?brasip=${brasIp}&ulanip=${wanIp}&wlanip=${wanIp}`)
    .then(response=>{
      // console.log(response)
      const res = JSON.parse(JSON.stringify(response.body))
      // console.log(res)
      return Promise.resolve(res.telecomWifiRes.password)
    })
}

/**
 * 上线操作
 * @return void
 */
async function online() {
  //const user = require('./user.json')
  // 初始化
  console.log("[*] 开始初始化一些参数...")
  initial()
  // 写入JSON BrasIp
  // if (user.wanIp == "" || user.brasIp == "") 
  //   throw new Error("[*] 用户wanIP或brasIP为空值.")
  console.log("[*] 开始登录天翼客户端...")

  let code = await getPasswd()
  console.log(`[*] => 本次登录密码[${code}].`)

  let qrcode = await getQrCode()
  console.log(`[*] =>本次QRCode[${qrcode}].`)

  let GetRandomNum = function (min, max) {
    let range = max - min  
    let rand = Math.random()
    return (min + Math.round(rand * range))
  }

  let t = GetRandomNum(0, 9)

  let param = `qrcode=${qrcode}&code=${code}&type=${t}`
  let id = user.id
  const account = new Buffer(user.account, 'base64').toString()
  const passwd = new Buffer(user.passwd, 'base64').toString()

  request
    .post(`https://wifi.loocha.cn/${id}/wifi/enable?${param}`)
    .auth(account, passwd) //TODO: 判断是否Unauthorized
    .then(response=>{
      //const { statusCode } = response
      const res = JSON.parse(JSON.stringify(response.body))
      if (res.status== "993") {
        // 断网啦
        console.log(`[*] 服务器回应：${res.response}(断网啦...)`)
      }
      
    })
}

checkEncry()
loginChinaNet()