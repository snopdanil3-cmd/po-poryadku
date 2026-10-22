/* Мини-преобразователь LaTeX → MathML.
   Нужен, чтобы формулы показывались без внешних библиотек (браузер рисует MathML сам).
   Поддерживает то, что используется в содержании: дроби, корни, степени, индексы,
   модуль, скобки, основные знаки. Содержание остаётся в обычном LaTeX,
   поэтому позже можно подключить KaTeX без правки уроков. */
(function (root) {
  'use strict';

  var SYM = {
    cdot: '⋅', times: '×', div: '÷', pm: '±', mp: '∓',
    equiv: '≡', not: '¬', ne: '≠', neq: '≠', le: '≤', leq: '≤', ge: '≥', geq: '≥',
    approx: '≈', sim: '∼', cong: '≅', simeq: '≃', Rightarrow: '⇒', Leftrightarrow: '⇔', iff: '⇔', to: '→',
    infty: '∞', in: '∈', cup: '∪', vee: '∨', subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇', ni: '∋', lor: '∨', wedge: '∧', land: '∧', cap: '∩', ldots: '…', dots: '…', cdots: '⋯',
    varnothing: '∅', emptyset: '∅', '%': '%', '{': '{', '}': '}', '|': '‖', angle: '∠', circ: '∘', perp: '⊥',
    parallel: '∥', triangle: '△', pi: 'π', alpha: 'α', beta: 'β',
    gamma: 'γ', varphi: 'φ', lambda: 'λ', mu: 'μ', theta: 'θ', delta: 'δ', Delta: 'Δ', sigma: 'σ', omega: 'ω', rho: 'ρ', varepsilon: 'ε', cos: 'cos', sin: 'sin', tg: 'tg', ctg: 'ctg', log: 'log',
    lg: 'lg', ln: 'ln', arcsin: 'arcsin', arccos: 'arccos', arctan: 'arctan', arctg: 'arctg', max: 'max', min: 'min', notin: '∉', gtrless: '≷', lessgtr: '≶', sqrt: ''
  };
  var FUNCS = { cos: 1, sin: 1, tg: 1, ctg: 1, log: 1, lg: 1, ln: 1, arcsin: 1, arccos: 1, arctan: 1, arctg: 1, max: 1, min: 1 };
  var SPACE = { ',': '0.17em', ';': '0.28em', ':': '0.22em', ' ': '0.28em', quad: '1em', qquad: '2em' };

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function parse(src) {
    var i = 0;

    function skipWs() { while (i < src.length && /\s/.test(src[i])) i++; }
    function item(s, extra) { var o = { s: s }; if (extra) for (var k in extra) o[k] = extra[k]; return o; }
    function wrap(arr, from) {
      var parts = arr.splice(from).map(function (x) { return x.s; });
      return item('<mrow>' + parts.join('') + '</mrow>');
    }

    function readGroup() {            // читает {...} или один символ
      skipWs();
      if (src[i] === '{') {
        i++;
        var inner = seq('}');
        if (src[i] === '}') i++;
        return '<mrow>' + inner.map(function (x) { return x.s; }).join('') + '</mrow>';
      }
      if (/[0-9]/.test(src[i] || '')) return '<mn>' + src[i++] + '</mn>';   // как в TeX: один символ
      var atom = readAtom();
      return atom ? atom.s : '<mrow></mrow>';
    }

    function readRaw() {              // сырой текст группы {...}
      skipWs();
      if (src[i] !== '{') return '';
      var depth = 0, start = i + 1;
      for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
      }
      var raw = src.slice(start, i);
      i++;
      return raw;
    }

    function readNumber() {
      var s = '';
      while (i < src.length) {
        if (/[0-9]/.test(src[i])) { s += src[i++]; }
        else if (src.substr(i, 3) === '{,}' && /[0-9]/.test(src[i + 3] || '') && s) { s += ','; i += 3; }
        else if (src[i] === '.' && /[0-9]/.test(src[i + 1] || '') && s) { s += src[i++]; }
        else break;
      }
      return item('<mn>' + s + '</mn>');
    }

    function commandName() {
      i++;                            // пропустили «\»
      var name = '';
      if (/[a-zA-Z]/.test(src[i] || '')) {
        while (i < src.length && /[a-zA-Z]/.test(src[i])) name += src[i++];
      } else {
        name = src[i++] || '';
      }
      return name;
    }

    function readCommand(name) {
      switch (name) {
        case 'dfrac': case 'frac': case 'tfrac': {
          var a = readGroup(), b = readGroup();
          var f = '<mfrac>' + a + b + '</mfrac>';
          return item(name === 'dfrac' ? '<mstyle displaystyle="true">' + f + '</mstyle>' : f);
        }
        case 'sqrt': {
          skipWs();
          if (src[i] === '[') {
            var j = src.indexOf(']', i), idx = src.slice(i + 1, j);
            i = j + 1;
            var rad = readGroup();
            return item('<mroot>' + rad + '<mrow>' + parse(idx) + '</mrow></mroot>');
          }
          return item('<msqrt>' + readGroup() + '</msqrt>');
        }
        case 'text': case 'mathrm': case 'textbf':
          return item('<mtext>' + esc(readRaw()) + '</mtext>');
        case ',': case ';': case ':': case ' ': case 'quad': case 'qquad':
          return item('<mspace width="' + SPACE[name] + '"></mspace>');
        case 'begin': {
          var env = readRaw(), tag = '\\end{' + env + '}', j2 = src.indexOf(tag, i);
          if (j2 < 0) throw new Error('no end');
          var body = src.slice(i, j2); i = j2 + tag.length;
          var rows = body.split('\\\\').map(function (r) { return r.trim(); }).filter(Boolean);
          var tbl = '<mtable columnalign="left" rowspacing="0.45em">' + rows.map(function (r) { return '<mtr><mtd>' + parse(r) + '</mtd></mtr>'; }).join('') + '</mtable>';
          return item(env === 'cases' ? '<mrow><mo stretchy="true" symmetric="true">{</mo>' + tbl + '</mrow>' : '<mrow>' + tbl + '</mrow>');
        }
        case 'vec': case 'overrightarrow':
          return item('<mover><mrow>' + readGroup() + '</mrow><mo stretchy="false">\u2192</mo></mover>');
        case '!': return item('');
        case 'bigl': case 'bigr': case 'Bigl': case 'Bigr': case 'big': case 'Big': case 'biggl': case 'biggr': return item('');
        case 'pmod': return item('<mrow><mspace width="0.5em"></mspace><mo>(</mo><mi mathvariant="normal">mod</mi><mspace width="0.3em"></mspace>' + readGroup() + '<mo>)</mo></mrow>');
        case 'bar': case 'overline': return item('<mrow class="ovl">' + readGroup() + '</mrow>');
        case 'binom': { var bn = readGroup(), bk = readGroup(); return item('<mrow><mo>(</mo><mfrac linethickness="0">' + bn + bk + '</mfrac><mo>)</mo></mrow>'); }
        case 'int': return item('<mo largeop="true" movablelimits="false">\u222b</mo>');
        case 'lim': return item('<mi mathvariant="normal">lim</mi>', { lim: 1 });
        case 'mathbb': return item('<mi>' + esc(readRaw()) + '</mi>');
        case 'operatorname': return item('<mi mathvariant="normal">' + esc(readRaw()) + '</mi><mo>\u2061</mo>');
        default:
          if (FUNCS[name]) return item('<mi mathvariant="normal">' + SYM[name] + '</mi><mo>\u2061</mo>');
          if (SYM[name] !== undefined) {
            if (SYM[name].length === 1 && /[\u0370-\u03FF]/.test(SYM[name])) return item('<mi>' + SYM[name] + '</mi>');
            if (name === 'varnothing' || name === 'emptyset') return item('<mi mathvariant="normal">\u2205</mi>');
            return item('<mo>' + esc(SYM[name]) + '</mo>');
          }
          return item('<mtext>' + esc('\\' + name) + '</mtext>');
      }
    }

    function readAtom() {
      skipWs();
      var c = src[i];
      if (c === undefined) return null;
      if (c === '{') return item(readGroup());
      if (c === '\\') return readCommand(commandName());
      if (/[0-9]/.test(c)) return readNumber();
      i++;
      if (/[a-zA-Z]/.test(c)) return item('<mi>' + c + '</mi>');
      if (/[\u0400-\u04FF]/.test(c)) return item('<mi mathvariant="normal">' + c + '</mi>');
      if (c === '-') return item('<mo>\u2212</mo>');
      if (c === "'") return item('<mo>\u2032</mo>');
      if (c === ',' || c === ';') return item('<mo class="msep" lspace="0em" rspace="0.4em">' + c + '</mo>');
      return item('<mo>' + esc(c) + '</mo>');
    }

    function prevItem(out) {          // последний значащий элемент (пробелы не считаются)
      for (var k = out.length - 1; k >= 0; k--) if (out[k].s.indexOf('<mspace') !== 0) return out[k];
      return null;
    }

    function seq(end) {
      var out = [], parens = [], lefts = [], bar = null;
      while (i < src.length) {
        skipWs();
        if (i >= src.length) break;
        var c = src[i];
        if (end && c === end) break;

        if (c === '^' || c === '_') {
          i++;
          var script = readGroup();
          var base = out.length ? out.pop() : item('<mrow></mrow>');
          if (c === '_' && base.lim) {
            out.push(item('<munder>' + base.s + script + '</munder>'));
          } else if (c === '_') {
            out.push(item('<msub>' + base.s + script + '</msub>', { sub: base.s, subs: script }));
          } else if (base.sub) {
            out.push(item('<msubsup>' + base.sub + base.subs + script + '</msubsup>'));
          } else {
            out.push(item('<msup>' + base.s + script + '</msup>'));
          }
          continue;
        }
        if (c === '|') {
          i++;
          var bar_ = '<mo stretchy="true" symmetric="true">|</mo>';
          if (bar === null) { bar = out.length; out.push(item(bar_)); }
          else { out.push(item(bar_)); out.push(wrap(out, bar)); bar = null; }
          continue;
        }
        if (c === '(' || c === '[') {
          i++; parens.push(out.length);
          out.push(item('<mo stretchy="false">' + c + '</mo>'));
          continue;
        }
        if (c === ')' || c === ']') {
          i++;
          out.push(item('<mo stretchy="false">' + c + '</mo>'));
          if (parens.length) out.push(wrap(out, parens.pop()));
          continue;
        }
        if (c === '\\') {
          var save = i, name = commandName();
          if (name === 'left') {
            skipWs();
            var d = src[i++] || '';
            if (d === '\\') { var nm = src[i++]; d = SYM[nm] || nm; }
            lefts.push(out.length);
            out.push(item(d === '.' ? '' : '<mo stretchy="true" symmetric="true">' + esc(d) + '</mo>'));
            continue;
          }
          if (name === 'right') {
            skipWs();
            var d2 = src[i++] || '';
            if (d2 === '\\') { var nm2 = src[i++]; d2 = SYM[nm2] || nm2; }
            out.push(item(d2 === '.' ? '' : '<mo stretchy="true" symmetric="true">' + esc(d2) + '</mo>'));
            if (lefts.length) out.push(wrap(out, lefts.pop()));
            continue;
          }
          if (name === 'limits' || name === 'displaystyle' || name === 'nolimits') continue;
          if (name === 'Big' || name === 'big' || name === 'Bigg' || name === 'bigg') {
            skipWs();
            var bc = src[i++] || '';
            out.push(item('<mo minsize="1.6em" maxsize="1.6em" stretchy="true">' + esc(bc) + '</mo>'));
            continue;
          }
          out.push(readCommand(name));
          continue;
        }
        var atom = readAtom();
        if (atom && atom.s) {
          // унарный знак: после скобки, запятой, «;» и знаков сравнения пробелов вокруг него нет
          if ((atom.s === '<mo>\u2212</mo>' || atom.s === '<mo>+</mo>') &&
              (!prevItem(out) || /<mo[^>]*>(?:\(|\[|\{|;|,|=|&lt;|&gt;|\u2264|\u2265|\u2260|\u222a|\u2229|\u2208|\u21d2|\u21d4|\u2192|\u22c5|\u00d7|\u00b1)<\/mo>$/.test(prevItem(out).s))) {
            atom.s = atom.s.replace('<mo>', '<mo form="prefix">');
          }
          out.push(atom);
        }
      }
      return out;
    }

    return seq(null).map(function (x) { return x.s; }).join('');
  }

  function texToMathML(tex, display) {
    var body;
    try { body = parse(tex); } catch (e) { return '<span class="mathbad">' + esc(tex) + '</span>'; }
    return '<math xmlns="http://www.w3.org/1998/Math/MathML"' + (display ? ' display="block"' : '') +
      '><mrow>' + body + '</mrow></math>';
  }

  /* Заменяет $$…$$ и $…$ в готовой HTML-строке (только для нашего содержания). */
  function renderHtml(html) {
    if (html == null) return '';
    return String(html)
      .replace(/\$\$([\s\S]+?)\$\$/g, function (_, t) { return '<span class="mdisp">' + texToMathML(t, true) + '</span>'; })
      .replace(/\$([^$]+?)\$([,;](?=\s))?/g, function (_, t, p) {
        var m = texToMathML(t, false);
        // запятая после формулы остаётся на одной строке с ней и отделяется от следующей формулы
        return p ? '<span class="mj">' + m + '<span class="msep">' + p + '</span></span>' : m;
      });
  }

  root.MJ = { render: renderHtml, tex: texToMathML };
})(window);
