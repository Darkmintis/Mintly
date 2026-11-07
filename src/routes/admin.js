/**
 * Admin-only routes (ADMIN_TOKEN):
 *   POST /v1/apps       create an app + its key (returned once, stored hashed)
 *   POST /v1/registry   declare an event and its allowed button ids
 */

import { generateAppKey, sha256Hex } from '../auth.js';
import { appExists, insertApp, putRegistry } from '../db.js';
import { error, json } from '../http.js';
import { validateAppBody, validateRegistryBody } from '../validate.js';

export async function handleCreateApp(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error(400, 'Invalid JSON body');
  }

  const validation = validateAppBody(body);
  if (!validation.ok) return error(400, validation.error);
  const { app, name } = validation.value;

  if (await appExists(env, app)) return error(409, `App "${app}" already exists`);

  const key = generateAppKey();
  const createdAt = Date.now();
  await insertApp(env, { app, name, keyHash: await sha256Hex(key), createdAt });

  // The only time the key is ever returned. Mintly stores a hash, not the key.
  return json({ app, name, key, createdAt }, 201);
}

export async function handlePutRegistry(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error(400, 'Invalid JSON body');
  }

  const validation = validateRegistryBody(body);
  if (!validation.ok) return error(400, validation.error);
  const { app, event, dim1, dim2 } = validation.value;

  if (!(await appExists(env, app))) return error(404, `Unknown app "${app}"`);

  await putRegistry(env, { app, event, dim1, dim2 });
  return json({ app, event, dim1, dim2 });
}
