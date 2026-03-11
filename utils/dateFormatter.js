/**
 * Enhanced Date Formatter Utilities v3
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
   Date Helpers
-------------------------------- */

function normalizeDate(date) {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clone(d){
  return new Date(d.getTime());
}

/* --------------------------------
   Locale Data
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
  const tzH = String(Math.floor(Math.abs(tz)/60)).padStart(2,"0");
  const tzM = String(Math.abs(tz)%60).padStart(2,"0");

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

    Z: `${sign}${tzH}:${tzM}`
  };

  return format.replace(
    /YYYY|YY|Q|MMMM|MMM|MM|M|DD|D|dddd|ddd|W|HH|H|hh|h|mm|ss|SSS|A|a|Z/g,
    t=>tokens[t]
  );
}

/* --------------------------------
   Relative Time
-------------------------------- */

export function getRelativeTime(date){
  const then = normalizeDate(date);
  if(!then) return "";

  const diff = then.getTime() - Date.now();
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
    const value = Math.floor(abs/ms);
    if(value >= 1){
      const plural = value>1?"s":"";
      return diff<0
        ? `${value} ${name}${plural} ago`
        : `${value} ${name}${plural} from now`;
    }
  }
}

/* --------------------------------
   Checks
-------------------------------- */

export function isToday(date){
  return isSameDay(date,new Date());
}

export function isYesterday(date){
  const y = new Date();
  y.setDate(y.getDate()-1);
  return isSameDay(date,y);
}

export function isSameDay(a,b){
  const d1 = normalizeDate(a);
  const d2 = normalizeDate(b);
  if(!d1||!d2) return false;

  return (
    d1.getDate()===d2.getDate() &&
    d1.getMonth()===d2.getMonth() &&
    d1.getFullYear()===d2.getFullYear()
  );
}

export function isPast(date){
  const d = normalizeDate(date);
  return d ? d.getTime()<Date.now() : false;
}

export function isFuture(date){
  const d = normalizeDate(date);
  return d ? d.getTime()>Date.now() : false;
}

/* --------------------------------
   Add / Subtract
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

export const addDays=(d,n)=>add(d,{days:n});
export const addMonths=(d,n)=>add(d,{months:n});
export const addYears=(d,n)=>add(d,{years:n});

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
    default: return delta;
  }
}

/* --------------------------------
   ISO Format
-------------------------------- */

export function toISO(date){
  const d = normalizeDate(date);
  if(!d) return "";

  return new Date(d.getTime()-d.getTimezoneOffset()*60000)
    .toISOString()
    .replace("T"," ")
    .slice(0,19);
}

/* --------------------------------
   Start / End
-------------------------------- */

export function startOf(date,unit){
  const d=normalizeDate(date);
  if(!d) return null;

  const r=clone(d);

  switch(unit){
    case "day":
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
  const d=startOf(date,unit);
  if(!d) return null;

  switch(unit){
    case "day":
      d.setHours(23,59,59,999);
      break;
    case "month":
      d.setMonth(d.getMonth()+1);
      d.setDate(0);
      d.setHours(23,59,59,999);
      break;
    case "year":
      d.setFullYear(d.getFullYear()+1);
      d.setMonth(0,0);
      d.setHours(23,59,59,999);
      break;
  }

  return d;
}
