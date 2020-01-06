/*
 * Treader Read Eval Print Loop
 *
 * Copyright (c) 2020 Carlos Alberto Castaño G.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import * as std from "std";
import * as os from "os";

(function(g) {
    g.os = os;
    g.std = std;

    const KEY_CODES = {
      ENTER: 13,
      CTRL_L: 12,
      CTRL_S: 19,
      CTRL_F: 6,
      CTRL_J: 10,
      CTRL_H: 8,
      CTRL_D: 0,
      CTRL_Z: 0,
    }

    let cur_language = null;
    let mode = 0
    let word = ''
    let lastSay = {
      0: null,
      1: null,
      2: null
    }
    let lastLang = null

    /* close global objects */
    var String = g.String;
    var Math = g.Math;

    /* XXX: use preprocessor ? */
    var config_numcalc = (typeof os.open === "undefined");
    var has_jscalc = (typeof Fraction === "function");
    var has_bignum = (typeof BigFloat === "function");

    var colors = {
        none:    "\x1b[0m",
        black:   "\x1b[30m",
        red:     "\x1b[31m",
        green:   "\x1b[32m",
        yellow:  "\x1b[33m",
        blue:    "\x1b[34m",
        magenta: "\x1b[35m",
        cyan:    "\x1b[36m",
        white:   "\x1b[37m",
        gray:    "\x1b[30;1m",
        grey:    "\x1b[30;1m",
        bright_red:     "\x1b[31;1m",
        bright_green:   "\x1b[32;1m",
        bright_yellow:  "\x1b[33;1m",
        bright_blue:    "\x1b[34;1m",
        bright_magenta: "\x1b[35;1m",
        bright_cyan:    "\x1b[36;1m",
        bright_white:   "\x1b[37;1m",
    };

    var styles;
    if (config_numcalc) {
        styles = {
            'default':    'black',
            'comment':    'white',
            'string':     'green',
            'regex':      'cyan',
            'number':     'green',
            'keyword':    'blue',
            'function':   'gray',
            'type':       'bright_magenta',
            'identifier': 'yellow',
            'error':      'bright_red',
            'result':     'black',
            'error_msg':  'bright_red',
        };
    } else {
        styles = {
            'default':    'bright_green',
            'comment':    'white',
            'string':     'bright_cyan',
            'regex':      'cyan',
            'number':     'green',
            'keyword':    'bright_white',
            'function':   'bright_yellow',
            'type':       'bright_magenta',
            'identifier': 'bright_green',
            'error':      'red',
            'result':     'bright_white',
            'error_msg':  'bright_red',
        };
    }

    var history = [];
    var clip_board = "";
    var prec;
    var expBits;
    var log2_10;

    var pstate = "";
    var prompt = "";
    var plen = 0;
    var ps1 = "treader $ ";
    var ps2 = "  ... ";
    var utf8 = true;
    var show_time = false;
    var show_colors = true;
    var eval_time = 0;

    var mexpr = "";
    var level = 0;
    var cmd = "";
    var cursor_pos = 0;
    var last_cmd = "";
    var last_cursor_pos = 0;
    var history_index;
    var this_fun, last_fun;
    var quote_flag = false;

    var utf8_state = 0;
    var utf8_val = 0;

    var term_fd;
    var term_read_buf;
    var term_width;
    /* current X position of the cursor in the terminal */
    var term_cursor_x = 0;

    function termInit() {
        var tab;
        term_fd = std.in.fileno();

        /* get the terminal size */
        term_width = 80;
        if (os.isatty(term_fd)) {
            if (os.ttyGetWinSize) {
                tab = os.ttyGetWinSize(term_fd);
                if (tab)
                    term_width = tab[0];
            }
            if (os.ttySetRaw) {
                /* set the TTY to raw mode */
                os.ttySetRaw(term_fd);
            }
        }

        /* install a Ctrl-C signal handler */
        os.signal(os.SIGINT, sigint_handler);

        /* install a handler to read stdin */
        term_read_buf = new Uint8Array(64);
        os.setReadHandler(term_fd, term_read_handler);
    }

    function sigint_handler() {
        // send Ctrl-C to readline
        //os.exec(['rm', 'std.out'])
        handle_byte(3);
    }

    function term_read_handler() {
        var l, i;
        l = os.read(term_fd, term_read_buf.buffer, 0, term_read_buf.length);
        for(i = 0; i < l; i++)
            handle_byte(term_read_buf[i]);
    }

    function handle_byte(c) {
        if (!utf8) {
            handle_char(c);
        } else if (utf8_state !== 0 && (c >= 0x80 && c < 0xc0)) {
            utf8_val = (utf8_val << 6) | (c & 0x3F);
            utf8_state--;
            if (utf8_state === 0) {
                handle_char(utf8_val);
            }
        } else if (c >= 0xc0 && c < 0xf8) {
            utf8_state = 1 + (c >= 0xe0) + (c >= 0xf0);
            utf8_val = c & ((1 << (6 - utf8_state)) - 1);
        } else {
            utf8_state = 0;
            handle_char(c);
        }
    }

    function is_alpha(c) {
        return typeof c === "string" &&
            ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z'));
    }

    function is_digit(c) {
        return typeof c === "string" && (c >= '0' && c <= '9');
    }

    function is_word(c) {
        return typeof c === "string" &&
            (is_alpha(c) || is_digit(c) || c == '_' || c == '$');
    }

    function print_color_text(str, start, style_names) {
        var i, j;
        for (j = start; j < str.length;) {
            //var style = style_names[i = j];
            //while (++j < str.length && style_names[j] == style)
            //    continue;
            //std.puts(colors[styles[style] || 'default']);
            std.puts(str.substring(i, j));
            //std.puts(colors['none']);
        }
    }

    function print_csi(n, code) {
        std.puts("\x1b[" + ((n != 1) ? n : "") + code);
    }

    function move_cursor(delta) {
        var i, l;
        if (delta > 0) {
            while (delta != 0) {
                if (term_cursor_x == (term_width - 1)) {
                    std.puts("\n"); // translated to CRLF
                    term_cursor_x = 0;
                    delta--;
                } else {
                    l = Math.min(term_width - 1 - term_cursor_x, delta);
                    print_csi(l, "C"); // right
                    delta -= l;
                    term_cursor_x += l;
                }
            }
        } else {
            delta = -delta;
            while (delta != 0) {
                if (term_cursor_x == 0) {
                    print_csi(1, "A"); // up
                    print_csi(term_width - 1, "C"); // right
                    delta--;
                    term_cursor_x = term_width - 1;
                } else {
                    l = Math.min(delta, term_cursor_x);
                    print_csi(l, "D"); // left
                    delta -= l;
                    term_cursor_x -= l;
                }
            }
        }
    }

    function update() {
        var i;

        if (cmd != last_cmd) {
            if (!show_colors && last_cmd.substring(0, last_cursor_pos) == cmd.substring(0, last_cursor_pos)) {
                // optimize common case
                std.puts(cmd.substring(last_cursor_pos));
            } else {
                // goto the start of the line
                move_cursor(-last_cursor_pos);
                std.puts(cmd);
                /*if (show_colors) {
                    var str = mexpr ? mexpr + '\n' + cmd : cmd;
                    var start = str.length - cmd.length;
                    var colorstate = colorize_js(str);
                    print_color_text(str, start, colorstate[2]);
                } else {
                    std.puts(cmd);
                }*/
            }
            // Note: assuming no surrogate pairs
            term_cursor_x = (term_cursor_x + cmd.length) % term_width;
            if (term_cursor_x == 0) {
                // show the cursor on the next line
                std.puts(" \x08");
            }
            // remove the trailing characters
            std.puts("\x1b[J");
            last_cmd = cmd;
            last_cursor_pos = cmd.length;
        }
        move_cursor(cursor_pos - last_cursor_pos);
        last_cursor_pos = cursor_pos;
        std.out.flush();
    }

    // editing commands
    function insert(str) {
        if (str) {
            cmd = cmd.substring(0, cursor_pos) + str + cmd.substring(cursor_pos);
            cursor_pos += str.length;
        }
    }

    function quoted_insert() {
        quote_flag = true;
    }

    function abort() {
        cmd = "";
        cursor_pos = 0;
        return -2;
    }

    function alert() {
      os.exec(["afplay", "/System/Library/Sounds/Funk.aiff"], { block: false });
    }

    function beginning_of_line() {
        cursor_pos = 0;
    }

    function end_of_line() {
        cursor_pos = cmd.length;
    }

    function forward_char() {
        if (cursor_pos < cmd.length)
            cursor_pos++;
    }

    function backward_char() {
        if (cursor_pos > 0)
            cursor_pos--;
    }

    function skip_word_forward(pos) {
        while (pos < cmd.length && !is_word(cmd.charAt(pos)))
            pos++;
        while (pos < cmd.length && is_word(cmd.charAt(pos)))
            pos++;
        return pos;
    }

    function skip_word_backward(pos) {
        while (pos > 0 && !is_word(cmd.charAt(pos - 1)))
            pos--;
        while (pos > 0 && is_word(cmd.charAt(pos - 1)))
            pos--;
        return pos;
    }

    function forward_word() {
        cursor_pos = skip_word_forward(cursor_pos);
    }

    function backward_word() {
        cursor_pos = skip_word_backward(cursor_pos);
    }

    function accept_line() {
        std.puts("\n");
        history_add(cmd);
        return -1;
    }

    function history_add(str) {
        if (str) {
            history.push(str);
        }
        history_index = history.length;
    }

    function previous_history() {
        if (history_index > 0) {
            if (history_index == history.length) {
                history.push(cmd);
            }
            history_index--;
            cmd = history[history_index];
            cursor_pos = cmd.length;
        }
    }

    function next_history() {
        if (history_index < history.length - 1) {
            history_index++;
            cmd = history[history_index];
            cursor_pos = cmd.length;
        }
    }

    function history_search(dir) {
        var pos = cursor_pos;
        for (var i = 1; i <= history.length; i++) {
            var index = (history.length + i * dir + history_index) % history.length;
            if (history[index].substring(0, pos) == cmd.substring(0, pos)) {
                history_index = index;
                cmd = history[index];
                return;
            }
        }
    }

    function history_search_backward() {
        return history_search(-1);
    }

    function history_search_forward() {
        return history_search(1);
    }

    function delete_char_dir(dir) {
        var start = cursor_pos - (dir < 0);
        var end = start + 1;
        if (start >= 0 && start < cmd.length) {
            if (last_fun === kill_region) {
                kill_region(start, end, dir);
            } else {
                cmd = cmd.substring(0, start) + cmd.substring(end);
                cursor_pos = start;
            }
        }
    }

    function delete_char() {
        delete_char_dir(1);
    }

    function control_d() {
        if (cmd.length == 0) {
            std.puts("\n");
            os.exec(['say', 'Cerrando el asistente'])
            return -3; // exit read eval print loop
        } else {
            delete_char_dir(1);
        }
    }

    function backward_delete_char() {
        delete_char_dir(-1);
    }

    function transpose_chars() {
        var pos = cursor_pos;
        if (cmd.length > 1 && pos > 0) {
            if (pos == cmd.length)
                pos--;
            cmd = cmd.substring(0, pos - 1) + cmd.substring(pos, pos + 1) +
                cmd.substring(pos - 1, pos) + cmd.substring(pos + 1);
            cursor_pos = pos + 1;
        }
    }

    function transpose_words() {
        var p1 = skip_word_backward(cursor_pos);
        var p2 = skip_word_forward(p1);
        var p4 = skip_word_forward(cursor_pos);
        var p3 = skip_word_backward(p4);

        if (p1 < p2 && p2 <= cursor_pos && cursor_pos <= p3 && p3 < p4) {
            cmd = cmd.substring(0, p1) + cmd.substring(p3, p4) +
            cmd.substring(p2, p3) + cmd.substring(p1, p2);
            cursor_pos = p4;
        }
    }

    function upcase_word() {
        var end = skip_word_forward(cursor_pos);
        cmd = cmd.substring(0, cursor_pos) +
            cmd.substring(cursor_pos, end).toUpperCase() +
            cmd.substring(end);
    }

    function downcase_word() {
        var end = skip_word_forward(cursor_pos);
        cmd = cmd.substring(0, cursor_pos) +
            cmd.substring(cursor_pos, end).toLowerCase() +
            cmd.substring(end);
    }

    function kill_region(start, end, dir) {
        var s = cmd.substring(start, end);
        if (last_fun !== kill_region)
            clip_board = s;
        else if (dir < 0)
            clip_board = s + clip_board;
        else
            clip_board = clip_board + s;

        cmd = cmd.substring(0, start) + cmd.substring(end);
        if (cursor_pos > end)
            cursor_pos -= end - start;
        else if (cursor_pos > start)
            cursor_pos = start;
        this_fun = kill_region;
    }

    function kill_line() {
        kill_region(cursor_pos, cmd.length, 1);
    }

    function backward_kill_line() {
        kill_region(0, cursor_pos, -1);
    }

    function kill_word() {
        kill_region(cursor_pos, skip_word_forward(cursor_pos), 1);
    }

    function backward_kill_word() {
        kill_region(skip_word_backward(cursor_pos), cursor_pos, -1);
    }

    function yank() {
        insert(clip_board);
    }

    function control_c() {
        if (last_fun === control_c) {
            std.puts("\n");
            std.exit(0);
        } else {
            os.exec(['say', 'Presiona control C de nuevo para salir'], {block: false})
            std.puts("\n(Presiona Ctrl-C de nuevo para salir)\n");
            readline_print_prompt();
        }
    }

    function reset() {
        cmd = "";
        cursor_pos = 0;
    }

    function completion() {
    }

    var commands = {        // command table
        "\x01":     beginning_of_line,      // ^A - bol
        "\x02":     backward_char,          // ^B - backward-char
        "\x03":     control_c,              // ^C - abort
        "\x04":     control_d,              // ^D - delete-char or exit
        "\x05":     end_of_line,            // ^E - eol
        "\x06":     forward_char,           // ^F - forward-char
        "\x07":     abort,                  // ^G - bell
        "\x08":     backward_delete_char,   // ^H - backspace
        "\x09":     completion,             // ^I - history-search-backward
        "\x0a":     accept_line,            // ^J - newline
        "\x0b":     kill_line,              // ^K - delete to end of line
        "\x0d":     accept_line,            // ^M - enter
        "\x0e":     next_history,           // ^N - down
        "\x10":     previous_history,       // ^P - up
        "\x11":     quoted_insert,          // ^Q - quoted-insert
        "\x12":     alert,                  // ^R - reverse-search
        "\x13":     alert,                  // ^S - search
        "\x14":     transpose_chars,        // ^T - transpose
        "\x18":     reset,                  // ^X - cancel
        "\x19":     yank,                   // ^Y - yank
        "\x1bOA":   previous_history,       // ^[OA - up
        "\x1bOB":   next_history,           // ^[OB - down
        "\x1bOC":   forward_char,           // ^[OC - right
        "\x1bOD":   backward_char,          // ^[OD - left
        "\x1bOF":   forward_word,           // ^[OF - ctrl-right
        "\x1bOH":   backward_word,          // ^[OH - ctrl-left
        "\x1b[1;5C": forward_word,          // ^[[1;5C - ctrl-right
        "\x1b[1;5D": backward_word,         // ^[[1;5D - ctrl-left
        "\x1b[1~":  beginning_of_line,      // ^[[1~ - bol
        "\x1b[3~":  delete_char,            // ^[[3~ - delete
        "\x1b[4~":  end_of_line,            // ^[[4~ - eol
        "\x1b[5~":  history_search_backward,// ^[[5~ - page up
        "\x1b[6~":  history_search_forward, // ^[[5~ - page down
        "\x1b[A":   previous_history,       // ^[[A - up
        "\x1b[B":   next_history,           // ^[[B - down
        "\x1b[C":   forward_char,           // ^[[C - right
        "\x1b[D":   backward_char,          // ^[[D - left
        "\x1b[F":   end_of_line,            // ^[[F - end
        "\x1b[H":   beginning_of_line,      // ^[[H - home
        "\x1b\x7f": backward_kill_word,     // M-C-? - backward_kill_word
        "\x1bb":    backward_word,          // M-b - backward_word
        "\x1bd":    kill_word,              // M-d - kill_word
        "\x1bf":    forward_word,           // M-f - backward_word
        "\x1bk":    backward_kill_line,     // M-k - backward_kill_line
        "\x1bl":    downcase_word,          // M-l - downcase_word
        "\x1bt":    transpose_words,        // M-t - transpose_words
        "\x1bu":    upcase_word,            // M-u - upcase_word
        "\x7f":     backward_delete_char,   // ^? - delete
    };

    function dupstr(str, count) {
        var res = "";
        while (count-- > 0)
            res += str;
        return res;
    }

    var readline_cb;
    var readline_state;
    var readline_keys;

    function readline_print_prompt()
    {
        std.puts(prompt);
        term_cursor_x = prompt.length % term_width;
        last_cmd = "";
        last_cursor_pos = 0;
    }

    function readline_start(defstr, cb) {
        cmd = defstr || "";
        cursor_pos = cmd.length;
        history_index = history.length;
        readline_cb = cb;

        prompt = pstate;

        if (mexpr) {
            prompt += dupstr(" ", plen - prompt.length);
            prompt += ps2;
        } else {
            if (show_time) {
                var t = Math.round(eval_time) + " ";
                eval_time = 0;
                t = dupstr("0", 5 - t.length) + t;
                prompt += t.substring(0, t.length - 4) + "." + t.substring(t.length - 4);
            }
            plen = prompt.length;
            prompt += ps1;
        }
        readline_print_prompt();
        update();
        readline_state = 0;
    }

    function handle_char(c1) {
        if (c1 === KEY_CODES.CTRL_H) {
          os.exec(['say', 'Ayuda del Asistente de Voz en la Terminal'])
          os.exec(['say', `Presiona control C, en cualquier momento para parar el audio.
            Presiona control L, para intercambiar el idioma.
            Presiona control F, para entrar en modo detallado o super detallado.
            Presiona control J, para salir de los modos detallados.
            Presiona control S, para repetir la salida del último comando.
            Si entras en pánico, presiona control Z o control D, para detener el proceso.
          `])
          return;
        } else if (c1 === KEY_CODES.CTRL_F) {
          if (mode === 0) {
            os.exec(['say', 'Activando modo detallado'])
            mode = 1
          } else if (mode === 1) {
            os.exec(['say', 'Activando modo super detallado'])
            mode = 2
          } else {
            os.exec(['say', 'No hay más modos disponibles'])
          }
          alert()
          return;
        } else if (c1 === KEY_CODES.CTRL_J) {
          if (mode === 2) {
            os.exec(['say', 'Desactivando modo ultra detallado'])
            mode = 1
          } else if (mode === 1) {
            os.exec(['say', 'Desactivando modo detallado'])
            mode = 0
          } else {
            os.exec(['say', 'Ya estás en modo normal'])
          }
          alert()
          return;
        } else if (c1 === KEY_CODES.CTRL_S) {
          if (lastSay?.[cur_language || 'es_ES']?.[mode]) {
            globalThis.say({text: lastSay, lang: lastLang})
          } else {
            os.exec(['say', 'No hay nada que repetir.'])
          }
        } else if (c1 === KEY_CODES.CTRL_L) {
          if (!cur_language || cur_language === 'es_ES') {
            os.exec(['say', '-v', 'Daniel', 'Hello, my name is Daniel.'])
            cur_language = 'en_GB'
          } else if (cur_language === 'en_GB') {
            os.exec(['say', '-v', 'Monica', 'Hola, me llamo Monica'])
            cur_language = 'es_ES'
          }
          lastLang = cur_language
          return;

          /*let term_read_buf = new Uint8Array(64);
          let lang = 'Monica'
          os.setReadHandler(term_fd, function() {
            let l;
            let langs = {
              Monica: 'Hola, me llamo Monica y soy una voz española.',
              Daniel: 'Hello, my name is Daniel. I am a British-English voice.'
            }
            l = os.read(term_fd, term_read_buf.buffer, 0, term_read_buf.length);
            for(let i = 0; i < l; i++) {
              if (term_read_buf[i] === 106) {
                os.exec(['say', '-v', lang, langs[lang]])
                lang = lang === 'Monica' ? 'Daniel' : 'Monica'
              } else if (term_read_buf[i] === 13 || term_read_buf[i] === 108) {
                if (lang === 'Daniel') {
                  os.exec(['say', '-v', 'Monica', 'Se ha seleccionado castellano.'])
                  cur_language = 'es_ES'
                } else {
                  os.exec(['say', '-v', 'Daniel', 'You have choosen english.'])
                  cur_language = 'en_GB'
                }
                lastLang = cur_language

                os.setReadHandler(term_fd, term_read_handler)
                if (term_read_buf[i] === 13)
                  handle_byte(term_read_buf[i])
                alert()
              }
            }
          });*/
        }

        var c;
        c = String.fromCharCode(c1);
        switch(readline_state) {
        case 0:
            if (c == '\x1b') {  // '^[' - ESC
                readline_keys = c;
                readline_state = 1;
            } else {
                handle_key(c);
            }
            break;
        case 1: // '^[
            readline_keys += c;
            if (c == '[') {
                readline_state = 2;
            } else if (c == 'O') {
                readline_state = 3;
            } else {
                handle_key(readline_keys);
                readline_state = 0;
            }
            break;
        case 2: // '^[[' - CSI
            readline_keys += c;
            if (!(c == ';' || (c >= '0' && c <= '9'))) {
                handle_key(readline_keys);
                readline_state = 0;
            }
            break;
        case 3: // '^[O' - ESC2
            readline_keys += c;
            handle_key(readline_keys);
            readline_state = 0;
            break;
        }
    }

    function handle_key(keys) {
        var fun;
        if (mode === 2) {
          let keysCopy = keys
            .replace('|', ' páip ')
            .replace('-', ' guión ')
            .replace('_', ' guión bajo ')
            .replace('#', ' numeral ')
            .replace('&', ' ámpersand ')
            .replace('\/', ' barra ')
            .replace('\(', ' abre paréntesis ')
            .replace('\)', ' cierra paréntesis ')
            .replace('\.', ' punto ')
            .replace('\{', ' abre llave ')
            .replace('\}', ' cierra llave ')
            .replace('\[', ' abre corchete ')
            .replace('\]', ' cierra corchete ')
            .replace('\`', ' tílde invertida ')
            .replace('\´', ' tílde ')
            .replace('\*', ' asterísco ')
            .replace('\^', ' gorro ')
            .replace('\'', ' comilla simple ')
            .replace('\"', ' comilla doble ')
            .replace('\\', ' barra invertida ')
            .replace('\<', ' menor que ')
            .replace('\>', ' mayor que ')
            .replace('¿', ' abre interrogación ')
            .replace('¡', ' abre exclamación ')
            .replace('%', ' porcentaje ')

            if (keysCopy === ' ') {
              os.exec(['say', '[[rate 170]] ', `'${word}'`], {block: false});
              word = ''
          } else {
            word += keysCopy
          }
        }

        if (quote_flag) {
            if (keys.length === 1)
                insert(keys);
            quote_flag = false;
        } else if (fun = commands[keys]) {
            this_fun = fun;
            switch (fun(keys)) {
            case -1:
                readline_cb(cmd);
                return;
            case -2:
                readline_cb(null);
                return;
            case -3:
                // uninstall a Ctrl-C signal handler
                os.signal(os.SIGINT, null);
                // uninstall the stdin read handler
                os.setReadHandler(term_fd, null);
                return;
            }
            last_fun = this_fun;
        } else if (keys.length === 1 && keys >= ' ') {
            insert(keys);
            last_fun = insert;
        } else {
            alert(); // beep!
        }

        cursor_pos = (cursor_pos < 0) ? 0 :
            (cursor_pos > cmd.length) ? cmd.length : cursor_pos;
        update();
    }

    var hex_mode = false;

    function extract_directive(a) {
        var pos;
        if (a[0] !== '\\')
            return "";
        for (pos = 1; pos < a.length; pos++) {
            if (!is_alpha(a[pos]))
                break;
        }
        return a.substring(1, pos);
    }

    function get_voice(lang) {
      const mac_voices = {
        'ar_SA':       'Maged',
        'cs_CZ':       'Zuzana',
        'da_DK':       'Sara',
        'de_DE':       'Anna',
        'el_GR':       'Melina',
        'en-scotland': 'Fiona',
        'en_AU':       'Karen',
        'en_GB':       'Daniel',
        'en_IE':       'Moira',
        'en_IN':       'Veena',
        'en_US':       'Alex',
        'en_US':       'Fred',
        'en_US':       'Samantha',
        'en_US':       'Victoria',
        'en_ZA':       'Tessa',
        'es_AR':       'Diego',
        'es_ES':       'Jorge',
        'es_ES':       'Monica',
        'es_MX':       'Juan',
        'es_MX':       'Paulina',
        'fi_FI':       'Satu',
        'fr_CA':       'Amelie',
        'fr_FR':       'Thomas',
        'he_IL':       'Carmit',
        'hi_IN':       'Lekha',
        'hu_HU':       'Mariska',
        'id_ID':       'Damayanti',
        'it_IT':       'Alice',
        'it_IT':       'Luca',
        'ja_JP':       'Kyoko',
        'ko_KR':       'Yuna',
        'nb_NO':       'Nora',
        'nl_BE':       'Ellen',
        'nl_NL':       'Xander',
        'pl_PL':       'Zosia',
        'pt_BR':       'Luciana',
        'pt_PT':       'Joana',
        'ro_RO':       'Ioana',
        'ru_RU':       'Milena',
        'ru_RU':       'Yuri',
        'sk_SK':       'Laura',
        'sv_SE':       'Alva',
        'th_TH':       'Kanya',
        'tr_TR':       'Yelda',
        'zh_CN':       'Ting-Ting',
        'zh_HK':       'Sin-ji',
        'zh_TW':       'Mei-Jia',
      }
      return mac_voices[lang]
    }

    globalThis.say = function(args) {
      let {text, lang, opts} = args

      if (!lang) {
        if (!cur_language) {
          const l = std.popen("osascript -e 'user locale of (get system info)'", 'r')
          lang = l.readAsString().replace('\n', '')
          cur_language = lang
        } else {
          lang = cur_language
        }
      }

      try {
        if (typeof(args) === 'string') {
          text = args
        }
        const finalText = typeof(text) === 'string' ? text : typeof(text[lang]) === 'string' ? text[lang] : text[lang][mode]
        os.exec(['say', '-v', get_voice(lang), finalText], opts || {});
        lastSay = text
        lastLang = lang
      } catch(err) {
        os.exec(['say', '-v', get_voice(lang), `Error intentando vocalizar: ${text}`]);
        throw err
      }
    }

    function eval_and_print(expr) {
        const fullExpr = expr.split(' ')
        const command = fullExpr[0]

        let opts  = '-q' + (os.platform === 'darwin' ? 'F' : 'f')
        os.exec(['script', opts, 'std.out', '/bin/bash', '-c', expr]);

        const out = std.open('./std.out', 'r');
        let line       = out.getline()
        let fullOutput = ''
        let countOut   = 0

        while (!out.eof()) {
          countOut++
          fullOutput += '\n'+line
          line = out.getline()
        }

        let [handlers, errDir] = os.readdir('./handlers');
        const handlerFile = command + '.js'
        if (handlers.includes(handlerFile)) {
          globalThis.expr       = expr
          globalThis.mode       = mode
          globalThis.countOut   = countOut
          globalThis.fullOutput = fullOutput

          try {
            std.loadScript(`./handlers/${handlerFile}`)
          } catch(err) {
            print(err)
            lastSay[0] = `Error cargando script para el comando ${command}: ${err}`
            lastSay[1] = lastSay[0]
            lastSay[2] = lastSay[0]

            os.exec(["say", lastSay[mode]]);
          }
        } else {
          const notFound = 'No such file or directory'
          const commandNotFound = 'command not found'
          const operationNotPermitted = 'Operation not permitted'

          if (fullOutput.includes(notFound)) {
            lastSay[0] = `Archivo o directorio no encontrado`
            lastSay[1] = `Archivo o directorio no encontrado. La salida es: ${fullOutput}`
            lastSay[2] = `Archivo o directorio no encontrado. La salida letra por letra es: [[char LTRL]] ${fullOutput}`
          } else if (fullOutput.includes(commandNotFound)) {
            lastSay[0] = `Comando no encontrado`
            lastSay[1] = `Comando no encontrado. La salida es: ${fullOutput}`
            lastSay[2] = `Comando no encontrado. La salida letra por letra es: [[char LTRL]] ${fullOutput}`
          } else if (fullOutput.includes(operationNotPermitted)) {
            lastSay[0] = `Operación no permitida`
            lastSay[1] = `Operación no permitida. La salida es: ${fullOutput}`
            lastSay[2] = `Operación no permitida. La salida letra por letra es: [[char LTRL]] ${fullOutput}`
          } else {
            lastSay[0] = `Salida de ${countOut} lineas.`
            lastSay[1] = `Salida de ${countOut} lineas. El contenido es: ${fullOutput}`
            lastSay[2] = `Salida de ${countOut} lineas. El contenido letra por letra es: [[char LTRL]] ${fullOutput}`
          }
          os.exec(['say', lastSay[mode]]);
        }
        alert()
    }

    function cmd_start() {
        if (!config_numcalc) {
            std.puts('Bienvenido al Asistente de Voz en la Terminal\n');
            os.exec(['say', 'Bienvenido al Asistente de Voz en la Terminal'], { block: false });
        }

        cmd_readline_start();
    }

    function cmd_readline_start() {
        readline_start(dupstr("    ", level), readline_handle_cmd);
    }

    function readline_handle_cmd(expr) {
        handle_cmd(expr);
        cmd_readline_start();
    }

    function handle_cmd(expr) {
        var colorstate, cmd;

        if (expr === null) {
            expr = "";
            return;
        }
        if (expr === "?") {
            help();
            return;
        }
        cmd = extract_directive(expr);
        if (cmd.length > 0) {
            if (!handle_directive(cmd, expr))
                return;
            expr = expr.substring(cmd.length + 1);
        }
        if (expr === "")
            return;

        if (mexpr)
            expr = mexpr + '\n' + expr;
        //colorstate = colorize_js(expr);
        //pstate = colorstate[0];
        //level = colorstate[1];
        //if (pstate) {
        //    mexpr = expr;
        //    return;
        //}
        mexpr = "";

        eval_and_print(expr);
        level = 0;

        // run the garbage collector after each command
        std.gc();
    }

    function colorize_js(str) {
        return str
    }

    termInit();

    cmd_start();

})(globalThis);
