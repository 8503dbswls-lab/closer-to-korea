// Editorial dates are calendar dates, never filesystem or deployment times.
function validDate(value,today){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value&&value<=today;
}

export function contentLastmod(item,today=new Date().toISOString().slice(0,10)){
  if(item.draft||item.hidden)return null;
  if(!validDate(item.publishedAt,today))return null;
  // An explicit but invalid modification date makes the latest change unknown.
  // Do not disguise it with the older publication date.
  if(item.updatedAt!==undefined&&item.updatedAt!==null&&item.updatedAt!==''){
    if(!validDate(item.updatedAt,today)||item.updatedAt<item.publishedAt)return null;
    return item.updatedAt;
  }
  return item.publishedAt;
}
