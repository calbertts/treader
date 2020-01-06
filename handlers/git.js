(async function(g) {
  g.os = os
  g.std = std


  if (fullOutput.includes('not a git repository')) {
    say(`Este no es un repositorio guit.`)
  }

  else if (fullOutput.includes('Initialized empty Git repository')) {
    say(`Repositorio guit inicializado.`)
  }

  else if (fullOutput.includes('Reinitialized existing Git repository')) {
    say(`Repositorio guit existente reinicializado.`)
  }

  else {
    const branchPart = fullOutput.split('\n\n')[0].split(/On branch/)[1].trim()
    console.log('branchPart:', branchPart+'ok');

    const {CTRL_L, ENTER} = KEY_CODES
    const response = await ask('¿Quieres que continue?', [CTRL_L, ENTER])
    if (response === ENTER) {
      say(`Estás en la rama ${branchPart}.`)
    }
    else if (response === CTRL_L) {
      say('Okey')
    }
  }
})(globalThis)
