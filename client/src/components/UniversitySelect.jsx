import {useId,useMemo,useRef,useState,useEffect} from 'react';
import {useApp} from '../context.jsx';
import {sortUniversities,universityName,matchesUniversity} from '../lib/university-order.js';
import './university-select.css';
export default function UniversitySelect({rows=[],value='',onChange,disabled=false,label,emptyLabel,allowUnassigned=false}){
 const {lang}=useApp(),fa=lang==='fa',id=useId(),input=useRef(null),box=useRef(null);
 const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(0),[placement,setPlacement]=useState({up:false,height:240});
 const empty=emptyLabel||(fa?'انتخاب دانشگاه':'Select university'),name=label||(fa?'دانشگاه':'University');
 const sorted=useMemo(()=>sortUniversities(rows,lang),[rows,lang]);
 const choices=useMemo(()=>[...(!query?[{id:'',label:empty},...(allowUnassigned?[{id:'null',label:fa?'بدون دانشگاه':'No university'}]:[])]:[]),...sorted.filter(u=>matchesUniversity(u,query)).map(u=>({id:String(u.id),label:universityName(u,lang),code:u.code}))],[sorted,query,empty,allowUnassigned,fa,lang]);
 const selected=String(value)==='null'?(fa?'بدون دانشگاه':'No university'):universityName(rows.find(u=>String(u.id)===String(value))||{name:value?`${fa?'دانشگاه':'University'} #${value}`:empty},lang);
 useEffect(()=>{setOpen(false);setQuery('');},[value,lang,disabled]);
 useEffect(()=>{if(open)document.getElementById(`${id}-${active}`)?.scrollIntoView?.({block:'nearest'});},[active,open,id]);
 const expand=()=>{if(disabled)return;const rect=input.current.getBoundingClientRect(),boundary=input.current.closest('.modal-body')?.getBoundingClientRect();const below=(boundary?.bottom??innerHeight)-rect.bottom,above=rect.top-(boundary?.top??0);setPlacement({up:below<180&&above>below,height:Math.max(80,Math.min(260,(below<180&&above>below?above:below)-12))});setOpen(true);setActive(0);};
 const choose=item=>{onChange(item.id);setOpen(false);setQuery('');input.current?.focus();};
 return <div className="university-select" ref={box} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)){setOpen(false);setQuery('');}}}>
  <input ref={input} role="combobox" aria-label={name} aria-expanded={open&&!disabled} aria-controls={id} aria-autocomplete="list" aria-activedescendant={open&&choices.length?`${id}-${Math.min(active,choices.length-1)}`:undefined} disabled={disabled} value={open?query:(value?selected:'')} placeholder={empty} autoComplete="off" onClick={expand} onChange={e=>{setQuery(e.target.value);setActive(0);if(!open)expand();}} onKeyDown={e=>{
   if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false);setQuery('');}
   else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!open)expand();else setActive(i=>Math.max(0,Math.min(choices.length-1,i+(e.key==='ArrowDown'?1:-1))));}
   else if(e.key==='Enter'&&open&&choices.length){e.preventDefault();choose(choices[Math.min(active,choices.length-1)]);}
  }}/>
  <button type="button" className="university-select-toggle" tabIndex={-1} disabled={disabled} aria-label={fa?'نمایش دانشگاه‌ها':'Show universities'} onClick={()=>{input.current?.focus();if(open)setOpen(false);else expand();}}>⌄</button>
  {open&&!disabled&&<ul id={id} role="listbox" aria-label={name} className={`university-select-list ${placement.up?'opens-up':''}`} style={{maxHeight:placement.height}}>{choices.map((u,i)=><li key={u.id} id={`${id}-${i}`} role="option" aria-selected={String(value)===u.id} className={i===active?'highlighted':''} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(i)} onClick={()=>choose(u)}><span>{u.label}</span>{u.code&&<small dir="ltr">{u.code}</small>}</li>)}{!choices.length&&query&&<li className="muted" role="presentation">{fa?'دانشگاهی پیدا نشد':'No matching university'}</li>}</ul>}
 </div>;
}
