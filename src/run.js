import fb2json from "./index";
const path = require("path")
const log = console.log
const fse = require('fs-extra')

let fbpath
// fbpath = path.resolve(__dirname, '../../fb2json/Junk/fbsample.fb2')
// fbpath = '/home/michael/FB2/Bibikhin/bibikhin-lectures.fb2'
fbpath = '/home/michael/FB2/Bibikhin/Bibihin_Mir.ry3bqA.245011.fb2.zip'
// fbpath = "/home/michael/a/_books/chundler_deep_sleep/'01 Chandler, Raymond - The Big Sleep (Philip Marlowe) - 1939.fb2'"
fbpath = '/home/michael/a/_books/chundler_deep_sleep/chundler_deep_sleep_ru.fb2'
// fbpath = '/home/michael/a/_books/chundler_deep_sleep/chundler_deep_sleep_en.fb2'

// let fbpath = '/home/michael/FB2/Bibikhin_Mir.fb2'
fbpath = path.resolve(fbpath)
log('RUN: FBPATH', fbpath)

fb2json(fbpath)
  .then(res=> {
    if (!res.docs) return
    log(res.docs.slice(-1))
    log('_docs', res.docs.length)
    res.docs.forEach(doc=> {
      if (doc.level > -1) log('_d', doc)
    })
  })
