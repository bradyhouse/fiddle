import { interval, map, scan, take } from 'rxjs'
const out = document.getElementById('out')
interval(400).pipe(map(n => n + 1), scan((a, b) => a + b, 0), take(12))
  .subscribe(v => (out.textContent += `running sum: ${v}\n`))
