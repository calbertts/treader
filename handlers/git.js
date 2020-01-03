(function(g) {
  g.os = os
  g.std = std

  const {
    fullOutput,
  } = g

  if (fullOutput.includes('not a git repository')) {
    os.exec(['say', `Este no es un repositorio guit.`], { block: true })
  }

  else if (fullOutput.includes('Initialized empty Git repository')) {
    os.exec(['say', `Repositorio guit inicializado.`], { block: true })
  }

  else if (fullOutput.includes('Reinitialized existing Git repository')) {
    os.exec(['say', `Repositorio guit existente reinicializado.`], { block: true })
  }

  else {
    const branchPart = fullOutput.split('\n\n')[0].split(/On branch/)[1].trim()
    console.log('branchPart:', branchPart+'ok');
    os.exec(['say', `Estás en la rama ${branchPart}.`], { block: true })
  }
})(globalThis)
