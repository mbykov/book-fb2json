'use strict'

import { fb2json } from "./index";
const path = require("path")
const log = console.log
const util = require("util")
const fse = require('fs-extra')
let insp = (o) => log(util.inspect(o, false, null))
let write = process.argv.slice(2)[0] || false

let bpath
bpath = 'fbsample.fb2'
bpath = path.resolve(__dirname, '../test', bpath)
log('_bpath', bpath)

async function start(bpath) {
  let {descr, docs, imgs} = await fb2json(bpath)
  log('_descr:', descr)
  log('_docs:', docs.length)
  log('_imgs', imgs.length)
  // log('_slice', mds.slice(-10))
}

start(bpath)
