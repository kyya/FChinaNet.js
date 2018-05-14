const fs = require('fs')
const fetch = require('node-fetch')
const crypto = require('crypto')
const qs = require('querystring')

/**
 * 保存配置到本地文件
 * @return {void}
 */
async function saveConfig() {
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2))
}

/**
 * 输出当前在线设备数量
 * @return {void}
 */
async function checkLogin() {
  const headers = { "Authorization": `Basic ${config.auth}`}
  return await fetch(`https://wifi.loocha.cn/${config.user_id}/wifi/status`, {headers})
    .then(res=>res.ok?res.json():"401 Unauthorized")
    .then(json=>{
      let len = json.wifiOnlines.onlines.length
      console.log(`[*] 当前在线设备${len}个.`)
    })
}

/**
 * 对应选项2 下线
 * @return {void}
 */
async function kickOffDevice() {
  const headers = { Authorization: `Basic ${config.auth}` }
  const user_id = config.user_id
  const wan_ip = config.wan_ip
  const bras_ip = config.bras_ip

  console.log("[*] 正在下线设备中...")
  
  return await fetch(`https://wifi.loocha.cn/${user_id}/wifi/kickoff?1=${config.app_version}&wanip=${wan_ip}&brasip=${bras_ip}`, {
    method: "DELETE",
    headers
  }).then(res=>{
      if (res.ok) {
        console.log("[*] 下线成功...")
      } else {
        console.log("[!] 下线失败...")
      }
    })
}

/**
 * 获取 APP_VERSION
 * @return {String}
 */
async function getAppVersion() {
  if (config.app_version != undefined || config.app_version != "") 
    return config.app_version
  return await fetch(`http://pre.f-young.cn/js/conf.js`)
    .then(res=>res.text())
    .then(body=>{
      // console.log(body)
      let version = body.match(/LoochaCollege-([0-9].[0-9].[0-9])-[0-9].+\.apk/)[1]
      config.app_version = `Android_colleage_${version}`
      console.log(`[*] => 缓存 APP_VERSION=[${app_version}]`)
      return config.app_version
    })
}

/**
 * 获取用户ID
 * @return {String}
 */
async function getUserId() {
  if (config.user_id != undefined && config.user_id != "")
    return config.user_id
  
  const AUTH = Buffer.from(`${config.account}:${config.passwd}`).toString('base64')
  config.auth = AUTH
  // delete config.passwd
  console.log(`[*] => 密码字段进化为 AUTH=[${AUTH}]`)

  const headers = { "Authorization": `Basic ${config.auth}`}
  const app_version = await getAppVersion()
  return await fetch(`https://cps.loocha.cn:9607/anony/login?1=${app_version}`, {headers})
    .then(res => res.buffer())
    .then(async buffer => {
      let _BIN = Buffer.from(buffer.slice(3, 7))
      _BIN = Number.parseInt(`0x${_BIN.toString('hex')}`)
      const _A = (_BIN & 0x000000ff) & 0x7f
      const _B = (_BIN & 0x0000ff00) >> 8 & 0x7f
      const _C = (_BIN & 0x00ff0000) >> 16 & 0x7f
      const _D = _BIN >> 24 & 0x7f
      const user_id = (_A * (1 << 21) + _B * (1 << 14) + _C * (1 << 7) + _D).toString()
      config.user_id = user_id
      console.log(`[*] => 缓存 USER_ID=[${user_id}]`)
      return config.user_id
    })
}


/**
 * 获取上网所需的动态密码
 * @return {String}
 * mobile=17751776505&model=FRD-L09&server_did=3bc1c648-1c41-4584-95b9-15b993f85484&time=1525775047000&type=1
 */
async function getPasswd() {
  const headers = { Authorization: `Basic ${config.auth}` }
  const account = config.account
  const app_version = await getAppVersion()
  const user_id = await getUserId()
  const time = Date.now()
  const token = `server_did=0&time=${time}&type=1`
  const sign = crypto.createHash('md5').update(`mobile=${account}&model=default&${token}`).digest('hex').toUpperCase()
 
  return await fetch(`https://wifi.loocha.cn/${user_id}/wifi/telecom/pwd?1=${app_version}&mm=default&${token}&sign=${sign}`, {headers})
    .then(res => {
      if (res.ok)
        return res.json()
      else 
        throw new Error("[!] 获取Code时返回异常状态码.")
    })
    .then(json => {
      // console.log(json)
      if (json.status == '0') {
        let pass = json.telecomWifiRes.password
        return pass
      } else {
        throw new Error("[!] 获取Code时返回异常JSON状态码.")
      }
    })
}
/**
 * 获取上线所需要的QRCode代码
 * @return {String}
 */
async function getQrCode() {
  await getIPs()
  let app_version = await getAppVersion()
  let wan_ip = config.wan_ip
  let bras_ip = config.bras_ip
  return await fetch(`https://wifi.loocha.cn/0/wifi/qrcode?1=${app_version}&brasip=${bras_ip}&ulanip=${wan_ip}&wlanip=${wan_ip}&mm=default`)
    .then(res => {
      if (res.ok)
        return res.json()
      else
        throw new Error("[!] 获取QRCode时返回异常状态码.")
    })
    .then(json => {
      if (json.status == "0") {
        let qrcode = json.telecomWifiRes.password
        return qrcode
      }
    })
}

/**
 * 初始化用户IP
 * @return {void}
 */
async function getIPs() {
  return await fetch("http://test.f-young.cn", {redirect: 'manual'})
    .then(res=>res.headers.get('Location'))
    .then(url=>{
      if (url!=undefined) {
        const args = url.split('?')[1].split('&')
        const wan_ip = args[0].split('=')[1]
        const bras_ip = args[1].split('=')[1]
        config.wan_ip = wan_ip
        config.bras_ip = bras_ip
      }
    })
}

/**
 * 校园网登录核心部分
 * @return {Promise}
 */
async function doOnline() {
  const headers = { Authorization: `Basic ${config.auth}` }
  const user_id = config.user_id
  const app_version = config.app_version
  const account = config.account
  const code = await getPasswd()
  console.log(`[*] => 本次登录密码[${code}]`)

  const qrcode = await getQrCode()
  console.log(`[*] => 本次QRCode[${qrcode}]`)

  const time = Date.now()
  const token = `server_did=0&time=${time}&type=1`
  const sign = crypto.createHash('md5').update(`mobile=${account}&model=default&${token}`).digest('hex').toUpperCase()

  const param = `1=${app_version}&qrcode=${qrcode}&code=${code}&mm=default&${token}&sign=${sign}`

  return await fetch(`https://wifi.loocha.cn/${user_id}/wifi/telecom/auto/login?${param}`, {
      method: "POST",
      headers
    })
    .then(res=>res.json())
    .then(json=>{
      console.log(json)
      if (json.status == "0") {
        console.log(`[*] 登录成功.`)
      }
      else if (json.status == "993") {
        // 账户已登录
        console.log(`[!] ${json.response}.`)
      }
    })
}

(async function() {

if (!fs.existsSync('./config.json'))
  throw new Error("[!] 你没有填写config.json文件竟然还想登录QAQ...")

global.config = require('./config.json')

if (config.account == "" || config.passwd == "")
  throw new Error("[!] 请填写掌上大学的账户与密码...")

// 获取USER_ID和AUTH
await getUserId().catch(err=>console.log(err))

// 登录
await doOnline().catch(err=>console.log(err))

// 第三步：输出当前在线的设备数量
// await checkLogin().catch(err=>console.log(err))

// 可选项：下线当前设备
// await kickOffDevice()

// 保存当前配置文件
await saveConfig()

})()
