// Native export for CV Builder template pages.
// PDF  -> A4 print pipeline (window.print, color-accurate via print CSS).
// DOCX -> real Word document built with the 'docx' library: native paragraphs,
//         headings, bullets and tab-aligned dates. ATS-safe (no text boxes, no
//         multi-column tables) — the colored Modern/Sidebar chrome is rendered
//         as a clean linear document so parsers read it top-to-bottom.
(function () {
  function load(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  var docxReady = null;
  function ensureDocx() {
    if (!docxReady) docxReady = load('https://unpkg.com/docx@8.5.0/build/index.umd.js');
    return docxReady;
  }
  function getData() { return JSON.parse(document.getElementById('resume-data').textContent); }
  function hex(c) { return (c || '#000000').replace('#', '').toUpperCase(); }
  function fmtDate(d) {
    if (!d) return '';
    var m = /^(\d{4})-(\d{2})/.exec(d);
    if (m) { var mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return mo[+m[2] - 1] + ' ' + m[1]; }
    return d;
  }
  function range(a, b, present) {
    return [fmtDate(a), fmtDate(b) || (present ? 'Present' : '')].filter(Boolean).join(' \u2013 ');
  }

  window.exportPDF = function () { window.print(); };

  window.exportDOCX = async function () {
    await ensureDocx();
    var D = window.docx;
    var data = getData();
    var meta = window.META || {};
    var body = meta.fontFamily || 'Calibri';
    var head = meta.headerFontFamily || body;
    var primary = hex(meta.primaryColor || '#000000');
    var accent = hex(meta.accentColor || '#2563EB');
    var basics = data.basics || {};
    var RIGHT_TAB = 9026; // A4 content width @ 1in margins (twips)
    var k = [];

    k.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 40 },
      children: [new D.TextRun({ text: basics.name || '', bold: true, size: 40, font: head, color: primary })] }));
    if (basics.label) k.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 40 },
      children: [new D.TextRun({ text: basics.label, size: 22, color: '555555', font: head })] }));
    var loc = [basics.location && basics.location.city, basics.location && basics.location.region].filter(Boolean).join(', ');
    var contact = [basics.email, basics.phone, basics.url, loc].filter(Boolean).join('  \u00b7  ');
    if (contact) k.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after: 160 },
      children: [new D.TextRun({ text: contact, size: 18, color: '666666', font: body })] }));
    if (basics.summary) k.push(new D.Paragraph({ spacing: { after: 160 },
      children: [new D.TextRun({ text: basics.summary, size: 20, font: body })] }));

    function title(t) {
      return new D.Paragraph({ spacing: { before: 180, after: 60 },
        border: { bottom: { color: primary, style: D.BorderStyle.SINGLE, size: 6 } },
        children: [new D.TextRun({ text: t.toUpperCase(), bold: true, size: 24, color: primary, font: head, characterSpacing: 20 })] });
    }
    function dateRow(t, d) {
      return new D.Paragraph({ tabStops: [{ type: D.TabStopType.RIGHT, position: RIGHT_TAB }], spacing: { after: 20 },
        children: [new D.TextRun({ text: t, bold: true, size: 22, font: body }), new D.TextRun({ text: '\t' + d, size: 20, color: '666666', font: body })] });
    }
    function role(t) { return new D.Paragraph({ spacing: { after: 20 }, children: [new D.TextRun({ text: t, size: 21, color: accent, font: body })] }); }
    function bullet(t) { return new D.Paragraph({ bullet: { level: 0 }, spacing: { after: 20 }, children: [new D.TextRun({ text: t, size: 20, font: body })] }); }
    function plain(t, o) { o = o || {}; return new D.Paragraph({ spacing: { after: o.after || 20 }, children: [new D.TextRun({ text: t, size: o.size || 20, font: body, color: o.color, bold: o.bold })] }); }

    var order = (meta.sectionOrder && meta.sectionOrder.length) ? meta.sectionOrder : ['work', 'education', 'skills', 'volunteer', 'languages'];
    var labels = { work: 'Work Experience', education: 'Education', skills: 'Skills', volunteer: 'Volunteer', languages: 'Languages' };
    order.forEach(function (key) {
      var arr = data[key]; if (!arr || !arr.length) return;
      k.push(title(labels[key] || key));
      if (key === 'work' || key === 'volunteer') {
        arr.forEach(function (j) {
          k.push(dateRow(j.name || j.organization || '', range(j.startDate, j.endDate, true)));
          if (j.position) k.push(role(j.position));
          if (j.summary) k.push(plain(j.summary));
          (j.highlights || []).forEach(function (h) { k.push(bullet(h)); });
        });
      } else if (key === 'education') {
        arr.forEach(function (e) {
          k.push(dateRow(e.institution || '', range(e.startDate, e.endDate)));
          k.push(plain([e.studyType, e.area].filter(Boolean).join(' in '), { size: 21 }));
          if (e.score) k.push(plain('Score: ' + e.score, { size: 20, color: '666666' }));
        });
      } else if (key === 'skills') {
        arr.forEach(function (s) {
          k.push(new D.Paragraph({ spacing: { after: 20 }, children: [
            new D.TextRun({ text: (s.name || '') + (s.level ? ' (' + s.level + ')' : '') + ': ', bold: true, size: 20, font: body }),
            new D.TextRun({ text: (s.keywords || []).join(', '), size: 20, font: body, color: '444444' }) ] }));
        });
      } else if (key === 'languages') {
        arr.forEach(function (l) { k.push(plain((l.language || '') + (l.fluency ? ' \u2013 ' + l.fluency : ''), { size: 20 })); });
      }
    });

    var mg = Math.round((meta.pageMargins || 1) * 1440);
    var doc = new D.Document({ sections: [{ properties: { page: { margin: { top: mg, bottom: mg, left: mg, right: mg } } }, children: k }] });
    var blob = await D.Packer.toBlob(doc);
    var name = (basics.name || 'resume').replace(/\s+/g, '-');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name + '.docx'; a.click();
    URL.revokeObjectURL(a.href);
  };
})();
