const dot = document.getElementById('dot')
let t = 0
;(function frame() {
  t += 0.02
  dot.setAttribute('cx', 240 + Math.cos(t) * 150)
  dot.setAttribute('cy', 120 + Math.sin(t * 1.6) * 90)
  requestAnimationFrame(frame)
})()
