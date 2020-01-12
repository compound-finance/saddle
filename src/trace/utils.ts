
export function last(arr, n=1) {
  return arr[arr.length - n];
}

export function lastN(arr, n=1) {
  return arr.slice(arr.length - n);
}

export function chunk<T>(arr, size) {
  let i = 0;
  let chunks: T[] = [];

  while (i < arr.length) {
    chunks.push(arr.slice(i, i+size));
    i+=size;
  }

  return chunks;
}

export function trimZero(num) {
  let i = 0;
  while (num[i] === '0') {
    i++;
  }

  return num.slice(i);
}

export function trim0x(num) {
  if (num.slice(0, 2) === '0x') {
    return num.slice(2,);
  } else {
    return num;
  }
}

export function pad(val, align=32) {
  let padLength = align - ( val.length % align );

  return [...Array(padLength).keys()].map((_) => '0').join('') + val;
}
