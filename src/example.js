'use strict'

import { fb2json } from "./index";
const path = require("path")
const log = console.log
const util = require("util")
const fse = require('fs-extra')
let insp = (o) => log(util.inspect(o, false, null))
let write = process.argv.slice(2)[0] || false

let bpath
bpath = 'chundler_deep_sleep_ru.fb2'
bpath = 'chundler_deep_sleep_en.fb2'
bpath = 'fbsample.fb2'
bpath = 'LeoTolstoy.fb2'
bpath = 'Palama_K_Kiprian.fb2'
bpath = 'Derrida_Golos-i-fenomen.IALcDQ.217643.fb2'
bpath = 'Derrida_Golos-i-fenomen.IALcDQ.217643.fb2.zip'
bpath = 'Kamyu_Chuma.L3Zorw.230684.fb2.zip'

bpath = path.resolve(__dirname, '../test', bpath)

async function start(bpath, write) {
  let {descr, docs, imgs} = await fb2json(bpath)
  if (!docs) {
    log('_ERR:', descr)
    return
  }

  log('_descr:', descr)
  log('_docs:', docs.length)
  log('_imgs', imgs.length)
  // log('_slice', mds.slice(-10))
  let fns = docs.filter(doc=> doc.footnote)
  let refs = docs.filter(doc=> doc.refnote)
  log('_fns:', fns.length)
  log('_refs:', refs.length)
  log('RUN: BPATH', bpath)

  let headers = docs.filter(doc=> doc.level)
  log('_headers', headers)

  let tmps = refs.slice(0,2)
  tmps.forEach(doc=> {
    // if (doc.level) log('_title:', doc)
    // log('_d', doc)
  })

  if (write) {
    log('___WRITING', bpath)
    writeFiles(bpath, descr, docs)
  } else {
    return {descr, docs, imgs}
  }
}

start(bpath, write)

function writeFiles(bpath, descr, docs) {
  const dirpath = path.dirname(bpath)
  let mdpath = cleanDname(descr.author, descr.title)
  let dglpath = [mdpath, 'dgl'].join('.')
  dglpath = path.join(dirpath, dglpath)
  mdpath = [mdpath, 'md'].join('.')
  mdpath = path.join(dirpath, mdpath)
  descr.text = ['file:://', mdpath].join('')
  fse.writeJson(dglpath, descr, {spaces: 2})
  fse.writeJson(mdpath, docs, {spaces: 2})
}

export function cleanDname(author = '', title = '') {
  let str = [author.slice(0,25), title.slice(0,25)].join('-')
  return str.replace(/[)(,\.]/g,'').replace(/\s+/g, '-').replace(/\//g, '_').replace(/^-/, '')
}


/*
  было:
  _docs: 1042
  _imgs 0
  _fns: 38
  _refs: 14

*/
