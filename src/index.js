'use strict'

const _ = require('lodash')
const fse = require('fs-extra')
const path = require("path")
const log = console.log
const isGzip = require('is-gzip')
const isZip = require('is-zip');
const util = require("util")
const unzipper = require('unzipper')
// const etl = require('etl')
const iconv = require('iconv-lite');
var iso6393 = require('iso-639-3')
// let decoder = new util.TextDecoder('utf-8')
let insp = (o) => log(util.inspect(o, false, null))

const convert = require('xml-js')

async function parseZip(fbpath) {
  const directory = await unzipper.Open.file(fbpath)
  const file = directory.files[0]
  return await file.buffer()
}

export async function fb2md(fbpath)  {
  let ext = path.extname(fbpath)
  let buffer, errmess
  try {
    buffer = (ext == '.zip') ? await parseZip(fbpath) : (ext == '.fb2') ? await fse.readFile(fbpath) : null
  } catch(err) {
    errmess = 'not .fb2 file'
    return {descr: errmess}
  }

  let fbobj
  try {
    let xml = buffer.toString()
    if (/1251/.test(xml.split('\n')[0])) {
      buffer = iconv.decode(buffer, 'cp1251')
      xml = buffer.toString()
    }
    let json = convert.xml2json(xml, {compact: false, trim: true, ignoreDeclaration: true, ignoreComment: true, ignoreCdata: true});
    fbobj = JSON.parse(json).elements
  } catch(err) {
    errmess = 'can not read .fb2 file'
    return {descr: errmess}
  }

  // log('___', fbobj)

  let fictionbook = _.find(fbobj, el=> { return el.name == 'FictionBook' })
  // log('___FICTIONBOOK', fictionbook)
  // insp(fictionbook)
  if (!fictionbook) return {descr: 'empty .fb2 file'}

  let fbels = fictionbook.elements
  let description = _.find(fbels, el=> { return el.name == 'description' })
  let descr
  if (fbels) descr = parseInfo(description)
  else descr = {author: 'no author', title: 'no title', lang: 'no lang'}
  let mds = parseDocs(fbels)
  let imgs = []
  return {descr, mds, imgs}
}

// d

function parseInfo(description) {
  let descr = {}
  let descrs = description.elements
  let xtitleInfo = _.find(descrs, el=> { return el.name == 'title-info' })
  let xdocInfo = _.find(descrs, el=> { return el.name == 'document-info' })
  let xpubInfo = _.find(descrs, el=> { return el.name == 'publish-info' })
  let titleInfo = stripElement(xtitleInfo)
  let annotation
  let lang
  if (titleInfo.author) descr.author = parseAuthor(titleInfo.author)
  if (titleInfo.annotation) annotation = parseParEls(titleInfo.annotation)
  if (titleInfo['book-title']) descr.title = getText(titleInfo['book-title'])
  if (titleInfo.lang) lang = getText(titleInfo.lang)
  if (lang) {
    let iso = _.find(iso6393, iso=> iso.iso6391 == lang)
    if (iso) lang = iso.iso6393
    descr.lang = lang
  }
  if (annotation) descr.annotation = annotation
  return descr
}

function parseDocs(fb) {
  let docs = []
  let bodies = _.filter(fb, el=> { return el.name == 'body' })
  log('_BODIES', bodies.length)
  let body = bodies[0]
  if (!body) return []
  let els = body.elements

  let xtitle = _.find(body.elements, el=> { return el.name == 'title'})
  if (xtitle) parseTitle(docs, xtitle, 1)
  log('_XTITLE', xtitle)

  let level = 1
  let xsections = _.filter(body.elements, el=> { return el.name == 'section'})
  xsections = xsections.slice(0,2)
  xsections.forEach(sec=> {
    parseSection(docs, level, sec)
  })

  // let notel =  _.find(bodies, body=> body.attributes && body.attributes.name == 'notes')
  // let notes = []
  // if (notel) {
  //   notel.elements.forEach(notel=> {
  //     let note = parseParEls(notel.elements)
  //     // log('_NOTE', note)
  //   })
  // }

  return docs
}

function parseTitle(docs, xtitle, level) {
  if (!xtitle.elements) return
  xtitle.elements.forEach(titlel=> {
    let titledoc = parseParEls(titlel.elements)
    titledoc.level = level
    docs.push(titledoc)
  })
}

function parseSection(docs, level, sec) {
  if (!sec) return
  // log('_SEC', sec)
  let elements = sec.elements
  let xtitle = _.find(elements, el=> { return el.name == 'title'})
  if (xtitle) {
    let titlezero = xtitle.elements[0]
    let titlels = titlezero.elements
    let titledoc = parseParEls(titlels)
    // titledoc.level = level
    titledoc = ['#'.repeat(level), titledoc].join(' ')
    docs.push(titledoc)
  }

  let xsections = _.filter(elements, el=> { return el.name == 'section'})
  xsections.forEach(child=> {
    let nextlevel = level+1
    parseSection(docs, nextlevel, child)
  })

  let xpars = _.filter(elements, el=> { return el.name == 'p'})
  xpars.forEach(xpar=> {
    if (!xpar.elements) return
    let md = parseParEls(xpar.elements)
    // log('____HERE WAS DOC', doc)
    docs.push(md)
  })
}

function parseParEls(els) {
  let texts = []
  // let styles = []
  // let pos = 0
  els.forEach(el=> {
    if (el.type == 'text') {
      let text = cleanText(el.text)
      texts.push(text)
      // pos += text.split(' ').length
    } else if (el.type == 'element' && el.name == 'p') {
      let par = parseParEls(el.elements)
      texts.push(par.md)
    } else if (el.type == 'element' && el.name == 'emphasis') {
      if (!el.elements) return
      let emph = el.elements[0]
      let text = cleanText(emph.text)
      let md = ['_', text, '_'].join('')
      texts.push(md)
    } else if (el.type == 'element' && el.name == 'strong') {
      if (!el.elements) return
      let emph = el.elements[0]
      let text = cleanText(emph.text)
      let md = ['*', text, '*'].join('')
      texts.push(md)
    } else if (el.type == 'element' && el.name == 'sup') {
      let sup = el.elements[0]
      let text = sup.elements[0].text
      let md = text
      texts.push(md)
    } else if (el.type == 'element' && el.name == 'a') {
      // console.log('____A-el:', el)
      // TODO: NOTES
      // throw new Error('__A ELEMENT')
      // return
      let ref = el.elements[0].text
      // console.log('___ref:', ref)
      texts.push(ref)
    } else if (el.type == 'element' && el.name == 'style') {
      // console.log('_style el:', el)
      // throw new Error('__STYLE ELEMENT')
      return
    } else if (el.type == 'element' && el.name == 'empty-line') {
      return
    } else if (el.type == 'element' && el.name == 'title') {
      // often used as note reference:
      try {
        let fnref = el.elements[0].elements[0].text
        let ref = ['[', fnref, ']: '].join('').replace('[[', '[').replace(']]', ']')
        texts.push(ref)
      } catch(err) {
        // log('ERR: some error)
      }
    } else {
      // todo: ===================== закончить бредовые элементы
      console.log('ERR: NOT EL:', el)
      // log('__UNKNOWN EL', el.elements[0])
      // throw new Error('NOT PAR TEXT')
    }
  })
  let md = texts.join(' ')
  // return {md: md}
  return md
}

function parseAuthor(els) {
  let fname = _.find(els, el=> { return el.name == 'first-name' })
  let mname = _.find(els, el=> { return el.name == 'middle-name' })
  let lname = _.find(els, el=> { return el.name == 'last-name' })
  let author = [getOnlyEl(fname), getOnlyEl(mname), getOnlyEl(lname)].join(' ')
  return author
}

function stripElement(xdoc) {
  let doc = {}
  if (xdoc.type == 'element') doc = getEls(xdoc)
  else if (xdoc.type == 'text') doc.text = getText(xdoc)
  // else if (xdoc.type == 'p') doc.text = getText(xdoc)
  return doc
}

function getEls(xdoc) {
  let doc = {}
  xdoc.elements.forEach(el=> {
    doc[el.name] = el.elements
  })
  return doc
}

function getOnlyEl(xdoc) {
  if (!xdoc) return ''
  let el = xdoc.elements[0]
  let text = (el.text) ? el.text : ''
  return text
}

function getText(xdoc) {
  let el = xdoc[0]
  let text = (el.text) ? cleanText(el.text) : ''
  return text
}


// function parseNotes(notes) {
//   // log('__notes', notes)
// }

function cleanText(str) {
  if (!str) return ''
  let clean = str.replace(/\s\s+/g, ' ')
  return clean
}
