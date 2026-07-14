import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('**bold** and _italic_');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders lists and links', () => {
    const html = renderMarkdown('- item one\n- [link](https://example.com)');
    expect(html).toContain('<li>item one</li>');
    expect(html).toContain('<a href="https://example.com"');
  });

  it('converts single newlines to line breaks', () => {
    expect(renderMarkdown('line one\nline two')).toContain('<br>');
  });

  it('strips script tags', () => {
    const html = renderMarkdown('hello <script>alert(1)</script>');
    expect(html).not.toContain('<script');
    expect(html).toContain('hello');
  });

  it('strips event handler attributes', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
  });

  it('strips javascript: URLs', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });
});
