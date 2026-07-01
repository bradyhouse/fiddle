import * as d3 from 'd3'
const data = [4, 8, 15, 16, 23, 42], w = 480, h = 260, m = 24
const x = d3.scaleBand().domain(d3.range(data.length)).range([m, w - m]).padding(0.15)
const y = d3.scaleLinear().domain([0, d3.max(data)]).nice().range([h - m, m])
const svg = d3.select('#app').append('svg').attr('width', w).attr('height', h)
svg.selectAll('rect').data(data).join('rect')
  .attr('x', (_, i) => x(i)).attr('y', d => y(d))
  .attr('width', x.bandwidth()).attr('height', d => y(0) - y(d))
  .attr('rx', 3).attr('fill', '#33ff88')
