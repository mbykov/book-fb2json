import { fb2json } from "./index";
const path = require("path")
const log = console.log
// const fse = require('fs-extra')

let fbpath

fbpath = '/home/michael/a/_books/chundler_deep_sleep/chundler_deep_sleep_ru.fb2'
// fbpath = '/home/michael/a/_books/chundler_deep_sleep/chundler_deep_sleep_en.fb2'

// fbpath = '/home/michael/diglossa.todo/London/London-Solomon_Islands-royallib.com.fb2.zip'
// fbpath = '/home/michael/FB2/Bibikhin_Mir.fb2'

fbpath = path.resolve(fbpath)
log('RUN: FBPATH', fbpath)

fb2json(fbpath)
  .then(res=> {
    // if (!res) return
    if (!res.docs) return
    log(res.docs.slice(-1))
    log('_docs', res.docs.length)
    res.docs.forEach(doc=> {
      if (doc.level > -1) log('_title:', doc)
    })
  })
