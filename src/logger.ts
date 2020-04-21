
export function error(message: string, verbose: number) {
  console.error(message);
}

export function warn(message: string, verbose: number) {
  console.log(message);
}

export function info(message: string, verbose: number) {
  console.log(message);
}

export function debug(message: string, verbose: number) {
  if (verbose >= 1) {
    console.log(message);
  }
}
