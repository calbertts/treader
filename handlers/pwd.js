(function(g) {
  g.os = os
  g.std = std

  const {
    say,
    expr,
    countOut,
    fullOutput
  } = g
  console.log('OKK');

  let absDir = fullOutput
    .replace(/\//gm, ' [[slnc 100]] barra [[slnc 100]] ')
    .replace(/-/gm, ' [[slnc 100]] guión [[slnc 100]] ')
    .replace(/_/gm, ' [[slnc 100]] guión bajo [[slnc 100]] ')
  console.log('absDir:', absDir);

  let lastDir = dir.split('/')
  console.log('lastDir:', lastDir);

  lastDir = lastDir[lastDir - 1]

  say({
    text: {
      0: `Estás en el directorio: ${lastDir}.`,,
      1: `Estás en el directorio: ${absDir}.`,
      2: `Estás en el directorio: [[char LTRL]] ${absDir}.`
    },
    opts: { block: true },
  });
})(globalThis)
