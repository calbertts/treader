(function(g) {
  g.os = os
  g.std = std

  const {
    say,
    mode,
    countOut,
    fullError
  } = g

  const commandParts = expr.split(' ')
  const file = commandParts[commandParts.length - 1]

  function hasErrors() {
    let resp = false

    const notFound         = 'No such file or directory'
    const illegalOption    = 'illegal option'
    const permissionDenied = 'Permission denied'

    if (fullOutput.includes(notFound)) {
      say(`El archivo o directorio: ${file}. No existe`);
      console.log('pk');
      resp = true
    } else if (fullOutput.includes(illegalOption)) {
      const badParam = fullOutput.split('\n')[1].match('-- ([^&]*)')[1]
      say(`El parámetro ${badParam} no es válido para el comando ls`);
      resp = true
    } else if (fullOutput.includes(permissionDenied)) {
      say(`Permiso denegado`);
      resp = true
    }

    return resp
  }

  if (!hasErrors()) {
    const english = {
      0: `Folder: eci. There are ${countOut} files.`,
      1: `Folder: eci. There are ${countOut} files. The whole list is: ${fullOutput}`,
      2: `Folder: eci. There are ${countOut} files. The whole list is: [[char LTRL]] ${fullOutput}`,
    }
    const spanish = {
      0: `Directorio: eci. Hay ${countOut} archivos.`,
      1: `Directorio: eci. Hay ${countOut} archivos. La lista completa es: ${fullOutput}`,
      2: `Directorio: eci. Hay ${countOut} archivos. La lista completa es: [[char LTRL]] ${fullOutput}`,
    }

    say({
      text: {
        'es_ES':       spanish,
        'es_AR':       spanish,
        'es_MX':       spanish,
        'en-scotland': english,
        'en_AU':       english,
        'en_GB':       english,
        'en_IE':       english,
        'en_IN':       english,
        'en_US':       english,
        'en_ZA':       english,
      },
      opts: { block: true }
    })
  }
})(globalThis)
