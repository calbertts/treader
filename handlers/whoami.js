(function(g) {
  g.os = os

  const {
    fullOutput
  } = g

  os.exec(['say', `Eres [[slnc]] ${fullOutput}.`], { block: false });
})(globalThis)
