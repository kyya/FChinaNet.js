#! /usr/bin/node

const user = require('./user.json')
const fs = require('fs')
const http = require('http')
const request = require('superagent')
const colors = require('colors')
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
  if (account == "" || passwd == "") {
    console.error("[*] 请在user.json中填入account和passwd!")
    return false
  }
    

  // 解密用户名密码
  // 判断是否为base64字符串
  if (account.slice(-1) == "=") {
    // account = new Buffer(account, 'base64').toString()
    // passwd = new Buffer(passwd, 'base64').toString()
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
      if (statusCode == 200) {
        // 已经登录成功的状态 redirects=[]
        if (response.redirects.length > 0) {
          const args = response.redirects[0].split('?')[1].split('&')
          const wan_ip = args[0].split('=')[1]
          const bras_ip = args[1].split('=')[1]
  
          user.wan_ip = wan_ip
          user.bras_ip = bras_ip
          fs.writeFileSync('./user.json', JSON.stringify(user, null, 2))
          // console.log('[*] 成功获取wan_ip和bras_ip并写入文件.')
        }
      
      }
    })
}

/**
 * 校园网登录核心部分
 * @return bool
 */
async function loginChinaNet() {
  let account = new Buffer(user.account, 'base64').toString()
  let passwd = new Buffer(user.passwd, 'base64').toString()
  // 获取json文件
  request
    .get("https://www.loocha.com.cn:8443/login")
    .auth(account, passwd) //TODO: 判断是否Unauthorized
    .then(response => {
      // console.log(JSON.stringify(response.body, null, 2))
      const res = JSON.parse(JSON.stringify(response.body))
      const server_id = res.user.did.split("#")[0]
      const id = res.user.id
      // 获取server_id 和Id并保存
      user.server_id = server_id
      user.id = id
      fs.writeFileSync('./user.json', JSON.stringify(user, null, 2))

      
      // 若设备没有登录，执行登录操作
      online().then(
        res=>console.log(res),
        err=>console.log(err)
      )
      //checkLogin()

    })
}
/**
 * 检测当前设备是否已经登录
 * @return void
 */
function checkLogin() {
  //解密用户名密码
  let account = new Buffer(user.account, 'base64').toString()
  let passwd = new Buffer(user.passwd, 'base64').toString()

  request
    .get(`https://wifi.loocha.cn/${user.id}/wifi/status`)
    .auth(account, passwd)
    .then(response => {
      const res = JSON.parse(JSON.stringify(response.body))
      let len = res.wifiOnlines.onlines.length
      console.log(`[*] 当前在线设备${len}个.`)
      // console.log(res.wifiOnlines.onlines)
      for ({ wanIp:wan_ip } of res.wifiOnlines.onlines) {
        if (wan_ip == user.last_ip) {
          console.log("[*] 当前设备在线...")
          return
        }
      }
      console.log("[!] 当前设备不在线...")
    })
}

/**
 * 对应选项2 下线
 * @return {Bool} 返回操作结果
 */
function kickOffDevice() {
  console.log("[*] 正在下线设备中...")
  let account = new Buffer(user.account, 'base64').toString()
  let passwd = new Buffer(user.passwd, 'base64').toString()
  const id = user.id
  const wan_ip = user.wan_ip
  const bras_ip = user.bras_ip

  request
    .del(`https://wifi.loocha.cn/${id}/wifi/kickoff?wanip=${wan_ip}&brasip=${bras_ip}`)
    .auth(account, passwd)
    .then(response=>{
      const { statusCode } = response
      if (statusCode == 200) {
        console.log("[*] 下线成功...")
      } else {
        console.log(colors.red("[!] 下线失败..."))
      }
    })
}

/**
 * 获取上网所需的动态密码
 * @return String
 */
function getPasswd() {
  const id = user.id
  const server_id = user.server_id

  const account = new Buffer(user.account, 'base64').toString()
  const passwd = new Buffer(user.passwd, 'base64').toString()

  return new Promise(resolve=>{
    request
      .get(`https://wifi.loocha.cn/${id}/wifi?server_did=${server_id}`)
      .auth(account, passwd) //TODO: 判断是否Unauthorized
      .then(response => {
        const res = JSON.parse(JSON.stringify(response.body))
        const code = res.telecomWifiRes.password
        // TODO: 检验code长度是否为6位
        resolve(code)
      })
  })

}

/**
 * 获取上线所需要的QRCode代码
 * @return String
 */
function getQrCode() {
  let wan_ip = user.wan_ip
  let bras_ip = user.bras_ip
  return new Promise(resolve=>{
    request
      .get(`https://wifi.loocha.cn/0/wifi/qrcode?brasip=${bras_ip}&ulanip=${wan_ip}&wlanip=${wan_ip}`)
      .then(response=>{
        // console.log(response)
        const res = JSON.parse(JSON.stringify(response.body))
        // console.log(res)
        resolve(res.telecomWifiRes.password)
      })
      //.catch(err=>reject(err))
  })
  
}

/**
 * 上线操作
 * @return void
 */
async function online() {

  console.log("[*] 开始初始化一些参数...")

  initial()

  console.log("[*] 开始登录天翼客户端...")

  const code = await getPasswd()
  console.log(`[*] => 本次登录密码[${code}].`)

  const qrcode = await getQrCode()
  console.log(`[*] => 本次QRCode[${qrcode}].`)

  const param = `qrcode=${qrcode}&code=${code}&type=1`
  const id = user.id
  const account = new Buffer(user.account, 'base64').toString()
  const passwd = new Buffer(user.passwd, 'base64').toString()

  return new Promise((resolve, reject)=>{
    request
      .post(`https://wifi.loocha.cn/${id}/wifi/enable?${param}`)
      .auth(account, passwd) //TODO: 判断是否Unauthorized
      .then(response=>{
        //const { statusCode } = response
        const res = JSON.parse(JSON.stringify(response.body))
        //console.log(res)
        if (res.status == "0") {
          resolve(`[*] 服务器回应：${res.response} [登录成功...]`)
        }
        else if (res.status == "993") {
          // 断网啦
          reject(colors.red(`[!] ${res.response}`))
        }
      })
  })
 
}


//checkEncry()

loginChinaNet()

//kickOffDevice()
checkLogin()
