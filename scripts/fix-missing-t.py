#!/usr/bin/env python3
"""
Fix: Add `const { t } = useTranslation()` to every function scope that uses t()
but doesn't have it. Uses brace-counting to find function boundaries.
"""

import re
import sys
from pathlib import Path

UI_SRC = Path(__file__).parent.parent / "ui" / "src"


def find_function_scopes(content: str):
    """
    Find all function scopes: their opening brace position and the line where
    the brace is. Returns list of (open_brace_pos, indent).
    """
    scopes = []
    i = 0
    lines = content.split('\n')
    
    # Build line->offset mapping
    line_offsets = [0]
    for line in lines:
        line_offsets.append(line_offsets[-1] + len(line) + 1)
    
    def pos_to_line(pos):
        for li in range(len(line_offsets) - 1):
            if line_offsets[li] <= pos < line_offsets[li + 1]:
                return li
        return len(lines) - 1
    
    # Find function declarations
    patterns = [
        # function Name(...)  {
        r'(?:export\s+)?(?:default\s+)?function\s+\w+\s*(?:<[^>]*>)?\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{',
        # const Name = (...) => {
        r'(?:export\s+)?(?:default\s+)?const\s+\w+\s*(?::\s*[^=]+)?\s*=\s*(?:memo\s*\(\s*)?(?:function\s*)?\([^)]*\)\s*(?::\s*[^=>{]+)?\s*=>\s*\{',
        # const Name = memo(function(
        r'(?:export\s+)?const\s+\w+\s*=\s*memo\s*\(\s*function\s*\w*\s*\([^)]*\)\s*\{',
    ]
    
    for pattern in patterns:
        for m in re.finditer(pattern, content):
            # Find the opening brace
            brace_pos = m.group().rfind('{')
            actual_pos = m.start() + brace_pos
            scopes.append(actual_pos)
    
    return scopes


def find_scope_body(content: str, open_brace_pos: int):
    """Find the range of a function body given its opening brace position."""
    depth = 0
    i = open_brace_pos
    while i < len(content):
        ch = content[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return (open_brace_pos, i)
        elif ch == '"' or ch == "'":
            # Skip string literals
            quote = ch
            i += 1
            while i < len(content) and content[i] != quote:
                if content[i] == '\\':
                    i += 1
                i += 1
        elif ch == '`':
            # Skip template literals
            i += 1
            while i < len(content) and content[i] != '`':
                if content[i] == '\\':
                    i += 1
                i += 1
        elif ch == '/' and i + 1 < len(content):
            if content[i + 1] == '/':
                # Line comment
                while i < len(content) and content[i] != '\n':
                    i += 1
            elif content[i + 1] == '*':
                # Block comment
                i += 2
                while i < len(content) - 1:
                    if content[i] == '*' and content[i + 1] == '/':
                        i += 1
                        break
                    i += 1
        i += 1
    return None


def fix_file(filepath: str) -> bool:
    with open(filepath, 'r') as f:
        content = f.read()
    
    if 't(' not in content:
        return False
    
    # Ensure import exists
    if 'useTranslation' not in content or 'from "react-i18next"' not in content:
        return False  # Import should already be added by main script
    
    scopes = find_function_scopes(content)
    if not scopes:
        return False
    
    # Sort scopes by position (we need to process from bottom to top to keep offsets valid)
    scopes.sort(reverse=True)
    
    modified = False
    for open_brace_pos in scopes:
        body_range = find_scope_body(content, open_brace_pos)
        if not body_range:
            continue
        
        body_start, body_end = body_range
        body = content[body_start:body_end + 1]
        
        # Check if body contains t() calls (not in nested function scopes)
        if not re.search(r'\bt\s*\(\s*["\']', body):
            continue
        
        # Check if body already has useTranslation
        # Look only at the top level of this function (not nested functions)
        # Simple check: is there useTranslation before the first nested function?
        first_lines = body[:500]  # Check first 500 chars
        if 'useTranslation' in first_lines:
            continue
        
        # Find indentation
        # Look at the line after the opening brace
        after_brace = content[body_start + 1:]
        indent_match = re.match(r'\n(\s*)', after_brace)
        if indent_match:
            indent = indent_match.group(1)
        else:
            indent = '  '
        
        # Insert `const { t } = useTranslation();` right after opening brace
        insert_text = f'\n{indent}const {{ t }} = useTranslation();'
        content = content[:body_start + 1] + insert_text + content[body_start + 1:]
        modified = True
    
    if modified:
        with open(filepath, 'w') as f:
            f.write(content)
    
    return modified


def main():
    error_files = [
        "components/ActivityCharts.tsx",
        "components/AgentConfigForm.tsx",
        "components/AgentIconPicker.tsx",
        "components/ApprovalCard.tsx",
        "components/ApprovalPayload.tsx",
        "components/BudgetIncidentCard.tsx",
        "components/BudgetPolicyCard.tsx",
        "components/CommentThread.tsx",
        "components/IssueDocumentsSection.tsx",
        "components/JsonSchemaForm.tsx",
        "components/PathInstructionsModal.tsx",
        "components/ProjectProperties.tsx",
        "components/SidebarProjects.tsx",
        "components/ToastViewport.tsx",
        "components/agent-config-primitives.tsx",
        "components/transcript/RunTranscriptView.tsx",
        "components/ui/breadcrumb.tsx",
        "components/ui/command.tsx",
        "components/ui/dialog.tsx",
        "components/ui/sheet.tsx",
        "pages/AgentDetail.tsx",
        "pages/Costs.tsx",
        "pages/Inbox.tsx",
        "pages/PluginSettings.tsx",
        "pages/ProjectDetail.tsx",
        "pages/RunTranscriptUxLab.tsx",
    ]
    
    fixed = 0
    for rel_path in error_files:
        filepath = str(UI_SRC / rel_path)
        if Path(filepath).exists():
            if fix_file(filepath):
                print(f"  ✓ Fixed {rel_path}")
                fixed += 1
            else:
                print(f"  - Skipped {rel_path}")
    
    print(f"\nFixed {fixed} files")


if __name__ == "__main__":
    main()
