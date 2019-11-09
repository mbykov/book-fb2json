import fb2json from "./index";
const path = require("path")
const log = console.log

// let fbpath = path.resolve(__dirname, '../../fb2json/Junk/fbsample.fb2')
let fbpath = '/home/michael/FB2/Bibikhin/bibikhin-lectures.fb2'
fbpath = path.resolve(fbpath)
log('FBPATH', fbpath)

fb2json(fbpath)
  .then(res=> {
    log('_______md:', res)
  })
