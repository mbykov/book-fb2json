'use strict'

import { fb2md } from "./index";
const path = require("path")
const log = console.log
// const fse = require('fs-extra')
const util = require("util")
const fse = require('fs-extra')
let insp = (o) => log(util.inspect(o, false, null))
let write = process.argv.slice(2)[0] || false

let bpath
bpath = 'chundler_deep_sleep_ru.fb2'
// bpath = 'chundler_deep_sleep_en.fb2'
// bpath = 'London-Solomon_Islands-royallib.com.fb2.zip'
// bpath = 'Bibikhin_Mir.fb2'
bpath = 'fbsample.fb2'
bpath = 'LeoTolstoy.fb2'

bpath = path.resolve(__dirname, '../test', bpath)
log('RUN: BPATH', bpath)

async function start(bpath, write) {
  let {descr, mds, imgs} = await fb2md(bpath)
  if (!mds) {
    log('_ERR:', descr)
    return
  }

  // log('_descr:', descr)
  log('_mds:', mds.length)
  log('_imgs', imgs.length)
  // log('_slice', mds.slice(-10))
  // mds = mds.slice(0,5)
  mds.forEach(md=> {
    if (md[0] == '#') log('_title:', md)
  })

  if (write) {
    log('___WRITING', bpath)
    writeFiles(bpath, descr, mds)
  } else {
    return {descr, mds, imgs}
  }
}

start(bpath, write)

function writeFiles(bpath, descr, mds) {
  const dirpath = path.dirname(bpath)
  let mdpath = cleanDname(descr.author, descr.title)
  let dglpath = [mdpath, 'dgl'].join('.')
  dglpath = path.join(dirpath, dglpath)
  mdpath = [mdpath, 'md'].join('.')
  mdpath = path.join(dirpath, mdpath)
  descr.text = ['file:://', mdpath].join('')
  fse.writeJson(dglpath, descr, {spaces: 2})
  fse.writeJson(mdpath, mds, {spaces: 2})
}

export function cleanDname(author = '', title = '') {
  let str = [author.slice(0,25), title.slice(0,25)].join('-')
  return str.replace(/[)(,\.]/g,'').replace(/\s+/g, '-').replace(/\//g, '_').replace(/^-/, '')
}

// fb2md(bpath)
//   .then(res=> {
//     log('_result')
//     insp(res)
//     if (!res.docs) return
//     log(res.docs.slice(-1))
//     log('_docs', res.docs.length)
//     res.docs.forEach(doc=> {
//       if (doc.level > -1) log('_title:', doc)
//     })
//   })
