import { describe, expect, it } from 'vitest';

import { memoryLogger } from './helpers.js';

const SECRETS = [
  'mint tea',
  'Pepperoni pizza',
  'BASE64PHOTO',
  'Bearer eyJhbGci',
  'Peppermint',
  'acidic tomato',
];

describe('log redaction', () => {
  it('never writes food text, photos, analysis content or tokens', () => {
    const { logger, lines } = memoryLogger();

    logger.info({ body: { text: 'mint tea' } }, 'top-level body');
    logger.info(
      { req: { body: { text: 'mint tea' }, headers: { authorization: 'Bearer eyJhbGci' } } },
      'nested',
    );
    logger.info({ text: 'mint tea', photo: 'BASE64PHOTO', image: 'BASE64PHOTO' }, 'inputs');
    logger.info(
      {
        analysis: { mealName: 'Pepperoni pizza' },
        mealName: 'Pepperoni pizza',
        items: [{ name: 'Mint tea', ingredients: ['Peppermint'] }],
        reasoning: 'acidic tomato',
      },
      'outputs',
    );
    logger.info(
      { claude: { input: 'mint tea', output: 'Pepperoni pizza' }, token: 'Bearer eyJhbGci' },
      'claude',
    );

    const output = lines.join('\n');
    for (const secret of SECRETS) {
      expect(output).not.toContain(secret);
    }
    expect(lines).toHaveLength(5);
    expect(output).toContain('[REDACTED]');
  });

  it('never writes the conditions or details a user states (health data)', () => {
    const { logger, lines } = memoryLogger();

    logger.info({ conditions: ['gastritis'], req: { conditions: ['lpr'], details: 'no chili' } }, 'stated');

    const output = lines.join('\n');
    for (const secret of ['gastritis', 'lpr', 'no chili']) expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
  });

  it('emits Cloud Logging severity and Error Reporting fields for errors', () => {
    const { logger, parsed } = memoryLogger();

    logger.error({ err: new Error('boom') }, 'request failed');

    const [line] = parsed();
    expect(line).toMatchObject({
      severity: 'ERROR',
      message: 'request failed',
      '@type': 'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
    });
    expect(line?.stack_trace).toContain('Error: boom');
  });
});
