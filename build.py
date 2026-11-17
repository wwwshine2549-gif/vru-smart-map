#!/usr/bin/env python3
"""Build index.html = v05_template.html with /*DATA*/ replaced by data_pdf.js"""
from pathlib import Path
root = Path(__file__).parent
tpl = (root / 'v05_template.html').read_text(encoding='utf-8')
assert '/*DATA*/' in tpl
(root / 'index.html').write_text(tpl.replace('/*DATA*/', (root / 'data_pdf.js').read_text(encoding='utf-8')), encoding='utf-8')
print('built index.html')
