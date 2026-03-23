#!/usr/bin/env python3
"""
Simpler approach: for each file with t() errors, find every function that 
contains t() but doesn't call useTranslation(), and add the call.

Uses a character-level parser to handle multi-line function signatures.
"""

import re
import sys
from pathlib import Path

UI_SRC = Path(__file__).parent.parent / "ui" / "src"


def find_all_function_braces(content: str):
    """
    Find ALL opening braces that start a function body.
    Returns list of positions of opening { characters.
    """
    results = []
    i = 0
    n = len(content)
    
    while i < n:
        ch = content[i]
        
        # Skip strings
        if ch == '"' or ch == "'":
            quote = ch
            i += 1
            while i < n and content[i] != quote:
                if content[i] == '\\': i += 1
                i += 1
            i += 1
            continue
        
        if ch == '`':
            i += 1
            while i < n and content[i] != '`':
                if content[i] == '\\': i += 1
                elif content[i] == '$' and i + 1 < n and content[i + 1] == '{':
                    # Skip template expression
                    depth = 0
                    i += 1
                    while i < n:
                        if content[i] == '{': depth += 1
                        elif content[i] == '}':
                            depth -= 1
                            if depth == 0: break
                        i += 1
                i += 1
            i += 1
            continue
        
        # Skip comments
        if ch == '/' and i + 1 < n:
            if content[i + 1] == '/':
                while i < n and content[i] != '\n': i += 1
                continue
            if content[i + 1] == '*':
                i += 2
                while i < n - 1:
                    if content[i] == '*' and content[i + 1] == '/':
                        i += 2
                        break
                    i += 1
                continue
        
        # Check for function keyword
        if ch == 'f' and content[i:i+8] == 'function':
            # Check it's a keyword (not part of identifier)
            if i > 0 and (content[i-1].isalnum() or content[i-1] == '_'):
                i += 1
                continue
            # Find the opening brace
            j = i + 8
            # Skip name, generics, params, return type
            depth = 0
            while j < n:
                if content[j] in ('"', "'", '`'):
                    q = content[j]
                    j += 1
                    while j < n and content[j] != q:
                        if content[j] == '\\': j += 1
                        j += 1
                    j += 1
                    continue
                if content[j] == '(':
                    depth += 1
                elif content[j] == ')':
                    depth -= 1
                elif content[j] == '{' and depth == 0:
                    results.append(j)
                    break
                j += 1
            i = j + 1 if j < n else n
            continue
        
        # Check for => {
        if ch == '=' and i + 1 < n and content[i + 1] == '>':
            j = i + 2
            # Skip whitespace
            while j < n and content[j] in ' \t\n\r': j += 1
            if j < n and content[j] == '{':
                results.append(j)
                i = j + 1
                continue
            i = j
            continue
        
        i += 1
    
    return results


def find_matching_brace(content: str, open_pos: int) -> int:
    """Find the matching closing brace for an opening brace."""
    depth = 0
    i = open_pos
    n = len(content)
    while i < n:
        ch = content[i]
        if ch == '"' or ch == "'":
            q = ch
            i += 1
            while i < n and content[i] != q:
                if content[i] == '\\': i += 1
                i += 1
            i += 1
            continue
        if ch == '`':
            i += 1
            while i < n and content[i] != '`':
                if content[i] == '\\': i += 1
                elif content[i] == '$' and i + 1 < n and content[i + 1] == '{':
                    bd = 0
                    i += 1
                    while i < n:
                        if content[i] == '{': bd += 1
                        elif content[i] == '}':
                            bd -= 1
                            if bd == 0: break
                        i += 1
                i += 1
            i += 1
            continue
        if ch == '/' and i + 1 < n:
            if content[i + 1] == '/':
                while i < n and content[i] != '\n': i += 1
                continue
            if content[i + 1] == '*':
                i += 2
                while i < n - 1:
                    if content[i] == '*' and content[i + 1] == '/':
                        i += 2
                        break
                    i += 1
                continue
        if ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def get_indent_after(content: str, pos: int) -> str:
    """Get the indentation of the line after pos."""
    nl = content.find('\n', pos)
    if nl == -1: return '  '
    line_start = nl + 1
    m = re.match(r'(\s*)', content[line_start:])
    return m.group(1) if m else '  '


def fix_file(filepath: str) -> bool:
    with open(filepath, 'r') as f:
        content = f.read()
    
    if 'useTranslation' not in content:
        return False
    
    braces = find_all_function_braces(content)
    if not braces:
        return False
    
    # Process from bottom to top to preserve positions
    braces.sort(reverse=True)
    
    modified = False
    for brace_pos in braces:
        close_pos = find_matching_brace(content, brace_pos)
        if close_pos == -1:
            continue
        
        body = content[brace_pos:close_pos + 1]
        
        # Check if body uses t()
        if not re.search(r'\bt\s*\(\s*["\']', body):
            continue
        
        # Check if body already has useTranslation (in its first ~300 chars)
        first_part = body[:300]
        if 'useTranslation' in first_part:
            continue
        
        # Check if t is received as a parameter (not from useTranslation)
        # Look at the function signature before the brace
        sig_start = max(0, brace_pos - 500)
        sig = content[sig_start:brace_pos]
        # If `t` appears as a parameter name, skip
        if re.search(r'[\({,]\s*t\s*[,\})]', sig):
            continue
        
        # Add useTranslation
        indent = get_indent_after(content, brace_pos)
        insert = f'\n{indent}const {{ t }} = useTranslation();'
        content = content[:brace_pos + 1] + insert + content[brace_pos + 1:]
        modified = True
    
    if modified:
        with open(filepath, 'w') as f:
            f.write(content)
    
    return modified


def main():
    error_files = [
        "components/AgentConfigForm.tsx",
        "components/ApprovalCard.tsx",
        "components/BudgetIncidentCard.tsx",
        "components/BudgetPolicyCard.tsx",
        "components/IssueDocumentsSection.tsx",
        "components/JsonSchemaForm.tsx",
        "components/ProjectProperties.tsx",
        "components/SidebarProjects.tsx",
        "components/ToastViewport.tsx",
        "components/agent-config-primitives.tsx",
        "pages/AgentDetail.tsx",
        "pages/Costs.tsx",
        "pages/Inbox.tsx",
        "pages/ProjectDetail.tsx",
    ]
    
    fixed = 0
    for rel_path in error_files:
        filepath = str(UI_SRC / rel_path)
        if Path(filepath).exists():
            if fix_file(filepath):
                print(f"  ✓ Fixed {rel_path}")
                fixed += 1
            else:
                print(f"  - No changes needed: {rel_path}")
    
    print(f"\nFixed {fixed} files")


if __name__ == "__main__":
    main()
