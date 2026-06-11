import { buildClient } from '@datocms/cma-client-node';

if (!process.env.DATOCMS_API_TOKEN) {
  throw new Error('Missing DATOCMS_API_TOKEN environment variable');
}

export const client = buildClient({
  apiToken: process.env.DATOCMS_API_TOKEN,
});
