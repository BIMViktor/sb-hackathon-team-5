# Documents

API endpoints for managing documents, folders, document revisions, document stars, document labels, and label groups within a StreamBIM project. Documents are organized in folders and can have one or more revisions. Permissions are set at the folder level. Document labels can be assigned to both folders and documents.

## Common Information

### Authentication

All endpoints require a valid Bearer token in the `Authorization` header:

```
Authorization: Bearer {idToken}
```

### Base URL

```
https://{environment}.streambim.com
```

Replace `{environment}` with the target environment (e.g. `app`, `sweden`).

### Content Type

All requests and responses use the [JSON:API](https://jsonapi.org/) media type:

```
Content-Type: application/vnd.api+json
Accept: application/vnd.api+json
```

### Pagination

List endpoints that support pagination use **limit-offset** style:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page[skip]` | integer | `0` | Number of items to skip |
| `page[limit]` | integer | `null` (all) | Maximum number of items to return |

---

## Documents

Documents are organized in folders and can have one or more document revisions. Permissions are on the folders. Document labels can be added to both folders and documents.

### Get Documents

**GET** `/project-{projectId}/api/v1/v2/documents`

Retrieve all documents for a project, filtered by the current user's access rights.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID (minimum 1) |

**Query Parameters &mdash; Filters**

> **Important:** The "search" filters (`labels`, `starred`, `freetext`, `fileExtensions`, `noLabels`) cannot be combined with `isDeleted=true` and `since`. Doing so returns a "bad request" response.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `filter[text]` | string | `""` | Free-text search |
| `filter[fileExtensions]` | array of strings | &mdash; | File extensions to match (e.g. `pdf`, `ifc`) |
| `filter[labelIds]` | array of integers | &mdash; | Label IDs to filter by |
| `filter[noLabels]` | boolean | `false` | Only documents with no labels |
| `filter[buildingId]` | integer | `null` | Filter by building ID |
| `filter[publishedIfc]` | boolean | `false` | Only published IFC documents |
| `filter[floorId]` | integer | `null` | Filter by floor ID |
| `filter[starred]` | boolean | `null` | Only starred documents |
| `filter[documentIds]` | array of integers | &mdash; | Specific document IDs |
| `filter[folderId]` | integer | `null` | Filter by folder ID |
| `filter[isDeleted]` | boolean | `null` | Filter deleted/non-deleted documents |
| `filter[since]` | int64 | `null` | Datetime in epoch nanoseconds (e.g. `1577836800000000000`) |
| `filter[externalId]` | string | `""` | Custom ID used by integration partners |
| `filter[fromFolderId]` | integer | `null` | Filter from a specific folder ID |

**Query Parameters &mdash; Pagination**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page[skip]` | integer | `0` | Number of items to skip |
| `page[limit]` | integer | `null` | Number of items to retrieve |

**Response** `200 OK`

```json
{
    "data": [
        {
            "id": "1002",
            "type": "documents",
            "attributes": {
                "filename": "11.jpg",
                "description": "",
                "num-revisions": 1,
                "scale": null,
                "filesize": 406602,
                "path": "STREAMBIM",
                "revision": 1,
                "last-modified": "2021-06-11T09:50:52.489056Z",
                "uploaded-date": "2021-06-11T09:50:52.489056Z",
                "is-deleted": false,
                "external-id": null,
                "deleted-date": null
            },
            "relationships": {
                "document-alignments": { "data": [] },
                "document-revision": {
                    "data": { "id": "1002-1", "type": "document-revisions" }
                },
                "file": {
                    "data": { "id": "documents-1002-1", "type": "files" }
                },
                "labels": { "data": [] },
                "parent": {
                    "data": { "id": "7", "type": "folders" }
                },
                "starred": { "data": null },
                "upload-ticket": { "data": null },
                "uploaded-by": {
                    "data": { "id": "user@example.com", "type": "users" }
                }
            }
        }
    ],
    "meta": {
        "labelIds": { "1001": true, "1002": false },
        "timestamp": "1624541386399325605",
        "total": 5
    }
}
```

**Meta Object**

| Field | Type | Description |
|---|---|---|
| `labelIds` | object | Map of label IDs to boolean (indicates label presence across results) |
| `timestamp` | string | Unix timestamp in nanoseconds |
| `total` | integer | Total number of matching documents |

**Example**

```bash
curl -X GET \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/documents?page[limit]=10&page[skip]=0&filter[fileExtensions]=pdf,ifc"
```

---

### Get Document

**GET** `/project-{projectId}/api/v1/v2/documents/{documentId}`

Retrieve a single document by ID.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `documentId` | integer | Yes | The document ID |

**Response** `200 OK`

Returns a single Document object (same schema as above, without the array wrapper).

```json
{
    "data": {
        "id": "1002",
        "type": "documents",
        "attributes": { ... },
        "relationships": { ... }
    }
}
```

**Example**

```bash
curl -X GET \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/documents/1002"
```

---

### Create Document

**POST** `/project-{projectId}/api/v1/v2/documents`

Create a new document in a project.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `data.id` | string | Yes | Set to `"0"` for new documents |
| `data.type` | string | Yes | Must be `"documents"` |
| `data.attributes.filename` | string | Yes | Name of the file |
| `data.attributes.description` | string | No | Document description |
| `data.attributes.filesize` | integer | Yes | File size in bytes |
| `data.attributes.external-id` | string | No | Custom external ID |
| `data.attributes.scale` | integer | No | Document scale |
| `data.relationships.labels.data` | array | No | Array of label relationships |
| `data.relationships.parent.data` | object | Yes | Parent folder `{ "id": "...", "type": "folders" }` |
| `data.relationships.upload-ticket.data` | object | Yes | Upload ticket `{ "id": "...", "type": "upload-tickets" }` |

**Example**

```bash
curl -X POST \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  -d '{
    "data": {
        "id": "0",
        "type": "documents",
        "attributes": {
            "description": "",
            "filename": "floorplan.pdf",
            "filesize": 406602
        },
        "relationships": {
            "labels": { "data": [] },
            "parent": {
                "data": { "id": "7", "type": "folders" }
            },
            "upload-ticket": {
                "data": {
                    "type": "upload-tickets",
                    "id": "8b6ed287-8c2e-4f40-b99c-74d1dd1c5a28"
                }
            }
        }
    }
}' \
  "https://{environment}.streambim.com/project-42/api/v1/v2/documents"
```

---

### Patch Document

**PATCH** `/project-{projectId}/api/v1/v2/documents/{documentId}`

Update an existing document. Optional fields: `scale`, `external-id`.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `documentId` | integer | Yes | The document ID |

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `data.id` | string | Yes | The document ID |
| `data.type` | string | Yes | Must be `"documents"` |
| `data.attributes.description` | string | No | Updated description |
| `data.attributes.filename` | string | No | Updated filename |
| `data.attributes.scale` | integer | No | Updated scale |
| `data.attributes.external-id` | string | No | Updated external ID |
| `data.attributes.is-deleted` | boolean | No | Soft-delete flag |
| `data.relationships.labels.data` | array | No | Updated labels |
| `data.relationships.parent.data` | object | No | Updated parent folder |

**Example**

```bash
curl -X PATCH \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  -d '{
    "data": {
        "id": "1002",
        "type": "documents",
        "attributes": {
            "description": "Updated description",
            "filename": "11.jpg",
            "scale": 0,
            "external-id": "ext-001",
            "is-deleted": false
        },
        "relationships": {
            "labels": { "data": [] },
            "parent": {
                "data": { "id": "7", "type": "folders" }
            }
        }
    }
}' \
  "https://{environment}.streambim.com/project-42/api/v1/v2/documents/1002"
```

---

### Delete Document

**DELETE** `/project-{projectId}/api/v1/v2/documents/{documentId}`

Delete a document.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `documentId` | integer | Yes | The document ID |

**Example**

```bash
curl -X DELETE \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/documents/1001"
```

---

### Document Schema

| Attribute | Type | Nullable | Description |
|---|---|---|---|
| `filename` | string | No | Name of the file |
| `description` | string | Yes | Document description |
| `num-revisions` | integer | No | Number of revisions |
| `scale` | integer | Yes | Document scale |
| `filesize` | int64 | No | File size in bytes |
| `path` | string | No | Folder path |
| `revision` | integer | Yes | Current revision number |
| `last-modified` | date-time | Yes | Last modification timestamp |
| `uploaded-date` | date-time | Yes | Upload timestamp |
| `is-deleted` | boolean | No | Soft-delete flag |
| `external-id` | string | Yes | Integration partner ID |
| `deleted-date` | date-time | Yes | Deletion timestamp |

**Relationships**

| Relationship | Type | Description |
|---|---|---|
| `document-alignments` | array | Document alignment references (`DocumentID-BuildingID`) |
| `uploaded-by` | object | User who uploaded the document |
| `upload-ticket` | object | Upload ticket reference |
| `file` | object | File reference (composite ID: `documents-{DocumentID}-{RevisionType}`) |
| `parent` | object | Parent folder |
| `labels` | array | Document labels |
| `document-revision` | object | Current revision (`DocumentID-RevisionType`) |
| `starred` | object | Star status for the current user |
| `ifc-files` | array | Related IFC files (`DocumentID-BuildingID`) |

---

## Document Download Links

Get a pre-signed download URL for a document. This returns a temporary URL that can be used to download the document file directly. This is the primary mechanism for downloading document files in automation workflows.

### Get Document Download Link

**GET** `/project-{projectId}/api/v1/documents/{documentId}/downloadlink`

Returns a pre-signed download URL for the specified document's current revision.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `documentId` | integer | Yes | The document ID |

**Response** `200 OK`

```json
{
    "data": "/documents/1002/1/download?token=..."
}
```

The `data` field contains a relative path that should be appended to the project base URL to perform the actual download:

```
https://{environment}.streambim.com/project-{projectId}/api/v1{data}
```

**Example**

```bash
curl -X GET \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/documents/1002/downloadlink"
```

**Download flow:**

1. Call this endpoint to obtain the download link
2. Perform a GET request to the full URL constructed from the response `data` path
3. The response from the download URL is the raw file content

> **Note:** The download link is temporary and expires after a short period. Request a new link if it has expired.

> **See also:** For bulk document listing to collect document IDs before downloading, use `GET /project-{projectId}/api/v1/documents/export/json/` documented in [exports.md](exports.md).

---

## Document Revisions

Each document can have multiple revisions. The revision ID is a composite in the format `{DocumentID}-{RevisionNumber}`.

### Get Document Revisions

**GET** `/project-{projectId}/api/v1/v2/document-revisions`

Retrieve revisions for a document.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `filter[document]` | integer | Yes | The document ID to get revisions for |

**Response** `200 OK`

```json
{
    "data": [
        {
            "id": "1002-1",
            "type": "document-revisions",
            "attributes": {
                "description": "",
                "filesize": 406602,
                "is-active-revision": true,
                "revision": 1,
                "uploaded-date": "2021-06-11T09:50:52.489056Z"
            },
            "relationships": {
                "document": {
                    "data": { "id": "1002", "type": "documents" }
                },
                "file": {
                    "data": { "id": "documents-1002-1", "type": "files" }
                },
                "upload-ticket": { "data": null },
                "uploaded-by": {
                    "data": { "id": "user@example.com", "type": "users" }
                }
            }
        }
    ]
}
```

**Example**

```bash
curl -X GET \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/document-revisions?filter[document]=1002"
```

---

### Get Document Revision

**GET** `/project-{projectId}/api/v1/v2/document-revisions/{revisionId}`

Retrieve a single document revision by its composite ID.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `revisionId` | string | Yes | Composite ID in format `{DocumentID}-{RevisionNumber}` |

**Response** `200 OK`

Returns a single DocumentRevision object.

**Example**

```bash
curl -X GET \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/document-revisions/1002-1"
```

---

### Create Document Revision

**POST** `/project-{projectId}/api/v1/v2/document-revisions`

Create a new revision for an existing document.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `data.id` | string | Yes | Composite ID: `{DocumentID}-{NewRevisionNumber}` |
| `data.type` | string | Yes | Must be `"document-revisions"` |
| `data.attributes.description` | string | No | Revision description |
| `data.attributes.filesize` | integer | Yes | File size in bytes |
| `data.relationships.upload-ticket.data` | object | No | Upload ticket reference |

**Example**

```bash
curl -X POST \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  -d '{
    "data": {
        "id": "1002-2",
        "type": "document-revisions",
        "attributes": {
            "description": "",
            "filesize": 406602
        },
        "relationships": {
            "upload-ticket": { "data": null }
        }
    }
}' \
  "https://{environment}.streambim.com/project-42/api/v1/v2/document-revisions"
```

---

### Document Revision Schema

| Attribute | Type | Description |
|---|---|---|
| `description` | string | Revision description |
| `filesize` | integer | File size in bytes |
| `is-active-revision` | boolean | Whether this is the currently active revision |
| `revision` | integer | Revision number |
| `uploaded-date` | date-time | Upload timestamp |

**Relationships**

| Relationship | Type | Description |
|---|---|---|
| `document` | object | Parent document reference |
| `file` | object | File reference |
| `upload-ticket` | object | Upload ticket reference |
| `uploaded-by` | object | User who uploaded the revision |

---

## Document Stars

Star (bookmark) documents for the current user.

### Get Document Star

**GET** `/project-{projectId}/api/v1/v2/document-stars/{starId}`

Retrieve a document star by ID.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `starId` | integer | Yes | The document star ID |

**Response** `200 OK`

```json
{
    "data": {
        "id": "1000",
        "type": "document-stars",
        "relationships": {
            "document": {
                "data": { "id": "1002", "type": "documents" }
            }
        }
    }
}
```

**Example**

```bash
curl -X GET \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/document-stars/1000"
```

---

### Star a Document

**PATCH** `/project-{projectId}/api/v1/v2/document-stars/{starId}`

Create or update a document star.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `data.id` | string | Yes | Set to `"0"` when creating a new star |
| `data.type` | string | Yes | Must be `"document-stars"` |
| `data.relationships.document.data` | object | Yes | `{ "id": "{documentId}", "type": "document" }` |

**Response** `200 OK`

Returns the created/updated document-star object.

**Example**

```bash
curl -X POST \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  -d '{
    "data": {
        "id": "0",
        "type": "document-stars",
        "relationships": {
            "document": {
                "data": { "id": "1002", "type": "document" }
            }
        }
    }
}' \
  "https://{environment}.streambim.com/project-42/api/v1/v2/document-stars"
```

---

### Delete Document Star

**DELETE** `/project-{projectId}/api/v1/v2/document-stars/{starId}`

Remove a star from a document.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `starId` | integer | Yes | The document star ID |

**Response** `200 OK`

```json
{
    "data": null
}
```

**Example**

```bash
curl -X DELETE \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/document-stars/1000"
```

---

## Document Labels

Labels that can be applied to documents and folders for categorization.

### Get Document Labels

**GET** `/project-{projectId}/api/v1/v2/document-labels`

Retrieve all document labels for a project.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Response** `200 OK`

```json
{
    "data": [
        {
            "id": "1000",
            "type": "document-labels",
            "attributes": {
                "name": "ARK"
            },
            "relationships": {
                "label-group": { "data": null }
            }
        }
    ]
}
```

**Example**

```bash
curl -X GET \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/document-labels"
```

---

### Get Document Label

**GET** `/project-{projectId}/api/v1/v2/document-labels/{labelId}`

Retrieve a single document label.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `labelId` | integer | Yes | The label ID |

**Response** `200 OK`

Returns a single document-label object.

**Example**

```bash
curl -X GET \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/document-labels/1011"
```

---

### Create Document Label

**POST** `/project-{projectId}/api/v1/v2/document-labels`

Create a new document label.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `data.id` | string | Yes | Set to `"0"` for new labels |
| `data.type` | string | Yes | Must be `"document-labels"` |
| `data.attributes.name` | string | Yes | Label name |
| `data.relationships.label-group.data` | object or null | No | Parent label group reference |

**Response** `200 OK`

```json
{
    "data": {
        "id": "1011",
        "type": "document-labels",
        "attributes": {
            "name": "new doc label"
        },
        "relationships": {
            "label-group": { "data": null }
        }
    }
}
```

**Example**

```bash
curl -X POST \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  -d '{
    "data": {
        "id": "0",
        "type": "document-labels",
        "attributes": {
            "name": "new doc label"
        },
        "relationships": {
            "label-group": { "data": null }
        }
    }
}' \
  "https://{environment}.streambim.com/project-42/api/v1/v2/document-labels"
```

---

### Patch Document Label

**PATCH** `/project-{projectId}/api/v1/v2/document-labels/{labelId}`

Update an existing document label.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `labelId` | integer | Yes | The label ID |

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `data.id` | string | Yes | The label ID |
| `data.type` | string | Yes | Must be `"document-labels"` |
| `data.attributes.name` | string | No | Updated label name |
| `data.relationships.label-group.data` | object or null | No | Updated label group |

**Example**

```bash
curl -X PATCH \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  -d '{
    "data": {
        "id": "1011",
        "type": "document-labels",
        "attributes": {
            "name": "updated label name"
        },
        "relationships": {
            "label-group": { "data": null }
        }
    }
}' \
  "https://{environment}.streambim.com/project-42/api/v1/v2/document-labels/1011"
```

---

### Delete Document Label

**DELETE** `/project-{projectId}/api/v1/v2/document-labels/{labelId}`

Delete a document label. Available only to administrators.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `labelId` | integer | Yes | The label ID |

**Response** `200 OK`

```json
{
    "data": null
}
```

**Error Response** `404 Not Found`

```json
{
    "errors": [
        {
            "status": "404",
            "code": "notFound",
            "detail": "Invalid label ID",
            "meta": {
                "params": { "innerError": "Invalid label ID" }
            }
        }
    ]
}
```

**Example**

```bash
curl -X DELETE \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/document-labels/1011"
```

---

### Document Label Schema

| Attribute | Type | Description |
|---|---|---|
| `name` | string | Label name |

**Relationships**

| Relationship | Type | Description |
|---|---|---|
| `label-group` | object or null | Parent label group |

---

## Label Groups

Label groups organize document labels into categories.

### Get Label Groups

**GET** `/project-{projectId}/api/v1/v2/label-groups`

Retrieve all label groups with their associated document labels.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Response** `200 OK`

```json
{
    "data": [
        {
            "id": "1000",
            "type": "label-groups",
            "attributes": {
                "name": "Filtype",
                "allow-non-admins-to-edit": false
            },
            "relationships": {
                "labels": {
                    "data": [
                        { "id": "1001", "type": "document-labels" },
                        { "id": "1002", "type": "document-labels" }
                    ]
                }
            }
        }
    ]
}
```

**Example**

```bash
curl -X GET \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/label-groups"
```

---

### Get Label Group

**GET** `/project-{projectId}/api/v1/v2/label-groups/{groupId}`

Retrieve a single label group.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `groupId` | integer | Yes | The label group ID |

**Response** `200 OK`

Returns a single label-group object.

**Example**

```bash
curl -X GET \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/label-groups/1002"
```

---

### Create Label Group

**POST** `/project-{projectId}/api/v1/v2/label-groups`

Create a new label group. Available only to administrators.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `data.id` | string | Yes | Set to `"0"` for new groups |
| `data.type` | string | Yes | Must be `"label-groups"` |
| `data.attributes.name` | string | Yes | Group name |
| `data.attributes.allow-non-admins-to-edit` | boolean | No | Whether non-admins can edit labels in this group |
| `data.relationships.labels.data` | array | No | Initial labels (usually empty) |

**Response** `200 OK`

```json
{
    "data": {
        "id": "1002",
        "type": "label-groups",
        "attributes": {
            "name": "new group"
        },
        "relationships": {
            "labels": { "data": [] }
        }
    }
}
```

**Example**

```bash
curl -X POST \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  -d '{
    "data": {
        "id": "0",
        "type": "label-groups",
        "attributes": {
            "name": "new group",
            "allow-non-admins-to-edit": true
        },
        "relationships": {
            "labels": { "data": [] }
        }
    }
}' \
  "https://{environment}.streambim.com/project-42/api/v1/v2/label-groups"
```

---

### Patch Label Group

**PATCH** `/project-{projectId}/api/v1/v2/label-groups/{groupId}`

Update a label group. Available only to administrators.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `groupId` | integer | Yes | The label group ID |

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `data.id` | string | Yes | The label group ID |
| `data.type` | string | Yes | Must be `"label-groups"` |
| `data.attributes.name` | string | No | Updated group name |
| `data.attributes.allow-non-admins-to-edit` | boolean | No | Updated permission flag |

**Error Response** `404 Not Found`

```json
{
    "errors": [
        {
            "status": "404",
            "code": "notFound",
            "detail": "Invalid label-group ID",
            "meta": {
                "params": { "innerError": "Invalid label-group ID" }
            }
        }
    ]
}
```

**Example**

```bash
curl -X PATCH \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  -d '{
    "data": {
        "id": "1002",
        "type": "label-groups",
        "attributes": {
            "name": "updated group name"
        },
        "relationships": {
            "labels": { "data": [] }
        }
    }
}' \
  "https://{environment}.streambim.com/project-42/api/v1/v2/label-groups/1002"
```

---

### Delete Label Group

**DELETE** `/project-{projectId}/api/v1/v2/label-groups/{groupId}`

Delete a label group. Available only to administrators.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `groupId` | integer | Yes | The label group ID |

**Response** `200 OK`

```json
{
    "data": null
}
```

**Error Response** `404 Not Found`

```json
{
    "errors": [
        {
            "status": "404",
            "code": "notFound",
            "detail": "Invalid label ID",
            "meta": {
                "params": { "innerError": "Invalid label ID" }
            }
        }
    ]
}
```

**Example**

```bash
curl -X DELETE \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/label-groups/1002"
```

---

### Label Group Schema

| Attribute | Type | Description |
|---|---|---|
| `name` | string | Group name |
| `allow-non-admins-to-edit` | boolean | Whether non-admin users can edit labels within the group |

**Relationships**

| Relationship | Type | Description |
|---|---|---|
| `labels` | array | Document labels belonging to this group |

---

## Labels (All Types)

This endpoint returns both document and topic labels.

### Get All Labels

**GET** `/project-{projectId}/api/v1/v2/labels`

Retrieve all labels (both document and topic labels) for a project.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID (minimum 1) |

**Response** `200 OK`

```json
{
    "data": [
        {
            "id": "1001",
            "type": "labels",
            "attributes": {
                "name": "Architecture",
                "topicLabel": false,
                "documentLabel": true,
                "autogenerated": false
            },
            "relationships": {
                "labelGroupId": {
                    "data": { "id": "1000", "type": "label-groups" }
                }
            }
        }
    ]
}
```

**Example**

```bash
curl -X GET \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/labels"
```

### Label Schema

| Attribute | Type | Description |
|---|---|---|
| `name` | string | Label name |
| `topicLabel` | boolean | Whether this is a topic label |
| `documentLabel` | boolean | Whether this is a document label |
| `autogenerated` | boolean | Whether the label was auto-generated |

**Relationships**

| Relationship | Type | Description |
|---|---|---|
| `labelGroupId` | object or null | Parent label group |

---

## Folders

Folders organize documents in a hierarchical structure. Permissions are set at the folder level. Use folder ID `0` to reference the root folder.

### Get All Folders

**GET** `/project-{projectId}/api/v1/v2/folders`

Retrieve all folders for a project, filtered by the current user's access rights.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID (minimum 1) |

**Query Parameters &mdash; Filters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `filter[isDeleted]` | boolean | `null` | Filter by deleted status |
| `filter[parent]` | integer | `null` | Parent folder ID (use `0` for root-level folders only) |
| `filter[since]` | int64 | `null` | Datetime in epoch nanoseconds |

**Response** `200 OK`

```json
{
    "data": [
        {
            "id": "7",
            "type": "folders",
            "attributes": {
                "name": "STREAMBIM",
                "description": "",
                "created-date": "2021-06-10T13:44:56.50162Z",
                "last-modified": "2021-06-15T00:30:00.627941Z",
                "access-level": 20,
                "is-deleted": false,
                "external-id": "7",
                "deleted-date": null
            },
            "relationships": {
                "modified-by": {
                    "data": { "id": "user@example.com", "type": "users" }
                },
                "folder-accesses": { "data": [] },
                "parent": {
                    "data": { "id": "0", "type": "folders" }
                },
                "labels": { "data": [] }
            }
        }
    ]
}
```

**Example**

```bash
curl -X GET \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/folders?filter[parent]=0"
```

---

### Get Folder

**GET** `/project-{projectId}/api/v1/v2/folders/{folderId}`

Retrieve a single folder by ID.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `folderId` | integer | Yes | The folder ID |

**Response** `200 OK`

Returns a single Folder object.

**Example**

```bash
curl -X GET \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/v2/folders/1"
```

---

### Create Folder

**POST** `/project-{projectId}/api/v1/v2/folders`

Create a new folder.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `data.id` | string | Yes | Can be any string (server assigns actual ID) |
| `data.type` | string | Yes | Must be `"folders"` |
| `data.attributes.name` | string | Yes | Folder name |
| `data.relationships.labels.data` | array | No | Label references |
| `data.relationships.parent.data` | object | Yes | Parent folder `{ "id": "0", "type": "folders" }` (use `"0"` for root) |

**Response** `200 OK`

Returns the created Folder object with server-assigned ID.

**Example**

```bash
curl -X POST \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  -d '{
    "data": {
        "id": "1",
        "type": "folders",
        "attributes": {
            "name": "NewFolderName"
        },
        "relationships": {
            "labels": {
                "data": [
                    { "id": "1005", "type": "document-labels" }
                ]
            },
            "parent": {
                "data": { "id": "0", "type": "folders" }
            }
        }
    }
}' \
  "https://{environment}.streambim.com/project-42/api/v1/v2/folders"
```

---

### Patch Folder

**PATCH** `/project-{projectId}/api/v1/v2/folders/{folderId}`

Update an existing folder.

**Headers**

| Header | Value |
|---|---|
| `Accept` | `application/vnd.api+json` |
| `Content-Type` | `application/vnd.api+json` |
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `folderId` | integer | Yes | The folder ID |

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `data.id` | string | Yes | The folder ID |
| `data.type` | string | Yes | Must be `"folders"` |
| `data.attributes.name` | string | No | Updated folder name |
| `data.attributes.is-deleted` | boolean | No | Soft-delete flag |
| `data.relationships.labels.data` | array | No | Updated labels |
| `data.relationships.parent.data` | object | No | Move folder to a different parent |

**Example**

```bash
curl -X PATCH \
  -H "Accept: application/vnd.api+json" \
  -H "Content-Type: application/vnd.api+json" \
  -H "Authorization: Bearer {idToken}" \
  -d '{
    "data": {
        "id": "8",
        "type": "folders",
        "attributes": {
            "name": "RenamedFolder",
            "is-deleted": false
        },
        "relationships": {
            "labels": {
                "data": [
                    { "id": "1005", "type": "document-labels" }
                ]
            },
            "parent": {
                "data": { "id": "0", "type": "folders" }
            }
        }
    }
}' \
  "https://{environment}.streambim.com/project-42/api/v1/v2/folders/8"
```

---

### Folder Schema

| Attribute | Type | Nullable | Description |
|---|---|---|---|
| `name` | string | No | Folder name |
| `description` | string | No | Folder description |
| `created-date` | date-time | Yes | Creation timestamp |
| `last-modified` | date-time | Yes | Last modification timestamp |
| `access-level` | integer | No | Access level (e.g. `20`) |
| `is-deleted` | boolean | No | Soft-delete flag |
| `external-id` | string | Yes | Integration partner ID |
| `deleted-date` | date-time | Yes | Deletion timestamp |

**Relationships**

| Relationship | Type | Description |
|---|---|---|
| `modified-by` | object | User who last modified the folder |
| `folder-accesses` | array | Folder access entries (composite ID: `{AccessID}-{FolderID}`) |
| `parent` | object or null | Parent folder (`null` for root) |
| `labels` | array | Document labels applied to the folder |

---

## Document Downloads

### Get Document Download Link

**GET** `/project-{projectId}/api/v1/documents/{documentId}/downloadlink`

Returns a relative download URL for the document's current revision. The returned link is a server-relative path that should be prepended with the project API base URL to fetch the actual file binary.

**Headers**

| Header | Value |
|---|---|
| `Authorization` | `Bearer {idToken}` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |
| `documentId` | integer | Yes | The document ID |

**Response** `200 OK`

Returns a plain text string containing the relative download path.

```
documents/1002/download/filename.pdf
```

**Downloading the file**

Use the returned path to construct the full download URL:

```
GET /project-{projectId}/api/v1/{downloadLink}
```

The response is the raw file binary with the appropriate `Content-Type` header.

**Example**

```bash
# 1. Get the download link
DOWNLOAD_LINK=$(curl -s \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/documents/1002/downloadlink")

# 2. Download the actual file
curl -O \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/${DOWNLOAD_LINK}"
```

---

## Document Export to JSON

### Export Documents

**GET** `/project-{projectId}/api/v1/documents/export/json/`

Export documents matching a query as a flat JSON response. This endpoint uses the same Base64-encoded query pattern as the [checklist export](exports.md). It is useful for searching and listing documents with a simpler response format than the JSON:API endpoints.

**Headers**

| Header | Value |
|---|---|
| `Authorization` | `Bearer {idToken}` |
| `Accept` | `*/*` |

**Path Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | integer | Yes | The project ID |

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | string | Yes | A Base64-encoded JSON object representing the search query |

**Query Schema**

The JSON object you encode for the `query` parameter:

| Field | Type | Description |
|---|---|---|
| `filter` | object | Filter criteria (see below) |

**Filter fields:**

| Field | Type | Description |
|---|---|---|
| `freetext` | string | Free-text search (e.g. `".ifc"`, `".ids"`) |
| `isDeleted` | boolean | Filter by deleted status |
| `fileExtensions` | array | Filter by file extensions |
| `labelIds` | array | Filter by label IDs |
| `folderId` | integer | Filter by folder ID |

**Response** `200 OK`

```json
{
    "data": [
        {
            "id": "1002",
            "filename": "model.ifc",
            "uploadedDate": "2021-06-11T09:50:52.489056Z",
            "filesize": 406602,
            "revision": 1
        }
    ]
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Document ID |
| `filename` | string | File name |
| `uploadedDate` | string | ISO 8601 upload timestamp |
| `filesize` | integer | File size in bytes |
| `revision` | integer | Current revision number |

**Example**

```bash
# Search for all IFC files
QUERY=$(echo -n '{"filter":{"freetext":".ifc","isDeleted":false}}' | base64)

curl -X GET \
  -H "Authorization: Bearer {idToken}" \
  "https://{environment}.streambim.com/project-42/api/v1/documents/export/json/?query=${QUERY}"
```
