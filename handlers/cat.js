(function(g) {
  const {
    say,
    mode,
    expr,
    countOut,
    fullOutput
  } = g

  const commandParts = expr.split(' ')
  const file = commandParts[commandParts.length - 1]

  function hasErrors() {
    let resp = false

    const notFound         = 'No such file or directory'
    const illegalOption    = 'illegal option'
    const permissionDenied = 'Permission denied'

    if (fullOutput.includes(notFound)) {
      say(`El archivo: ${file}. No existe`);
      resp = true
    } else if (fullOutput.includes(illegalOption)) {
      const badParam = fullOutput.split('\n')[1].match('-- ([^&]*)')[1]

      if (mode === 0) {
        say(`El parámetro ${badParam} no es válido para el comando cat`);
      } else if (mode === 1) {
        say(`El parámetro ${badParam} no es válido para el comando cat. Las opciones válidas son: [[emph +]] [[char LTRL]] benstu`);
      } else if (mode === 2) {
        say({
          text: `[[char LTRL]] ${fullOutput} [[char LTRL]]`,
        });
      }
      resp = true
    } else if (fullOutput.includes(permissionDenied)) {
      say(`No tienes permisos para ver el archivo.`);
      resp = true
    }

    return resp
  }

  if (!hasErrors()) {
    if (countOut === 0) {
      say(`El fichero: ${file}. No tiene ninguna línea.`);
    } else if (countOut > 1) {
      if (mode === 0) {
        say(`Se han imprimido ${countOut} lineas del fichero: ${file}.`);
      } else if (mode === 1) {
        say(`Se han imprimido ${countOut} lineas del fichero: ${file}, este es el contenido:`);
        say({
          text: fullOutput,
        });
      } else if (mode === 2) {
        say(`Se han imprimido ${countOut} lineas del fichero: ${file}, este es el contenido letra por letra:`);
        say({
          text: `[[char LTRL]] ${fullOutput} [[char LTRL]]`,
        });
      }
    } else if (countOut === 1) {
      say(`El fichero: ${file}. Tiene una sola línea`);
    }
  }
})(globalThis)
