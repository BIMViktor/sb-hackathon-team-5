# Calling the StreamBIM REST API from a widget

[Widget API docs](../README.md)

A widget has no StreamBIM token of its own, but `StreamBIM.API.makeApiRequest` sends any request through the StreamBIM page, signed in as the current user. Every endpoint in the [REST docs](../../api/) that the user is allowed to call is reachable this way, without CORS setup or token handling.

What the host does: `storeservice.makeRawRequest(url, body, { method, absoluteUrl: true, accept, contentType })`, with `accept` and `contentType` defaulting to `application/vnd.api+json`. The response body comes back as a **string**.

## URL prefixes

Paths are relative to the StreamBIM origin (`https://app.streambim.com` here). Which prefix to use:

| Prefix | What | Accept header |
|--------|------|---------------|
| `/mgw/api/v3/…` | Account-level JSON:API: projects, users, organisations, project links | default (`application/vnd.api+json`) |
| `/project-{projectId}/api/v1/v2/…` | Project JSON:API: topics, documents, checklists, ifc-objects, members, workflows, trains… | default |
| `/project-{projectId}/api/v1/…` | Project non-JSON:API: `ifc-searches`, `*/export/json/`, `microtoken`, `sync` | either |
| `/bcf/2.1/…` | BCF 2.1 | `application/json` (default fails) |

The `/pgw/project-{id}/…` form used in older notes did **not** work from the widget on app.streambim.com. The full per-endpoint result is in the compatibility table at the end.

## GET and parse a JSON:API document

#### Read the project

```js
const projectId = await StreamBIM.API.getProjectId();
const text = await StreamBIM.API.makeApiRequest({ url: '/mgw/api/v3/projects/' + projectId });
const { data } = JSON.parse(text);
return { id: data.id, type: data.type, attributes: Object.keys(data.attributes) };
```

<details open><summary>Output (verified 2026-11-01, 45 ms)</summary>

```json
{
  "id": "15974",
  "type": "projects",
  "attributes": [
    "bcf-id",
    "coords",
    "created-at",
    "deleted-at",
    "description",
    "external-id",
    "is-hibernated",
    "is-inactive",
    "is-library",
    "location_name",
    "name",
    "project-uri",
    "salesforce-account-id",
    "salesforce-account-name",
    "salesforce-project-id",
    "status",
    "sync_template"
  ]
}
```

</details>

## A reusable request helper

Wrap `makeApiRequest` once: parse JSON, and replace the `DataCloneError` that every HTTP error turns into.

#### Helper + topic statuses

```js
// Reusable helper: JSON-parses responses and turns the opaque clone error into a clear one.
async function sbRequest(path, { method = 'GET', body, accept, contentType } = {}) {
  const opts = { url: path, method };
  if (body !== undefined) opts.body = body;
  if (accept) opts.accept = accept;
  if (contentType) opts.contentType = contentType;
  let text;
  try {
    text = await StreamBIM.API.makeApiRequest(opts);
  } catch (err) {
    if (/could not be cloned/.test(err && err.message)) throw new Error(method + ' ' + path + ' failed (HTTP error; status not exposed to widgets)');
    throw err;
  }
  try { return JSON.parse(text); } catch { return text; }
}

const projectId = await StreamBIM.API.getProjectId();
const statuses = await sbRequest('/project-' + projectId + '/api/v1/v2/topic-statuses');
return statuses.data.map((s) => ({ id: s.id, ...s.attributes }));
```

<details open><summary>Output (verified 2026-11-01, 42 ms)</summary>

```json
[
  {
    "id": "2000",
    "name": "open"
  },
  {
    "id": "3000",
    "name": "done"
  },
  {
    "id": "4000",
    "name": "closed"
  },
  {
    "id": "4500",
    "name": "notRelevant"
  }
]
```

</details>

## List topics with relationships

Project JSON:API lists return `{ data: [...], included?, meta? }`. Related records are ids in `relationships`.

#### First two topics

```js
// Reusable helper: JSON-parses responses and turns the opaque clone error into a clear one.
async function sbRequest(path, { method = 'GET', body, accept, contentType } = {}) {
  const opts = { url: path, method };
  if (body !== undefined) opts.body = body;
  if (accept) opts.accept = accept;
  if (contentType) opts.contentType = contentType;
  let text;
  try {
    text = await StreamBIM.API.makeApiRequest(opts);
  } catch (err) {
    if (/could not be cloned/.test(err && err.message)) throw new Error(method + ' ' + path + ' failed (HTTP error; status not exposed to widgets)');
    throw err;
  }
  try { return JSON.parse(text); } catch { return text; }
}

const projectId = await StreamBIM.API.getProjectId();
const res = await sbRequest('/project-' + projectId + '/api/v1/v2/topics?page[limit]=2&page[skip]=0');
return res.data.map((t) => ({
  id: t.id,
  title: t.attributes.title,
  status: t.relationships && t.relationships.status && t.relationships.status.data,
  relationships: Object.keys(t.relationships || {}),
}));
```

<details open><summary>Output (verified 2026-11-01, 91 ms)</summary>

```json
[
  {
    "id": "4274",
    "title": "area vägg",
    "status": {
      "id": "2000",
      "type": "statuses"
    },
    "relationships": [
      "assigned-to-group",
      "assigned-to-user",
      "attachments",
      "building",
      "changes",
      "checklist-item-instance",
      "comments",
      "creation-author",
      "document-revision",
      "labels",
      "object",
      "preview-attachment",
      "priority",
      "status",
      "topic-classifications",
      "viewpoints",
      "workflow"
    ]
  },
  {
    "id": "4273",
    "title": "",
    "status": {
      "id": "2000",
      "type": "statuses"
    },
    "relationships": [
      "assigned-to-group",
      "assigned-to-user",
      "attachments",
      "building",
      "changes",
      "checklist-item-instance",
      "comments",
      "creation-author",
      "document-revision",
      "labels",
      "object",
      "preview-attachment",
      "priority",
      "status",
      "topic-classifications",
      "viewpoints",
      "workflow"
    ]
  }
]
```

</details>

## POST JSON (IFC search) and export the matches

Non-JSON:API endpoints need `contentType: "application/json"`. This is the same pair of calls `getObjectInfoForSearch` makes, with your own column list.

#### Search windows, export three rows

```js
// Reusable helper: JSON-parses responses and turns the opaque clone error into a clear one.
async function sbRequest(path, { method = 'GET', body, accept, contentType } = {}) {
  const opts = { url: path, method };
  if (body !== undefined) opts.body = body;
  if (accept) opts.accept = accept;
  if (contentType) opts.contentType = contentType;
  let text;
  try {
    text = await StreamBIM.API.makeApiRequest(opts);
  } catch (err) {
    if (/could not be cloned/.test(err && err.message)) throw new Error(method + ' ' + path + ' failed (HTTP error; status not exposed to widgets)');
    throw err;
  }
  try { return JSON.parse(text); } catch { return text; }
}

const projectId = await StreamBIM.API.getProjectId();
const buildingId = await StreamBIM.API.getBuildingId();
const { searchId } = await sbRequest('/project-' + projectId + '/api/v1/ifc-searches', {
  method: 'POST',
  contentType: 'application/json',
  body: { rules: [[{ buildingId, propKey: '@kind', propValue: 'Window' }]] },
});
const fieldNames = btoa('GUID|Name|Long Name');
const rows = await sbRequest('/project-' + projectId + '/api/v1/ifc-searches/export/json?searchId=' + searchId + '&fieldUnion=true&fieldNames=' + fieldNames + '&page[limit]=3&page[skip]=0');
return { searchId, rows: rows.data };
```

<details open><summary>Output (verified 2026-11-01, 106 ms)</summary>

```json
{
  "searchId": "6893758730986978202",
  "rows": [
    {
      "GUID": "0FdTIYaE1DKvQpJiepvyYk",
      "Name": "Single Window:9x13 Inåtgående:2110475",
      "Long Name": "2110475"
    },
    {
      "GUID": "0FdTIYaE1DKvQpJiepvyoi",
      "Name": "Single Window:9x13 Inåtgående:2109449",
      "Long Name": "2109449"
    },
    {
      "GUID": "0FdTIYaE1DKvQpJiepvypZ",
      "Name": "Single Window:9x13 Inåtgående:2109510",
      "Long Name": "2109510"
    }
  ]
}
```

</details>

## Export endpoints with a base64 query

`topics`, `documents` and `checklists` `/export/json/` need a `query` parameter: base64 of a JSON query object. Without it they fail.

#### Topics export (PowerBI format)

```js
// Reusable helper: JSON-parses responses and turns the opaque clone error into a clear one.
async function sbRequest(path, { method = 'GET', body, accept, contentType } = {}) {
  const opts = { url: path, method };
  if (body !== undefined) opts.body = body;
  if (accept) opts.accept = accept;
  if (contentType) opts.contentType = contentType;
  let text;
  try {
    text = await StreamBIM.API.makeApiRequest(opts);
  } catch (err) {
    if (/could not be cloned/.test(err && err.message)) throw new Error(method + ' ' + path + ' failed (HTTP error; status not exposed to widgets)');
    throw err;
  }
  try { return JSON.parse(text); } catch { return text; }
}

const projectId = await StreamBIM.API.getProjectId();
const query = btoa(JSON.stringify({ skip: 0, limit: 2, selectors: {} }));
const res = await sbRequest('/project-' + projectId + '/api/v1/topics/export/json/?query=' + encodeURIComponent(query), { accept: 'application/json' });
return Array.isArray(res) ? { rows: res.length, columns: Object.keys(res[0] || {}) } : { keys: Object.keys(res) };
```

<details open><summary>Output (verified 2026-11-01, 75 ms)</summary>

```json
{
  "keys": [
    "data",
    "meta"
  ]
}
```

</details>

## BCF needs application/json

#### BCF projects

```js
const text = await StreamBIM.API.makeApiRequest({ url: '/bcf/2.1/projects', accept: 'application/json' });
const projects = JSON.parse(text);
return { count: projects.length, first: projects[0] };
```

<details open><summary>Output (verified 2026-11-01, 1505 ms)</summary>

```json
{
  "count": 32,
  "first": {
    "project_id": "13bb2290-302d-41b7-be74-d0f88ce37f29",
    "name": "11909 - Podium"
  }
}
```

</details>

#### Same call with the default Accept

```js
try {
  await StreamBIM.API.makeApiRequest({ url: '/bcf/2.1/projects' });
  return 'ok';
} catch (err) {
  return err.message;
}
```

<details open><summary>Output (verified 2026-11-01, 43 ms)</summary>

```json
"Failed to execute 'postMessage' on 'MessagePort': XMLHttpRequest object could not be cloned."
```

</details>

## Microtokens for links and downloads

A microtoken lets a plain URL (an `<img src>`, a download link, a new tab) authenticate without headers. `getAnnotatedFloorplan` returns URLs signed this way.

#### Get a microtoken

```js
const projectId = await StreamBIM.API.getProjectId();
const text = await StreamBIM.API.makeApiRequest({ url: '/project-' + projectId + '/api/v1/microtoken', accept: 'application/json' });
const body = JSON.parse(text);
return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 4) + '…' : v]));
```

<details open><summary>Output (verified 2026-11-01, 40 ms)</summary>

```json
{
  "microtoken": "GkHB…"
}
```

</details>

## Errors

When the backend answers with an HTTP error, the host rejects with the `XMLHttpRequest` object. postMessage cannot clone that, so the widget gets `DataCloneError: Failed to execute 'postMessage' on 'MessagePort': XMLHttpRequest object could not be cloned.` The status code and body are lost. To tell 404 from 403, check the path against the REST docs, or call it once from the StreamBIM tab's devtools.

#### What a failed request looks like

```js
try {
  await StreamBIM.API.makeApiRequest({ url: '/project-' + (await StreamBIM.API.getProjectId()) + '/api/v1/v2/no-such-thing' });
} catch (err) {
  return { name: err.name, message: err.message };
}
```

<details open><summary>Output (verified 2026-11-01, 40 ms)</summary>

```json
{
  "name": "DataCloneError",
  "message": "Failed to execute 'postMessage' on 'MessagePort': XMLHttpRequest object could not be cloned."
}
```

</details>

## Endpoint compatibility (swept 2026-11-01)

Every read-only GET below was called from the widget with the default Accept (`application/vnd.api+json`) and with `application/json`. `n` is the number of records returned. Generated by `harness/tools/sweep-rest.mjs`.

| Endpoint | default Accept | application/json | Returns |
|---|---|---|---|
| `/api/v1/ping` | ❌ | ❌ |  |
| `/mgw/api/v3/projects/{projectId}` | ✅ | ❌ | `projects` |
| `/mgw/api/v3/projects?page[limit]=2` | ✅ n=65 | ❌ | `projects` |
| `/mgw/api/v3/project-links?filter[active]=true&page[limit]=2` | ✅ n=65 | ❌ | `project-links` |
| `/mgw/api/v3/project-members?page[limit]=2` | ❌ | ❌ |  |
| `/mgw/api/v3/users?page[limit]=2` | ✅ n=1 | ❌ | `users` |
| `/mgw/api/v3/user-organizations?page[limit]=2` | ✅ n=1151 | ❌ | `user-organizations` |
| `/mgw/api/v3/customer-projects?page[limit]=2` | ✅ n=65 | ❌ | `customer-projects` |
| `/mgw/api/v2/user-profiles` | ✅ n=1 | ❌ | `user-profiles` |
| `/bcf/2.1/projects` | ❌ | ✅ n=32 | keys: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 |
| `/cmv3/converter-jobs?filter[project]={projectId}&page[limit]=2` | ❌ | ❌ |  |
| `/project-{projectId}/api/v1/v2/projects/{projectId}` | ✅ | ❌ | `projects` |
| `/project-{projectId}/api/v1/v2/project-stats/{projectId}` | ✅ | ❌ | `project-stats` |
| `/project-{projectId}/api/v1/v2/configs` | ✅ n=4 | ❌ | `configs` |
| `/project-{projectId}/api/v1/v2/last-modifieds/{buildingId}` | ✅ | ❌ | `last-modifieds` |
| `/project-{projectId}/api/v1/v2/sync-statuses` | ✅ n=0 | ❌ | keys: data |
| `/project-{projectId}/api/v1/v2/project-members?page[limit]=2` | ✅ n=11 | ❌ | `project-members` |
| `/project-{projectId}/api/v1/v2/users?page[limit]=2` | ✅ n=11 | ❌ | `users` |
| `/project-{projectId}/api/v1/v2/groups` | ✅ n=3 | ❌ | `groups` |
| `/project-{projectId}/api/v1/v2/user-organizations` | ✅ n=0 | ❌ | keys: data |
| `/project-{projectId}/api/v1/v2/topics?page[limit]=2&page[skip]=0` | ✅ n=2 | ❌ | `topics` |
| `/project-{projectId}/api/v1/v2/topic-statuses` | ✅ n=4 | ❌ | `statuses` |
| `/project-{projectId}/api/v1/v2/topic-labels` | ✅ n=0 | ❌ | keys: data |
| `/project-{projectId}/api/v1/v2/topic-priorities` | ✅ n=3 | ❌ | `topic-priorities` |
| `/project-{projectId}/api/v1/v2/workflows` | ✅ n=2 | ❌ | `workflows` |
| `/project-{projectId}/api/v1/v2/checklists?page[limit]=2` | ✅ n=122 | ❌ | `checklists` |
| `/project-{projectId}/api/v1/v2/documents?page[limit]=2` | ✅ n=2 | ❌ | `documents` |
| `/project-{projectId}/api/v1/v2/document-revisions?page[limit]=2` | ❌ | ❌ |  |
| `/project-{projectId}/api/v1/v2/document-labels` | ✅ n=14 | ❌ | `document-labels` |
| `/project-{projectId}/api/v1/v2/folders?page[limit]=2` | ✅ n=25 | ❌ | `folders` |
| `/project-{projectId}/api/v1/v2/labels` | ✅ n=14 | ❌ | `labels` |
| `/project-{projectId}/api/v1/v2/label-groups` | ✅ n=3 | ❌ | `label-groups` |
| `/project-{projectId}/api/v1/v2/ifc-files?page[limit]=2` | ✅ n=4 | ❌ | `ifc-files` |
| `/project-{projectId}/api/v1/v2/trains?page[limit]=2` | ✅ n=10 | ❌ | `trains` |
| `/project-{projectId}/api/v1/v2/attachments?page[limit]=2` | ❌ | ❌ |  |
| `/project-{projectId}/api/v1/topics/export/json/` | ❌ | ❌ |  |
| `/project-{projectId}/api/v1/documents/export/json/` | ❌ | ❌ |  |
| `/project-{projectId}/api/v1/checklists/export/json/` | ❌ | ❌ |  |
| `/project-{projectId}/api/v1/ifcfiles/export/json/` | ✅ n=4 | ✅ n=4 | keys: data, meta |
| `/project-{projectId}/api/v1/users/export/json/` | ✅ n=2 | ✅ n=2 | keys: data, meta |
| `/project-{projectId}/api/v1/sync` | ✅ | ✅ | keys: started-at |
| `/project-{projectId}/api/v1/microtoken` | ✅ | ✅ | keys: microtoken |

Notes from the sweep:

- `page[limit]` is ignored by some list endpoints (e.g. `/mgw/api/v3/projects`, `/v2/checklists`), which return everything.
- `/v2/attachments` and `/v2/document-revisions` need filters (e.g. `filter[object]` + `filter[building]`).
- `/api/v1/ping` and `/cmv3/converter-jobs` failed from the widget.
