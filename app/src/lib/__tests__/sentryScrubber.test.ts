import { scrubBreadcrumb, scrubEvent } from '../sentryScrubber';

describe('scrubEvent', () => {
  it('drops request, user, extra and any non-allowlisted tags or contexts', () => {
    const scrubbed = scrubEvent({
      message: 'logFood: NETWORK',
      request: { data: '{"text":"pepperoni pizza"}' },
      user: { id: 'anon-123' },
      extra: { mealName: 'Pepperoni pizza', symptoms: ['heartburn'] },
      tags: { operation: 'logFood', code: 'NETWORK', requestId: 'r-1', verdict: 'trigger' },
      contexts: { os: { name: 'iOS' }, state: { meal: 'tacos' } },
    });

    expect(scrubbed.request).toBeUndefined();
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.tags).toEqual({ operation: 'logFood', code: 'NETWORK', requestId: 'r-1' });
    expect(scrubbed.contexts).toEqual({ os: { name: 'iOS' } });
    expect(JSON.stringify(scrubbed)).not.toMatch(/pizza|heartburn|tacos|anon-123/);
  });

  it('drops console, UI and network breadcrumbs and strips data from the rest', () => {
    const scrubbed = scrubEvent({
      breadcrumbs: [
        { category: 'console', message: 'saving {"meal":"tacos"}' },
        { category: 'fetch', data: { url: 'https://relay/v1/analyze-food', body: 'mint tea' } },
        { category: 'ui.input', message: 'mint tea' },
        { category: 'navigation', data: { from: '/history/42', to: '/' } },
      ],
    });

    expect(scrubbed.breadcrumbs).toEqual([{ category: 'navigation' }]);
  });
});

describe('scrubBreadcrumb', () => {
  it('returns null for console breadcrumbs', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'x' })).toBeNull();
  });
});
