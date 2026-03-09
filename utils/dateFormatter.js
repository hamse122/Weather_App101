/**
 * Enhanced Date Formatter Utilities v2
 * Lightweight alternative to Moment.js / Day.js
 */

/* -----------------------------
   Internal Helpers
----------------------------- */

function normalizeDate(date) {
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
}

const monthsFull = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const monthsShort = monthsFull.map(m => m.slice(0,3));

const weekdaysFull = [
  "Sunday","Monday","Tuesday","Wednesday",
  "Thursday","Friday","Saturday"
];

const weekdaysShort = weekdaysFull.map(d => d.slice(0,3));

/* -----------------------------
   Format Date (mini moment.js)
----------------------------- */

export function formatDate(date, format = "YYYY-MM-DD") {
  const d = normalizeDate(date);
  if (!d) return "";

  const tokens = {
    YYYY: d.getFullYear(),
    YY: String(d.getFullYear()).slice(-2),

    MMMM: monthsFull[d.getMonth()],
    MMM: monthsShort[d.getMonth()],
    MM: String(d.getMonth() + 1).padStart(2, "0"),
    M: d.getMonth() + 1,

    DD: String(d.getDate()).padStart(2, "0"),
    D: d.getDate(),

    dddd: weekdaysFull[d.getDay()],
    ddd: weekdaysShort[d.getDay()],

    HH: String(d.getHours()).padStart(2, "0"),
    H: d.getHours(),

    hh: String((d.getHours() % 12) || 12).padStart(2,"0"),
    h: (d.getHours() % 12) || 12,

    mm: String(d.getMinutes()).padStart(2,"0"),
    ss: String(d.getSeconds()).padStart(2,"0"),
    SSS: String(d.getMilliseconds()).padStart(3,"0"),

    A: d.getHours() >= 12 ? "PM" : "AM",
    a: d.getHours() >= 12 ? "pm" : "am",
  };

  return format.replace(
    /YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|HH|H|hh|h|mm|ss|SSS|A|a/g,
    token => tokens[token]
  );
}

/* -----------------------------
   Relative Time
----------------------------- */

export function getRelativeTime(date) {
  const then = normalizeDate(date);
  if (!then) return "";

  const diff = then.getTime() - Date.now();
  const abs = Math.abs(diff);

  const seconds = Math.floor(abs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);

  const suffix = diff < 0 ? "ago" : "from now";

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} seconds ${suffix}`;
  if (minutes < 60) return `${minutes} minute${minutes>1?"s":""} ${suffix}`;
  if (hours < 24) return `${hours} hour${hours>1?"s":""} ${suffix}`;
  if (days < 30) return `${days} day${days>1?"s":""} ${suffix}`;
  if (months < 12) return `${months} month${months>1?"s":""} ${suffix}`;
  return `${years} year${years>1?"s":""} ${suffix}`;
}

/* -----------------------------
   Date Checks
----------------------------- */

export function isToday(date) {
  const d = normalizeDate(date);
  if (!d) return false;

  const t = new Date();
  return (
    d.getDate() === t.getDate() &&
    d.getMonth() === t.getMonth() &&
    d.getFullYear() === t.getFullYear()
  );
}

export function isYesterday(date) {
  const d = normalizeDate(date);
  if (!d) return false;

  const y = new Date();
  y.setDate(y.getDate() - 1);

  return (
    d.getDate() === y.getDate() &&
    d.getMonth() === y.getMonth() &&
    d.getFullYear() === y.getFullYear()
  );
}

export function isSameDay(a,b){
  const d1 = normalizeDate(a);
  const d2 = normalizeDate(b);
  if(!d1 || !d2) return false;

  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}

export function isPast(date){
  const d = normalizeDate(date);
  return d ? d.getTime() < Date.now() : false;
}

export function isFuture(date){
  const d = normalizeDate(date);
  return d ? d.getTime() > Date.now() : false;
}

/* -----------------------------
   Add Time
----------------------------- */

export function addDays(date,days){
  const d = normalizeDate(date);
  if(!d) return null;

  const r = new Date(d);
  r.setDate(r.getDate()+days);
  return r;
}

export function addMonths(date,months){
  const d = normalizeDate(date);
  if(!d) return null;

  const r = new Date(d);
  r.setMonth(r.getMonth()+months);
  return r;
}

export function addYears(date,years){
  const d = normalizeDate(date);
  if(!d) return null;

  const r = new Date(d);
  r.setFullYear(r.getFullYear()+years);
  return r;
}

/* -----------------------------
   Differences
----------------------------- */

export function diffInDays(a,b){
  const d1 = normalizeDate(a);
  const d2 = normalizeDate(b);
  if(!d1 || !d2) return NaN;

  return Math.floor(Math.abs(d1-d2)/(1000*60*60*24));
}

export function diffInHours(a,b){
  const d1 = normalizeDate(a);
  const d2 = normalizeDate(b);
  if(!d1 || !d2) return NaN;

  return Math.floor(Math.abs(d1-d2)/(1000*60*60));
}

export function diffInMinutes(a,b){
  const d1 = normalizeDate(a);
  const d2 = normalizeDate(b);
  if(!d1 || !d2) return NaN;

  return Math.floor(Math.abs(d1-d2)/(1000*60));
}

export function diffInSeconds(a,b){
  const d1 = normalizeDate(a);
  const d2 = normalizeDate(b);
  if(!d1 || !d2) return NaN;

  return Math.floor(Math.abs(d1-d2)/1000);
}

/* -----------------------------
   ISO Format
----------------------------- */

export function toISO(date){
  const d = normalizeDate(date);
  if(!d) return "";

  return new Date(d.getTime()-d.getTimezoneOffset()*60000)
    .toISOString()
    .slice(0,19)
    .replace("T"," ");
}

/* -----------------------------
   Start / End
----------------------------- */

export function startOfDay(date){
  const d = normalizeDate(date);
  if(!d) return null;

  return new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0);
}

export function endOfDay(date){
  const d = normalizeDate(date);
  if(!d) return null;

  return new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59);
}

export function startOfMonth(date){
  const d = normalizeDate(date);
  if(!d) return null;

  return new Date(d.getFullYear(),d.getMonth(),1);
}

export function endOfMonth(date){
  const d = normalizeDate(date);
  if(!d) return null;

  return new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59);
}
