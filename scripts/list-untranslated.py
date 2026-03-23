#!/usr/bin/env python3
"""
Batch-translate remaining untranslated strings in zh.json.
Outputs a list of key=value pairs for manual review / bulk translation.
"""
import json

en = json.load(open('ui/src/i18n/en.json'))
zh = json.load(open('ui/src/i18n/zh.json'))

BRAND_NAMES = {
    'English', 'Slack', 'Discord', 'Telegram', 'OpenClaw', 'Claude', 'Google', 'GitHub',
    'Paperclip', 'HTTP API', 'URL', 'API', 'JSON',
}

def find_untranslated(en_d, zh_d, prefix=''):
    results = []
    for k, v in en_d.items():
        full = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            zh_v = zh_d.get(k, {})
            results.extend(find_untranslated(v, zh_v, full))
        elif isinstance(v, str):
            zh_v = zh_d.get(k)
            if zh_v is None or (zh_v == v and v not in BRAND_NAMES and len(v) > 2):
                results.append((full, v))
    return results

untranslated = find_untranslated(en, zh)
print(f"Total untranslated: {len(untranslated)}\n")
for key, val in untranslated:
    print(f"{key} = {val}")
