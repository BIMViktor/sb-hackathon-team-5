// Volatile mock state only. No storage, network or revision key.
export class SessionAnnotations {
  constructor() {
    this.documents = new Map();
  }
  key(environment, projectId, documentId) {
    return JSON.stringify([environment, String(projectId), String(documentId)]);
  }
  forDocument(environment, projectId, documentId) {
    const key = this.key(environment, projectId, documentId);
    if (!this.documents.has(key)) this.documents.set(key, []);
    return this.documents.get(key);
  }
  count(environment, projectId, documentId) {
    return (
      this.documents.get(this.key(environment, projectId, documentId)) || []
    ).filter((a) => !a.deleted).length;
  }
}
