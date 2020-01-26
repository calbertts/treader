---
layout: default
---

_This is still under development._

* * *

**TReader** is a very simple proxy between the **user** and **command line** that will
convert command output to voice by using MacOS voice synthesizer.

The voice will try to translate the output to a meaningful stuff by running
a set of handlers per command.

For instance:
```bash
# if you run
$ pwd

# and the output is
/home/user
```
**TReader** will say:
```
You're in your home directory
```

This is done by running a handler called `pwd.js`:
```js
(function() {
  let lastDir = fullOutput.split('/')
  lastDir = lastDir[lastDir.length - 1].trim()

  let absDir = fullOutput
    .replace(/\//gm, '[[slnc 200]]/')
    .replace(/-/gm, '[[slnc 200]]-')
    .replace(/_/gm, '[[slnc 200]]-').trim()

  say({
    text: {
      en_GB: {
        0: `You're in the directory: ${lastDir}.`,
        1: `You're in the directory: ${absDir}.`,
        2: `You're in the directory: [[char LTRL]] ${absDir}.`
      }
    },
    opts: { block: true },
  });
})()
```

Serveral languages can be used and custom handlers can be written.


###### Options available

| Shortcut        | Action          |
|:-------------|:------------------|
| CTRL+H           | Reads this help |
| CTRL+S           | Repeat last output |
| CTRL+L | Switch language (SPA, ENG currently supported) |
| CTRL+F           | Starts `detailed/superdetailed` mode |
| CTRL+J           | Ends `detailed/superdetailed` mode |
| CTRL+V           | Starts voice speed control mode (control with `K/J/ENTER`) |
| CTRL+C           | Stops current sound, if twice, exits `treader` |
| CTRL+D CTRL+Z           | Stops `treader` process |

