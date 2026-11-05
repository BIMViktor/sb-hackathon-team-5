# makeApiRequest

**Status:** ✅ works · **Category:** REST & auth · [All methods](../README.md)

Authenticated HTTP call to the StreamBIM backend with the user's session.

```ts
StreamBIM.API.makeApiRequest(opts: { url: string, method?: string, body?: any, accept?: string, contentType?: string }): Promise<string>
```

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `opts.url` | `string` | yes | Path on the StreamBIM origin. Project APIs: `/project-{projectId}/api/v1/…`. Global: `/mgw/api/v3/…`. (The `/pgw/project-…` paths in older docs failed in testing.) |
| `opts.method` | `string` | no | Default `GET`. |
| `opts.body` | `object \| string` | no | Serialised by the host. |
| `opts.accept` | `string` | no | Default `application/vnd.api+json`. |
| `opts.contentType` | `string` | no | Default `application/vnd.api+json` (JSON:API). Use `application/json` for endpoints like `ifc-searches`. |

## Returns

`string`: Raw response body. `JSON.parse` it yourself.

## What StreamBIM does

`storeservice.makeRawRequest(url, body, { method, absoluteUrl: true, accept, contentType })`.

## Errors

- On HTTP errors the host rejects with the XHR object. penpal cannot clone it, so the widget receives `DataCloneError: … XMLHttpRequest object could not be cloned` and **no status code**. Treat that message as "the request failed".

## Examples

#### GET the project (JSON:API)

```js
const projectId = await StreamBIM.API.getProjectId();
const raw = await StreamBIM.API.makeApiRequest({ url: '/mgw/api/v3/projects/' + projectId });
const { data } = JSON.parse(raw);
return { id: data.id, type: data.type, description: data.attributes.description };
```

<details open><summary>Output (verified 2026-11-01, 43 ms)</summary>

```json
{
  "id": "15974",
  "type": "projects",
  "description": "Project for demoing widgets"
}
```

</details>

#### POST an IFC search, then export rows

```js
const projectId = await StreamBIM.API.getProjectId();
const buildingId = await StreamBIM.API.getBuildingId();
const created = await StreamBIM.API.makeApiRequest({
  url: '/project-' + projectId + '/api/v1/ifc-searches',
  method: 'POST',
  contentType: 'application/json',
  body: { rules: [[{ buildingId, propKey: '@kind', propValue: 'Window' }]] },
});
const { searchId } = JSON.parse(created);
const fields = btoa('GUID|Name');
const exported = await StreamBIM.API.makeApiRequest({
  url: '/project-' + projectId + '/api/v1/ifc-searches/export/json?searchId=' + searchId + '&fieldUnion=true&fieldNames=' + fields + '&page[limit]=3&page[skip]=0',
});
return JSON.parse(exported).data;
```

<details open><summary>Output (verified 2026-11-01, 102 ms)</summary>

```json
[
  {
    "GUID": "0FdTIYaE1DKvQpJiepvyYk",
    "Name": "Single Window:9x13 Inåtgående:2110475"
  },
  {
    "GUID": "0FdTIYaE1DKvQpJiepvyoi",
    "Name": "Single Window:9x13 Inåtgående:2109449"
  },
  {
    "GUID": "0FdTIYaE1DKvQpJiepvypZ",
    "Name": "Single Window:9x13 Inåtgående:2109510"
  }
]
```

</details>

#### Failed request

```js
try {
  await StreamBIM.API.makeApiRequest({ url: '/project-' + (await StreamBIM.API.getProjectId()) + '/api/v1/does-not-exist' });
} catch (err) {
  return { name: err.name, message: err.message };
}
```

<details open><summary>Output (verified 2026-11-01, 47 ms)</summary>

```json
{
  "name": "DataCloneError",
  "message": "Failed to execute 'postMessage' on 'MessagePort': XMLHttpRequest object could not be cloned."
}
```

</details>

## Probe results (2026-11-01)

Raw calls from `harness/tools/probe-widget-api.mjs`, each raced against a 6 s timeout:

| Case | Args | Outcome | ms |
|---|---|---|---|
| normal call | `[{"url":"/mgw/api/v3/projects/15974"}]` | resolved `string` | 50 |
| HTTP error | `[{"url":"/project-15974/api/v1/does-not-exist"}]` | rejected `"Failed to execute 'postMessage' on 'MessagePort': XMLHttpRequest object could not be cloned."` | 44 |
