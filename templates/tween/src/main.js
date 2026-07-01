import { Tween, Easing, update } from '@tweenjs/tween.js'
const box = document.getElementById('box'), pos = { x: -140 }
new Tween(pos).to({ x: 140 }, 1400).easing(Easing.Quadratic.InOut).yoyo(true).repeat(Infinity).start()
;(function animate(t) {
  requestAnimationFrame(animate); update(t)
  box.style.transform = `translateX(${pos.x}px)`
})()
