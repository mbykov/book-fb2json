import fb2json from "./index";
const path = require("path")
const log = console.log
const fse = require('fs-extra')

// let fbpath = path.resolve(__dirname, '../../fb2json/Junk/fbsample.fb2')
// let fbpath = '/home/michael/FB2/Bibikhin/bibikhin-lectures.fb2'
let fbpath = '/home/michael/FB2/Bibikhin/Bibihin_Mir.ry3bqA.245011.fb2.zip'

// let fbpath = '/home/michael/FB2/Bibikhin_Mir.fb2'
fbpath = path.resolve(fbpath)
log('RUN: FBPATH', fbpath)

fb2json(fbpath)
  .then(tree=> {
    log('______tree:', tree)
    // res.pipe(fse.createWriteStream('firstFile'))
  })
