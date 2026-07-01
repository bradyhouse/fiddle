const fib = (n) => (n < 2 ? n : fib(n - 1) + fib(n - 2))
console.log('node', process.version)
console.log('fib(0..10):', Array.from({ length: 11 }, (_, i) => fib(i)).join(' '))
