const user = require('./user.json')
const fs = require('fs')
const http = require('http')


function newClient() {}

function checkErr(err, info) {}

/**
 * 对应选项1 登录
 */
function login() {

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

function checkNet() {
  http.get("http://pre.f-young.cn/", res=>{
    const { statusCode } = res
    console.log(statusCode)
  })
}

function initial() {}

function loginChinaNet() {}

function checkLogin(result, full) {}

/**
 * 对应选项2 下线
 * @param {String} ip 配置文件里的参数
 * @param {String} brasIp 配置文件里的参数
 */
function kickOffDevice(ip, brasIp) {

}

function getPasswd() {}

function getQrCode() {}

function online() {}

function createUserFile() {}

function checkXML() {}

function menu() {}

// 程序主入口
function main() {
  if (checkEncry()) {
    menu()
  } else {
    console.log("请在user.json中输入账号密码")
  }
}
