/**
 * Enhanced Date Formatter Utilities v4
 * Lightweight alternative to Moment.js / Day.js
 */

/* --------------------------------
   Constants
-------------------------------- */

const MS = Object.freeze({
  second: 1000,
  minute: 60000,
  hour: 3600000,
  day: 86400000
});

/* --------------------------------
   Helpers
-------------------------------- */

function normalizeDate(date) {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clone(d){
  return new Date(d.getTime());
}

/* --------------------------------
   Locale
-------------------------------- */

const monthsFull = Object.freeze([
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
]);

const monthsShort = Object.freeze(monthsFull.map(m => m.slice(0,3)));

const weekdaysFull = Object.freeze([
  "Sunday","Monday","Tuesday","Wednesday",
  "Thursday","Friday","Saturday"
]);

const weekdaysShort = Object.freeze(weekdaysFull.map(d => d.slice(0,3)));

/* --------------------------------
   Week Number
-------------------------------- */

function getWeek(date){
  const d = new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate()+4-day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d-yearStart)/MS.day)+1)/7);
}

/* --------------------------------
   Format
-------------------------------- */

export function formatDate(date, format="YYYY-MM-DD"){
  const d = normalizeDate(date);
  if(!d) return "";

  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";

  const tokens = {
    YYYY: d.getFullYear(),
    YY: String(d.getFullYear()).slice(-2),

    Q: Math.ceil((d.getMonth()+1)/3),

    MMMM: monthsFull[d.getMonth()],
    MMM: monthsShort[d.getMonth()],
    MM: String(d.getMonth()+1).padStart(2,"0"),
    M: d.getMonth()+1,

    DD: String(d.getDate()).padStart(2,"0"),
    D: d.getDate(),

    dddd: weekdaysFull[d.getDay()],
    ddd: weekdaysShort[d.getDay()],

    W: getWeek(d),

    HH: String(d.getHours()).padStart(2,"0"),
    H: d.getHours(),

    hh: String((d.getHours()%12)||12).padStart(2,"0"),
    h: (d.getHours()%12)||12,

    mm: String(d.getMinutes()).padStart(2,"0"),
    ss: String(d.getSeconds()).padStart(2,"0"),
    SSS: String(d.getMilliseconds()).padStart(3,"0"),

    A: d.getHours()>=12?"PM":"AM",
    a: d.getHours()>=12?"pm":"am",

    Z: `${sign}${String(Math.floor(Math.abs(tz)/60)).padStart(2,"0")}:${String(Math.abs(tz)%60).padStart(2,"0")}`
  };

  return format.replace(
    /YYYY|YY|Q|MMMM|MMM|MM|M|DD|D|dddd|ddd|W|HH|H|hh|h|mm|ss|SSS|A|a|Z/g,
    t => tokens[t] ?? t
  );
}

/* --------------------------------
   Parse (NEW)
-------------------------------- */

export function parse(dateString, format="YYYY-MM-DD"){

  const map = {
    YYYY: "(\\d{4})",
    MM: "(\\d{2})",
    DD: "(\\d{2})",
    HH: "(\\d{2})",
    mm: "(\\d{2})",
    ss: "(\\d{2})"
  };

  let regex = format;
  Object.keys(map).forEach(t=>{
    regex = regex.replace(t,map[t]);
  });

  const match = new RegExp("^"+regex+"$").exec(dateString);
  if(!match) return null;

  const parts = {};
  let i=1;

  Object.keys(map).forEach(t=>{
    if(format.includes(t)){
      parts[t]=Number(match[i++]);
    }
  });

  return new Date(
    parts.YYYY || 1970,
    (parts.MM||1)-1,
    parts.DD||1,
    parts.HH||0,
    parts.mm||0,
    parts.ss||0
  );
}

/* --------------------------------
   Relative Time
-------------------------------- */

export function getRelativeTime(date){

  const then = normalizeDate(date);
  if(!then) return "";

  const diff = then - Date.now();
  const abs = Math.abs(diff);

  const units = [
    ["year",365*MS.day],
    ["month",30*MS.day],
    ["day",MS.day],
    ["hour",MS.hour],
    ["minute",MS.minute],
    ["second",MS.second]
  ];

  if(abs < 5000) return "just now";

  for(const [name,ms] of units){
    const v = Math.floor(abs/ms);
    if(v >= 1){
      return diff<0
        ? `${v} ${name}${v>1?"s":""} ago`
        : `${v} ${name}${v>1?"s":""} from now`;
    }
  }
}

/* --------------------------------
   Math
-------------------------------- */

export function add(date,{days=0,months=0,years=0}={}){
  const d = normalizeDate(date);
  if(!d) return null;

  const r = clone(d);

  if(days) r.setDate(r.getDate()+days);
  if(months) r.setMonth(r.getMonth()+months);
  if(years) r.setFullYear(r.getFullYear()+years);

  return r;
}

export function subtract(date,opts){
  return add(date,{
    days: -(opts.days||0),
    months: -(opts.months||0),
    years: -(opts.years||0)
  });
}

/* --------------------------------
   Differences
-------------------------------- */

export function diff(a,b,unit="day"){

  const d1=normalizeDate(a);
  const d2=normalizeDate(b);
  if(!d1||!d2) return NaN;

  const delta=Math.abs(d1-d2);

  switch(unit){
    case "second": return Math.floor(delta/MS.second);
    case "minute": return Math.floor(delta/MS.minute);
    case "hour": return Math.floor(delta/MS.hour);
    case "day": return Math.floor(delta/MS.day);
    case "month":
      return Math.abs(
        (d1.getFullYear()-d2.getFullYear())*12 +
        d1.getMonth()-d2.getMonth()
      );
    case "year":
      return Math.abs(d1.getFullYear()-d2.getFullYear());
    default:
      return delta;
  }
}

/* --------------------------------
   Date Info
-------------------------------- */

export function isLeapYear(year){
  return (year%4===0 && year%100!==0) || year%400===0;
}

export function daysInMonth(year,month){
  return new Date(year,month+1,0).getDate();
}

/* --------------------------------
   Start / End
-------------------------------- */

export function startOf(date,unit){

  const d = normalizeDate(date);
  if(!d) return null;

  const r = clone(d);

  switch(unit){

    case "day":
      r.setHours(0,0,0,0);
      break;

    case "week":
      r.setDate(r.getDate()-r.getDay());
      r.setHours(0,0,0,0);
      break;

    case "month":
      r.setDate(1);
      r.setHours(0,0,0,0);
      break;

    case "year":
      r.setMonth(0,1);
      r.setHours(0,0,0,0);
      break;
  }

  return r;
}

export function endOf(date,unit){

  const s = startOf(date,unit);
  if(!s) return null;

  switch(unit){

    case "day":
      s.setHours(23,59,59,999);
      break;

    case "week":
      s.setDate(s.getDate()+6);
      s.setHours(23,59,59,999);
      break;

    case "month":
      s.setMonth(s.getMonth()+1);
      s.setDate(0);
      s.setHours(23,59,59,999);
      break;

    case "year":
      s.setFullYear(s.getFullYear()+1);
      s.setMonth(0,0);
      s.setHours(23,59,59,999);
      break;
  }

  return s;
}
