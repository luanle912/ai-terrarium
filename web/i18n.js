// Language choice and string lookup (global tr). No DOM needed, so node tests can load this block too.
(function(){
'use strict';
const LANGS=[['vi','Tiếng Việt'],['en','English'],['ja','日本語'],['ko','한국어'],['zh','简体中文'],['es','Español'],['th','ไทย']];
const CODES=LANGS.map(l=>l[0]),KEY='terrarium-lang',FALLBACK='en';
const has=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k);
// ?lang= in the URL first (the picker's fallback when storage is blocked), then the saved choice, then the
// browser's languages by prefix (zh-TW still maps to zh), else English.
function detect(storage,languages,search){
  try{const q=search&&new URLSearchParams(search).get('lang');if(CODES.includes(q))return q;}catch(e){}
  try{const v=storage&&storage.getItem(KEY);if(CODES.includes(v))return v;}catch(e){}
  for(const l of languages||[]){const p=String(l||'').toLowerCase().split('-')[0];if(CODES.includes(p))return p;}
  return FALLBACK;
}
const store=(()=>{try{return typeof localStorage!=='undefined'?localStorage:null;}catch(e){return null;}})();
const nav=typeof navigator!=='undefined'?navigator:null;
let lang=detect(store,nav?(nav.languages&&nav.languages.length?nav.languages:[nav.language]):[],typeof location!=='undefined'?location.search:'');
const table=l=>(globalThis.I18N_STRINGS||{})[l];
// Missing keys fall back to English, then Vietnamese (the source language), then the key itself so the gap shows.
function tr(key,params){
  let v=has(table(lang),key)?table(lang)[key]:has(table('en'),key)?table('en')[key]:has(table('vi'),key)?table('vi')[key]:key;
  if(typeof v!=='string'||!params)return v;
  return v.replace(/\{(\w+)\}/g,(m,n)=>has(params,n)?String(params[n]):m);
}
// Returns false for an unknown code, otherwise whether the choice was saved ('saved') or only applied ('applied').
function setLang(l,{persist=true}={}){
  if(!CODES.includes(l))return false;
  lang=l;
  let saved=false;
  if(persist&&store){try{store.setItem(KEY,l);saved=store.getItem(KEY)===l;}catch(e){}}
  if(typeof document!=='undefined')document.documentElement.lang=l;
  return saved?'saved':'applied';
}
// BCP 47 tag for Intl formatting (dates, numbers) in the current language.
const LOCALES={vi:'vi-VN',en:'en-US',ja:'ja-JP',ko:'ko-KR',zh:'zh-CN',es:'es-ES',th:'th-TH'};
if(typeof document!=='undefined')document.documentElement.lang=lang;
globalThis.I18n={LANGS,CODES,KEY,detect,tr,setLang,get lang(){return lang;},get locale(){return LOCALES[lang];}};
globalThis.tr=tr;
})();
