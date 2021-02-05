'use strict'

const _ = require('lodash')
const fse = require('fs-extra')
const path = require("path")
const log = console.log
const util = require("util")
const unzipper = require('unzipper')
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

export async function fb2json(fbpath)  {
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

    fbobj = convert.xml2js(xml, {compact: false, trim: true, ignoreDeclaration: true, ignoreComment: true, ignoreCdata: true});
  } catch(err) {
    errmess = 'can not read .fb2 file'
    return {descr: errmess}
  }

  let fictionbook = _.find(fbobj.elements, el=> { return el.name == 'FictionBook' })
  if (!fictionbook) return {descr: 'empty .fb2 file'}

  let fbels = fictionbook.elements
  let description = _.find(fbels, el=> { return el.name == 'description' })
  let descr
  if (fbels) descr = parseInfo(description)
  else descr = {author: 'no author', title: 'no title', lang: 'no lang'}
  let docs = parseFB(fbels)
  let imgs = []

  let headers = docs.filter(doc=> doc.level)
  if (!headers.length) {
    docs[0].level = 1
  } else if (!headers.filter(doc=> doc.level == 1).length) {
    let md = [descr.author, descr.title].join('. ')
    let xtitle = {md, level: 1}
    docs.unshift(xtitle)
  }

  return {descr, docs, imgs}
}

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

function parseFB(fb) {
  let docs = []
  let rawbodies = fb.filter(el=> { return el.name == 'body' })
  let body = rawbodies.find(el=> { return el.name == 'body' })
  let notel =  _.find(rawbodies, body=> body.attributes && body.attributes.name == 'notes')
  // bodies.forEach(body=> {
  let bdocs = parseDocs(body)
  docs.push(...bdocs)
  // })

  let notels = notel ? notel.elements : []
  let noteid, refnote
  notels.forEach(notel=> {
    let note = {footnote: true}
    notel.elements.forEach(el=> {
      if (el.name == 'title') refnote = el.elements[0].elements[0].text
      else if (el.name == 'p') note.md = el.elements[0].text
    })
    if (!refnote) return
    noteid = refnote.replace('[', '').replace(']', '')
    note._id = ['ref', noteid].join('-')
    docs.push(note)
  })

  return docs
}

function parseDocs(body) {
  let docs = []
  // let els = body.elements
  let level = 1
  body.elements.forEach(el=> {
    if (el.name == 'title') {
      parseTitle(docs, el, level)
    } else if (el.name == 'section') {
      parseSection(docs, level, el)
    } else {
      log('___ELSE', el)
      throw new Error('_ELSE')
    }
  })
  return docs
}

function parseSection(docs, level, sec) {
  level += 1
  if (!sec) return
  sec.elements.forEach(el=> {
    if (el.name == 'title') {
      parseTitle(docs, el, level)
    } else if (el.name == 'section') {
      parseSection(docs, level, el)
    } else if (el.name == 'cite') {
      let quotes = parseQuote(el.elements)
      // log('_Q', quotes)
      docs.push(...quotes)
    } else if (el.name == 'poem') {
      let lines = parsePoem(el.elements)
      docs.push(...lines)
      // log('_POEM', lines)
    } else if (el.name == 'p') {
      let doc = parseParEls(el.elements)
      docs.push(doc)
    } else {
      log('___ELSE', el)
    }
  })

}

function parseParEls(els) {
  let doc = {}
  let texts = []
  els.forEach(el=> {
    if (el.type == 'text') {
      let text = cleanText(el.text)
      texts.push(text)
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
      if (!el.elements || el.elements.length) return
      let sup = el.elements[0]
      let text = sup.elements[0].text
      let md = text
      texts.push(md)
    } else if (el.type == 'element' && el.name == 'a') {
      if (!el.elements[0].text) return
      let ref = el.elements[0].text.replace('[', '').replace(']', '')
      let refnote = ['[', ref, ']'].join('')
      texts.push(refnote)
      if (!doc.refnote) doc.refnote = {}
      doc.refnote[ref] = ref
    } else if (el.type == 'element' && el.name == 'stanza') {
      let par = parseParEls(el.elements)
      texts.push(par.md)
    } else if (el.type == 'element' && el.name == 'v') {
      let text = cleanText(el.elements[0].text)
      log('_LIST', el)
      texts.push(text)
      doc.type = 'list'
    } else if (el.type == 'element' && el.name == 'style') {
      return
    } else if (el.type == 'element' && el.name == 'empty-line') {
      return
    } else if (el.type == 'element' && el.name == 'title') {
      return
      // // could be used as note reference:
      // try {
      //   let ref = el.elements[0].elements[0].text.replace('[', '').replace(']', '')
      //   let footnote = ['[', ref, ']: '].join('')
      //   texts.push(footnote)
      //   throw new Error()
      // } catch(err) {
      //   log('FN ERR: some error')
      // }
    } else {
      // todo: ===================== finish stuff elements
      console.log('ERR: FB2 NOT EL:', el)
      throw new Error('NOT A PAR TEXT') // todo: del
    }
  })
  doc.md = texts.join(' ').trim()
  if (doc.type == 'list') log('_DL', doc)
  return doc
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
  if (!xdoc || !xdoc.elements || !xdoc.elements.length) return ''
  let el = xdoc.elements[0]
  let text = (el.text) ? el.text : ''
  return text
}

function getText(xdoc) {
  let el = xdoc[0]
  let text = (el.text) ? cleanText(el.text) : ''
  return text
}

function cleanText(str) {
  if (!str) return ''
  let clean = str.replace(/\s\s+/g, ' ')
  return clean
}

function parseTitle(docs, xtitle, level) {
  if (!xtitle.elements) return
  xtitle.elements.forEach(titlel=> {
    let titledoc = parseParEls(titlel.elements)
    titledoc.level = level
    docs.push(titledoc)
  })
}

function parsePoem(els) {
  let poemdocs = []
  els.forEach(stanza=> {
    let vs = stanza.elements.filter(v=> v.name == 'v')
    vs.forEach((v, idx)=> {
      let vtexts = v.elements.filter(v=> v.text)
      vtexts.forEach(vel=> {
        let doc = {md: vel.text, type: 'list'}
        if (!idx) doc.type = 'ulist'
        poemdocs.push(doc)
      })
    })
  })
  return poemdocs
}

function parseQuote(els) {
  let qdocs = []
  els.forEach(quotel=> {
    if (!quotel.elements) return
    let doc = {md: quotel.elements[0].text, type: 'quote'}
    // log('_QQ', quotel)
    qdocs.push(doc)
  })
  return qdocs
}
