'use strict'

import { fb2md } from "./index";
const path = require("path")
const log = console.log
// const fse = require('fs-extra')
const util = require("util")
let insp = (o) => log(util.inspect(o, false, null))

let fbpath
fbpath = '/home/michael/a/_books/chundler_deep_sleep/chundler_deep_sleep_ru.fb2'
// fbpath = '/home/michael/a/_books/chundler_deep_sleep/chundler_deep_sleep_en.fb2'
// fbpath = '/home/michael/diglossa.todo/London/London-Solomon_Islands-royallib.com.fb2.zip'
// fbpath = '/home/michael/FB2/Bibikhin_Mir.fb2'
fbpath = 'fb.fb2'

fbpath = path.resolve(__dirname, '../test', fbpath)
log('RUN: FBPATH', fbpath)

fb2md(fbpath)
  .then(res=> {
    log('_result')
    insp(res)
    if (!res.docs) return
    log(res.docs.slice(-1))
    log('_docs', res.docs.length)
    res.docs.forEach(doc=> {
      if (doc.level > -1) log('_title:', doc)
    })
  })
