(function() {
  let lastDir = fullOutput.split('/')
  lastDir = lastDir[lastDir.length - 1].trim()

  let absDir = fullOutput
    .replace(/\//gm, '[[slnc 200]]/')
    .replace(/-/gm, '[[slnc 200]]-')
    .replace(/_/gm, '[[slnc 200]]-').trim()

  say({
    text: {
      es_ES: {
        0: `Estás en el directorio: ${lastDir}.`,
        1: `Estás en el directorio: ${absDir}.`,
        2: `Estás en el directorio: [[char LTRL]] ${absDir}.`
      },
      en_GB: {
        0: `You're in the directory: ${lastDir}.`,
        1: `You're in the directory: ${absDir}.`,
        2: `You're in the directory: [[char LTRL]] ${absDir}.`
      }
    },
    opts: { block: true },
  });
})()
